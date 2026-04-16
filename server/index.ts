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
      ALTER TABLE fee_types ADD COLUMN IF NOT EXISTS is_tuition BOOLEAN DEFAULT FALSE;
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
