/**
 * Regression test: email-ingest UID cursor advancement (computeNextCursor).
 *
 * This is the replacement for the old \Seen-flag-based "what's already
 * processed" tracking. The rule under test: the cursor advances past a
 * contiguous run of terminal outcomes (ingested/skipped) but STOPS at the
 * first 'retry' outcome, so that message is retried on the next catch-up
 * pass instead of being silently skipped forever — even if later messages in
 * the same batch already succeeded.
 *
 * Imports from server/email-ingest.ts, which transitively imports ./storage
 * -> ./db, so DATABASE_URL must be set to run this (same requirement as
 * scripts/test-dkim-verification.ts). computeNextCursor itself touches
 * neither the DB nor the network — it's a pure function.
 *
 * Run with:  DATABASE_URL=... npx tsx scripts/test-email-ingest-cursor.ts
 */

import { computeNextCursor } from "../server/email-ingest";

let failures = 0;
let total = 0;

function check(name: string, cond: boolean, detail?: unknown) {
  total++;
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}`, detail !== undefined ? detail : "");
  }
}

type Outcome = "ingested" | "skipped" | "retry";
const r = (uid: number, outcome: Outcome) => ({ uid, outcome });

console.log("Running computeNextCursor() unit tests…\n");

console.log("Test 1: All-terminal run advances past the last UID");
{
  const next = computeNextCursor(0, [r(1, "ingested"), r(2, "skipped")]);
  check("cursor = 2", next === 2, next);
}

console.log("\nTest 2: A later 'retry' holds the cursor at the last terminal UID before it");
{
  const next = computeNextCursor(0, [r(1, "ingested"), r(2, "retry"), r(3, "ingested")]);
  check("cursor = 1 (holds before UID 2, even though UID 3 succeeded)", next === 1, next);
}

console.log("\nTest 3: A held UID resolving on the next pass advances the cursor past it");
{
  // Continuing from Test 2's cursor=1 — next pass re-fetches [2:*], which
  // naturally re-includes UID 3 (already ingested last time; dedupe makes
  // reprocessing it safe — it'll come back as 'skipped' this time).
  const next = computeNextCursor(1, [r(2, "ingested"), r(3, "skipped")]);
  check("cursor = 3", next === 3, next);
}

console.log("\nTest 4: UIDs at or below the current cursor are ignored");
{
  const next = computeNextCursor(5, [r(3, "ingested"), r(4, "skipped")]);
  check("cursor stays at 5", next === 5, next);
}

console.log("\nTest 5: Empty results leave the cursor unchanged");
{
  const next = computeNextCursor(5, []);
  check("cursor stays at 5", next === 5, next);
}

console.log("\nTest 6: A lone 'retry' at the front never advances the cursor");
{
  const next = computeNextCursor(0, [r(1, "retry")]);
  check("cursor stays at 0", next === 0, next);
}

console.log("\nTest 7: Out-of-order input is sorted before processing");
{
  const next = computeNextCursor(0, [r(2, "ingested"), r(1, "ingested")]);
  check("cursor = 2 despite input order", next === 2, next);
}

console.log("\nTest 8: A gap in UIDs still advances the cursor to the highest terminal UID seen");
{
  // UIDs 1-4 aren't present in this batch (e.g. deleted/expunged) — UID 5 is
  // the first one we actually see, and it's terminal, so we trust it.
  const next = computeNextCursor(0, [r(5, "ingested")]);
  check("cursor = 5", next === 5, next);
}

console.log("\nTest 9: A retry blocks the cursor even across a UID gap");
{
  const next = computeNextCursor(0, [r(5, "retry"), r(9, "ingested")]);
  check("cursor stays at 0 (UID 5 still outstanding)", next === 0, next);
}

console.log("\n" + "─".repeat(40) + "\n");
if (failures > 0) {
  console.error(`${failures}/${total} checks FAILED`);
  process.exit(1);
} else {
  console.log(`All ${total} checks passed.`);
  process.exit(0);
}
