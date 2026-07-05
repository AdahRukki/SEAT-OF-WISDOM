import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pool } from "./db";

async function runMigrations() {
  try {
    await pool.query(`
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS current_term VARCHAR(50);
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS current_session VARCHAR(20);
      ALTER TABLE fee_payment_records ADD COLUMN IF NOT EXISTS purpose VARCHAR(100);
      ALTER TABLE fee_payment_records ADD COLUMN IF NOT EXISTS depositor_name VARCHAR(150);
      ALTER TABLE fee_payment_records ADD COLUMN IF NOT EXISTS client_request_id TEXT;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS client_request_id TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_fee_payment_records_client_request_id
        ON fee_payment_records (client_request_id) WHERE client_request_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_students_client_request_id
        ON students (client_request_id) WHERE client_request_id IS NOT NULL;
      ALTER TABLE fee_types ADD COLUMN IF NOT EXISTS is_tuition BOOLEAN DEFAULT FALSE;
      ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS bank_format VARCHAR(20);
      -- Task #128: similar-but-not-identical duplicate flagging.
      ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS possible_duplicate BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS duplicate_of_transaction_id UUID;
      ALTER TABLE fee_payment_records ADD COLUMN IF NOT EXISTS possible_duplicate BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE fee_payment_records ADD COLUMN IF NOT EXISTS duplicate_of_payment_id UUID;
      CREATE INDEX IF NOT EXISTS idx_bank_transactions_possible_duplicate
        ON bank_transactions (school_id) WHERE possible_duplicate = TRUE;
      CREATE INDEX IF NOT EXISTS idx_fee_payment_records_possible_duplicate
        ON fee_payment_records (school_id) WHERE possible_duplicate = TRUE;
      -- Task #128 phase 2: remember admin "Not a duplicate" decisions so a
      -- later statement re-scan respects them.
      CREATE TABLE IF NOT EXISTS cleared_duplicate_pairs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kind VARCHAR(20) NOT NULL,
        entity_a_id UUID NOT NULL,
        entity_b_id UUID NOT NULL,
        cleared_by UUID REFERENCES users(id),
        cleared_at TIMESTAMP DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_cleared_duplicate_pairs
        ON cleared_duplicate_pairs (kind, entity_a_id, entity_b_id);
      CREATE TABLE IF NOT EXISTS tuition_class_amounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fee_type_id UUID NOT NULL REFERENCES fee_types(id) ON DELETE CASCADE,
        class_id VARCHAR(50) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        term VARCHAR(30),
        session VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE fee_payment_records ALTER COLUMN student_id DROP NOT NULL;
      CREATE TABLE IF NOT EXISTS fee_payment_student_splits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payment_record_id UUID NOT NULL REFERENCES fee_payment_records(id) ON DELETE CASCADE,
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        amount DECIMAL(12,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      -- SMS bank-alert ingestion: source tracking + masked-account -> school routing.
      ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'statement';
      ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS sms_sender VARCHAR(100);
      ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS sms_account VARCHAR(50);
      ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS sms_received_at TIMESTAMP;
      CREATE TABLE IF NOT EXISTS school_bank_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        bank_name VARCHAR(50) NOT NULL,
        masked_account_number VARCHAR(50) NOT NULL UNIQUE,
        account_label VARCHAR(100),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
      -- Admin-settable class sort order + graduation/withdrawal tracking.
      ALTER TABLE classes ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
      ALTER TABLE students ADD COLUMN IF NOT EXISTS status_session VARCHAR(20);
      ALTER TABLE students ADD COLUMN IF NOT EXISTS status_term VARCHAR(50);
      -- Task #152: per-sub-admin tab/feature permission toggles.
      ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[];
      -- Seed default sort order for existing classes (one-time; only when unset).
      UPDATE classes SET sort_order = 1 WHERE (sort_order IS NULL OR sort_order = 0) AND name = 'J.S.S 1';
      UPDATE classes SET sort_order = 2 WHERE (sort_order IS NULL OR sort_order = 0) AND name = 'J.S.S 2';
      UPDATE classes SET sort_order = 3 WHERE (sort_order IS NULL OR sort_order = 0) AND name = 'J.S.S 3';
      UPDATE classes SET sort_order = 4 WHERE (sort_order IS NULL OR sort_order = 0) AND name = 'S.S.S 1';
      UPDATE classes SET sort_order = 5 WHERE (sort_order IS NULL OR sort_order = 0) AND name = 'S.S.S 2';
      UPDATE classes SET sort_order = 6 WHERE (sort_order IS NULL OR sort_order = 0) AND name = 'S.S.S 3';
      CREATE TABLE IF NOT EXISTS admissions_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_name VARCHAR(200) NOT NULL,
        date_of_birth VARCHAR(20) NOT NULL,
        gender VARCHAR(20) NOT NULL,
        level VARCHAR(30) NOT NULL,
        preferred_branch VARCHAR(50) NOT NULL,
        previous_school VARCHAR(200),
        parent_name VARCHAR(200) NOT NULL,
        parent_phone VARCHAR(30) NOT NULL,
        parent_email VARCHAR(255),
        home_address TEXT NOT NULL,
        special_needs TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Self-heal Task #123: any bank_transactions row whose status is not
    // 'unmatched' but has zero linked payment_allocations is an orphan from
    // legacy data (pre Task #94/#95) or external SQL writes. Reset it so the
    // bank credit can be re-allocated.
    const healed = await pool.query(`
      UPDATE bank_transactions bt
         SET status = 'unmatched',
             match_confidence = 0,
             updated_at = NOW()
       WHERE bt.status IN ('confirmed','matched','suggested','partially_reconciled')
         AND NOT EXISTS (
           SELECT 1 FROM payment_allocations pa
            WHERE pa.bank_transaction_id = bt.id
         )
      RETURNING bt.id;
    `);
    if (healed.rowCount && healed.rowCount > 0) {
      log(`Self-healed ${healed.rowCount} orphan bank transaction(s) back to unmatched`);
    }

    // Seed the masked-account -> school routing map for the known accounts so
    // SMS ingestion routes correctly out of the box. Idempotent: skips any
    // masked number already present, and only seeds when the school is found.
    // Admins can edit/add more in the Bank Accounts screen.
    const seedAccounts: Array<{ masked: string; bank: string; nameLike: string; label: string }> = [
      { masked: "238****209", bank: "Zenith", nameLike: "%ikpoto%", label: "Main" },
      { masked: "217****822", bank: "Zenith", nameLike: "%akwuose%", label: "Main" },
      { masked: "192****748", bank: "Access", nameLike: "%akwuofor%", label: "Main" },
      { masked: "**0025", bank: "Fidelity", nameLike: "%bonsa%", label: "Main" },
    ];
    for (const acct of seedAccounts) {
      // Values are hardcoded constants (no user input), inlined to match the
      // single-argument pool.query() style used by the migrations above.
      await pool.query(`
        INSERT INTO school_bank_accounts (school_id, bank_name, masked_account_number, account_label)
        SELECT s.id, '${acct.bank}', '${acct.masked}', '${acct.label}'
          FROM schools s WHERE s.name ILIKE '${acct.nameLike}' LIMIT 1
        ON CONFLICT (masked_account_number) DO NOTHING
      `);
    }

    log("Database migrations applied successfully");
  } catch (err) {
    console.error("Migration error:", err);
  }
}

const app = express();
app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Prevent browsers and intermediate caches from serving stale API responses.
// Without this, browsers heuristically cache /api/* GETs (which have no
// Cache-Control) and serve stale bodies — even back to the service worker —
// so users see deleted records and miss new ones until they clear site data.
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

(async () => {
  await runMigrations();
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
