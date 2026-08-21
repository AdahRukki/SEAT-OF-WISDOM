// Unit + real-DB tests for the email-ingest silent-drop-path fixes:
//   - clampHead/clampTail: truncate an unbounded parser-extracted value to a
//     DB column's max length before it can throw a constraint violation.
//   - emergencyRecord: the last-resort fallback that guarantees a UID gets
//     at least one email_review_queue row even when processMessage() throws
//     for a genuinely unexpected reason.
//
// The clampHead/clampTail checks are pure-function unit tests. The
// emergencyRecord checks hit a real database (same pattern as
// scripts/test-email-ingest-cursor.ts's DB-touching checks) — requires
// DATABASE_URL to point at a reachable Postgres with the schema applied.
//
// Run: npx tsx scripts/test-email-ingest-resilience.ts

import "dotenv/config";
import { clampHead, clampTail, emergencyRecord } from "../server/email-ingest";
import { storage } from "../server/storage";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}`);
    failed++;
  }
}

async function main() {
  console.log("── clampHead ─────────────────────────────────────────");
  check("null passes through unchanged", clampHead(null, 50) === null);
  check("undefined passes through unchanged", clampHead(undefined, 50) === undefined);
  check("value shorter than max is unchanged", clampHead("short", 50) === "short");
  check("value exactly at max is unchanged", clampHead("a".repeat(50), 50) === "a".repeat(50));
  {
    const long = "abcdefghij".repeat(10); // 100 chars
    const result = clampHead(long, 50);
    check("value longer than max is truncated to max length", result?.length === 50);
    check("truncation keeps the HEAD (first 50 chars)", result === long.slice(0, 50));
  }

  console.log("\n── clampTail ─────────────────────────────────────────");
  check("null passes through unchanged", clampTail(null, 50) === null);
  check("undefined passes through unchanged", clampTail(undefined, 50) === undefined);
  check("value shorter than max is unchanged", clampTail("short", 50) === "short");
  {
    // Simulates a malformed maskedAccount extraction: a long run with the
    // real trailing account digits at the very end — clampTail must keep
    // those, since getSchoolBankAccountByMasked() routes by trailing digits.
    const long = "xxxxxxxxxx".repeat(9) + "217822"; // 90 + 6 = 96 chars, ends in the real account digits
    const result = clampTail(long, 50);
    check("value longer than max is truncated to max length", result?.length === 50);
    check("truncation keeps the TAIL (trailing digits preserved)", result?.endsWith("217822") === true);
    check("truncation drops from the head, not the tail", result === long.slice(-50));
  }

  console.log("\n── emergencyRecord (real DB) ───────────────────────────");
  const mailbox = "resilience-test@example.com";
  const uid = 900101;
  await emergencyRecord(
    mailbox,
    {
      uid,
      envelope: {
        from: [{ address: "alerts@zenithbank.com" }],
        subject: "Credit Alert",
        date: new Date("2026-01-01T00:00:00Z"),
      },
    },
    new Error("synthetic unexpected failure for testing")
  );
  const rows = await storage.getEmailReviewQueue({ limit: 500 });
  const row = rows.find((r: any) => r.mailbox === mailbox && r.uid === uid);
  check("emergencyRecord writes a row for the UID", !!row);
  check("row outcome is 'error' (cursor holds, retried next pass)", row?.outcome === "error");
  check("row reason mentions the synthetic error", !!row?.reason?.includes("synthetic unexpected failure"));
  check("row detectedBank derived from sender domain", row?.detectedBank === "Zenith");
  check("row verified/likelyTransaction/parseOk all false", row?.verified === false && row?.likelyTransaction === false && row?.parseOk === false);

  // Cleanup — don't leave test rows in a real database.
  await storage.getEmailReviewQueue({ limit: 1 }); // no-op read to keep symmetry with other suites' style
  const { db } = await import("../server/db");
  const { emailReviewQueue } = await import("../shared/schema");
  const { eq } = await import("drizzle-orm");
  await db.delete(emailReviewQueue).where(eq(emailReviewQueue.mailbox, mailbox));

  console.log(`\n${"─".repeat(50)}`);
  if (failed === 0) {
    console.log(`All ${passed} checks passed.`);
    process.exit(0);
  } else {
    console.log(`${failed} check(s) FAILED, ${passed} passed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test run failed:", err);
  process.exit(1);
});
