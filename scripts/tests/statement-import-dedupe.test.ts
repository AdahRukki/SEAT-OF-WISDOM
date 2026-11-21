import test from "node:test";
import assert from "node:assert/strict";
import {
  planStatementImport,
  type ExistingCredit,
  type StatementCredit,
} from "../../server/statement-import-dedupe";

const schoolId = "school-one";
const incoming = (overrides: Partial<StatementCredit> = {}): StatementCredit => ({
  date: "19/11/2026",
  credit: 9500,
  rawDescription: "CIP CR/ OLUCHUKWU AMANDA JAMES/Transfer from OLUCHUKWU AMANDA JAMES",
  fingerprint: "statement-hash",
  ...overrides,
});
const email = (overrides: Partial<ExistingCredit> = {}): ExistingCredit => ({
  id: "email-1",
  schoolId,
  transactionDate: new Date("2026-11-19T00:00:00.000Z"),
  amount: "9500.00",
  transactionType: "credit",
  rawDescription: "CIP CR/ OLUCHUKWU AMANDA JAMES/Transfer from OLUCHUKWU AMANDA JAMES",
  fingerprint: "email-hash-includes-running-balance",
  source: "email",
  bankFormat: null,
  emailFrom: "transaction-alert@zenithbank.com",
  ...overrides,
});
const plan = (rows: StatementCredit[], existing: ExistingCredit[], bankFormat = "zenith") =>
  planStatementImport(rows, existing, { schoolId, bankFormat });

test("same real credit from Zenith email is skipped despite a different SHA fingerprint", () => {
  const result = plan([incoming()], [email()]);
  assert.equal(result.imports.length, 0);
  assert.deepEqual(result.skipped.map(t => t.existingTransactionId), ["email-1"]);
  assert.equal(result.skipped[0].reason, "existing_bank_credit");
});

test("same amount and day but different description is NOT an automatic duplicate", () => {
  const result = plan([incoming()], [email({ rawDescription: "TRF FROM OLUCHUKWU OTHER PAYMENT" })]);
  assert.equal(result.imports.length, 1);
  assert.equal(result.skipped.length, 0);
});

test("same narration and amount at another bank is NOT automatically skipped", () => {
  const result = plan([incoming()], [email({ emailFrom: "alerts@accessbankplc.com" })]);
  assert.equal(result.imports.length, 1);
});

test("same student at another school is NOT automatically skipped", () => {
  const result = plan([incoming()], [email({ schoolId: "school-two" })]);
  assert.equal(result.imports.length, 1);
});

test("different date is NOT an automatic duplicate", () => {
  const result = plan([incoming()], [email({ transactionDate: new Date("2026-11-18T00:00:00.000Z") })]);
  assert.equal(result.imports.length, 1);
});

test("two genuine identical credits with only one existing alert preserve the other", () => {
  const result = plan([
    incoming({ fingerprint: "stmt-balance-1" }),
    incoming({ fingerprint: "stmt-balance-2" }),
  ], [email()]);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.imports.length, 1);
  assert.equal(result.imports[0].fingerprint, "stmt-balance-2");
});

test("two existing email alerts consume two matching statement credits", () => {
  const result = plan([
    incoming({ fingerprint: "stmt-a" }),
    incoming({ fingerprint: "stmt-b" }),
  ], [email(), email({ id: "email-2", fingerprint: "email-balance-2" })]);
  assert.equal(result.skipped.length, 2);
  assert.equal(result.imports.length, 0);
});

test("re-upload of existing statement credit is idempotent", () => {
  const result = plan([incoming()], [email({
    id: "statement-1", source: "statement", bankFormat: "zenith",
    fingerprint: "statement-hash", emailFrom: null,
  })]);
  assert.equal(result.imports.length, 0);
  assert.equal(result.skipped[0].reason, "exact_fingerprint");
});

test("legacy emails are matched through their registered masked bank account", () => {
  const result = planStatementImport([incoming()], [email({
    emailFrom: null, emailSubject: null, smsAccount: "**0209",
  })], {
    schoolId, bankFormat: "zenith",
    accounts: [{ maskedAccountNumber: "**0209", bankName: "Zenith Bank" }],
  });
  assert.equal(result.imports.length, 0);
  assert.equal(result.skipped.length, 1);
});

test("unknown bank identity does not silently discard a possible real payment", () => {
  const result = plan([incoming()], [email({
    emailFrom: null, emailSubject: null, smsAccount: null,
  })]);
  assert.equal(result.imports.length, 1);
});

test("no bank format available for Excel does not cross-match ambiguous accounts", () => {
  const result = planStatementImport([incoming()], [email()], { schoolId, bankFormat: undefined });
  assert.equal(result.imports.length, 1);
});

test("same name only is insufficient to skip a genuine second credit", () => {
  const result = plan([incoming()], [email({ rawDescription: "TRF FROM OLUCHUKWU AMANDA JAMES" })]);
  assert.equal(result.imports.length, 1);
});
