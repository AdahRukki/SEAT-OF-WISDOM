/**
 * Regression tests for the bank-statement PDF parsers.
 *
 * Runs every fixture PDF in `attached_assets/` through `detectBankFormat` +
 * `parseTransactions` and asserts the detected bank, credit-transaction count,
 * and credit-sum match a known-good baseline. This catches the silent
 * "vendor changed their export format" regressions that hit Moniepoint
 * (task #97) and Zenith (task #92).
 *
 * Run with:  npx tsx scripts/test-pdf-parsers.ts
 *
 * To add a new fixture: drop the PDF into `attached_assets/` and append one
 * row to FIXTURES below. Baselines are produced by running the parser once
 * against the new PDF and pasting the numbers it prints.
 */
import fs from "fs";
import path from "path";
import {
  detectBankFormat,
  extractTextFromPDF,
  parseTransactions,
} from "../server/pdf-parser";

type Bank = ReturnType<typeof detectBankFormat>;

interface Fixture {
  file: string;
  bank: Bank;
  count: number;
  sum: number;
  note: string;
}

// Baselines were captured by running the current parser against each real-world
// fixture in `attached_assets/`. If a parser change moves any of these numbers,
// either fix the parser or update the baseline + note here in the same commit.
const FIXTURES: Fixture[] = [
  {
    file: "pge_1_testing_statement_upload_1775466166118.pdf",
    bank: "fidelity",
    count: 13,
    sum: 805000,
    note: "Fidelity Bank — single-page test statement (only Fidelity fixture).",
  },
  {
    file: "account-statement_(2)_1776209573886.pdf",
    bank: "moniepoint",
    count: 59,
    sum: 3181300,
    note: "Moniepoint POS — newer fragmented-date layout (task #97 fixture).",
  },
  {
    file: "account-statement_(2)_1776214542522.pdf",
    bank: "moniepoint",
    count: 59,
    sum: 3181300,
    note: "Moniepoint POS — re-upload of the same statement, must match exactly.",
  },
  {
    file: "account_statement_5203881581_2026-04-30_(2)_1777563039510.pdf",
    bank: "moniepoint",
    count: 10,
    sum: 556389,
    note: "Moniepoint POS — small recent statement.",
  },
  {
    file: "ZEN_20251231_20260130_178_AAAAA_822_-1307961659_1769774464079_1769971255430.pdf",
    bank: "zenith",
    count: 318,
    sum: 29397011.25,
    note: "Zenith Bank — large month-long statement (task #92 fixture).",
  },
  {
    file: "ZEN_20260426_20260427_385_AAAAA_209_1446692595_1777321293647_1777327116248.pdf",
    bank: "zenith",
    count: 11,
    sum: 576500,
    note: "Zenith Bank — short single-day statement.",
  },
  {
    file: "Statement_1929655748_20260224105013_1776209637875.pdf",
    bank: "access",
    count: 145,
    sum: 6099314.5,
    note: "Access-style export (Posted Date / Debit (NGN) / Credit (NGN) columns).",
  },
  {
    file: "Statement_1929655748_20260422084601_1776845344578.pdf",
    bank: "access",
    count: 62,
    sum: 4153243.09,
    note: "Access-style export — later month, fewer transactions.",
  },
];

const FIXTURE_DIR = "attached_assets";

interface Result {
  fixture: Fixture;
  ok: boolean;
  failures: string[];
  actual?: { bank: Bank; count: number; sum: number };
}

function approxEq(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

async function runFixture(fx: Fixture): Promise<Result> {
  const fullPath = path.join(FIXTURE_DIR, fx.file);
  const failures: string[] = [];
  if (!fs.existsSync(fullPath)) {
    return { fixture: fx, ok: false, failures: [`fixture file missing: ${fullPath}`] };
  }
  const buf = fs.readFileSync(fullPath);
  const text = await extractTextFromPDF(buf);
  const bank = detectBankFormat(text);
  const txs = parseTransactions(text);
  const sum = txs.reduce((s, t) => s + t.credit, 0);

  if (bank !== fx.bank) failures.push(`bank: expected ${fx.bank}, got ${bank}`);
  if (txs.length !== fx.count) failures.push(`count: expected ${fx.count}, got ${txs.length}`);
  if (!approxEq(sum, fx.sum)) failures.push(`sum: expected ${fx.sum}, got ${sum.toFixed(2)}`);

  return { fixture: fx, ok: failures.length === 0, failures, actual: { bank, count: txs.length, sum: +sum.toFixed(2) } };
}

(async () => {
  console.log(`Running ${FIXTURES.length} PDF parser regression fixtures...\n`);
  const results: Result[] = [];
  for (const fx of FIXTURES) {
    process.stdout.write(`  ${fx.file} ... `);
    try {
      const r = await runFixture(fx);
      results.push(r);
      console.log(r.ok ? "PASS" : "FAIL");
      if (!r.ok) {
        for (const msg of r.failures) console.log(`      - ${msg}`);
        if (r.actual) console.log(`      actual: ${JSON.stringify(r.actual)}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ fixture: fx, ok: false, failures: [`threw: ${message}`] });
      console.log("FAIL (threw)");
      console.log(`      - ${message}`);
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  console.log(`\nSummary: ${passed} passed, ${failed} failed (of ${results.length}).`);
  process.exit(failed === 0 ? 0 : 1);
})();
