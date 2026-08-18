/**
 * Regression test: email bank-alert parser.
 *
 * Runs the confirmed real-world Fidelity and Zenith email HTML fixtures
 * through parseEmailAlert() and asserts that every field — amount, masked
 * account, date, description, bank name — is extracted correctly.
 *
 * Also verifies that debit alerts and non-credit emails return ok:false.
 *
 * Does NOT hit the database; safe to run at any time.
 *
 * Run with:  npx tsx scripts/test-email-bank-parser.ts
 */

import { parseEmailAlert } from "../server/email-bank-parser";

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

// ── HTML fixtures — approximations of the real bank emails ───────────────────
// Constructed from real email samples shared by the school admin.
// The HTML structure matches what the banks actually send; ₦ is encoded as
// the HTML entity &#8358; as it commonly appears in Nigerian bank emails.

const FIDELITY_CREDIT_HTML = `
<!DOCTYPE html>
<html><body>
<div>Download our Fidelity Online, and enjoy new features like Flashkey,
RTGS and Online Purchase Service. Dial *770*PhoneNo# to block your account.</div>
<p>&#8358;39,500.00 CR</p>
<table>
  <tr><td>Account</td><td>xxxxxx0025</td></tr>
  <tr><td>Account Name</td><td>FAITH ELOHOR ADAH</td></tr>
  <tr><td>Narration</td><td>TRF PATRICIA To FAITH|AT132_TRF|2MPT8neta|20896665</td></tr>
  <tr><td>Transaction Reference</td><td>S99019608</td></tr>
  <tr><td>Date/Time</td><td>Aug 18, 2026 11:51:43 AM</td></tr>
  <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
  <tr><td>Available Balance</td><td>&#8358;1,827,112.00CR</td></tr>
</table>
</body></html>
`;

// Zenith email for account 238****209 (School 1), amount 70,000
const ZENITH_CREDIT_HTML_1 = `
<!DOCTYPE html>
<html><body>
<p>Zenith Bank Advert</p>
<h2>CREDIT TRANSACTION NOTIFICATION</h2>
<p>Tuesday, August 18, 2026 09:28:16 AM</p>
<p>Dear FAITH ADAH,</p>
<p>Please see below details of the transaction on your account:</p>
<table>
  <tr><td>Account Number</td><td>238****209</td></tr>
  <tr><td>Date of Transaction</td><td>18/08/2026</td></tr>
  <tr><td>Amount</td><td>70,000.00</td></tr>
  <tr><td>Value Date</td><td>18/08/2026</td></tr>
  <tr><td>Currency</td><td>NGN</td></tr>
  <tr><td>Description</td><td>CIP CR/ JOB ALEX ENYA/Transfer from JOB ALEX ENYA</td></tr>
  <tr><td>Reference Code</td><td></td></tr>
  <tr><td>Branch</td><td>EZENEI AVENUE</td></tr>
  <tr><td>Transaction Type</td><td>CREDIT</td></tr>
  <tr><td>Available Balance</td><td>155,881.17</td></tr>
  <tr><td>Current Balance</td><td>155,881.17</td></tr>
</table>
<p>SAFEGUARD YOUR FINANCIAL INFORMATION. Do not share your details.</p>
</body></html>
`;

// Zenith email for account 217****822 (School 4), amount 500
const ZENITH_CREDIT_HTML_2 = `
<!DOCTYPE html>
<html><body>
<h2>CREDIT TRANSACTION NOTIFICATION</h2>
<p>Tuesday, August 18, 2026 07:19:37 PM</p>
<p>Dear FAITH ELOHOR ADAH,</p>
<table>
  <tr><td>Account Number</td><td>217****822</td></tr>
  <tr><td>Date of Transaction</td><td>18/08/2026</td></tr>
  <tr><td>Amount</td><td>500.00</td></tr>
  <tr><td>Value Date</td><td>18/08/2026</td></tr>
  <tr><td>Currency</td><td>NGN</td></tr>
  <tr><td>Description</td><td>CIP CR/ OGHENERUKEVWE PRECIOUS ADAH/Transfer from OGHENERUKEVWE PRECIOUS ADAH</td></tr>
  <tr><td>Reference Code</td><td></td></tr>
  <tr><td>Branch</td><td>EZENEI AVENUE</td></tr>
  <tr><td>Transaction Type</td><td>CREDIT</td></tr>
  <tr><td>Available Balance</td><td>1,900,822.44</td></tr>
  <tr><td>Current Balance</td><td>1,900,822.44</td></tr>
</table>
</body></html>
`;

// Fidelity debit — must be rejected
const FIDELITY_DEBIT_HTML = `
<!DOCTYPE html>
<html><body>
<p>&#8358;5,000.00 DR</p>
<table>
  <tr><td>Account</td><td>xxxxxx0025</td></tr>
  <tr><td>Narration</td><td>ATM WITHDRAWAL</td></tr>
  <tr><td>Date/Time</td><td>Aug 18, 2026 02:00:00 PM</td></tr>
  <tr><td>Available Balance</td><td>&#8358;1,822,112.00DR</td></tr>
</table>
</body></html>
`;

// Zenith debit — must be rejected
const ZENITH_DEBIT_HTML = `
<!DOCTYPE html>
<html><body>
<h2>DEBIT TRANSACTION NOTIFICATION</h2>
<table>
  <tr><td>Account Number</td><td>238****209</td></tr>
  <tr><td>Date of Transaction</td><td>18/08/2026</td></tr>
  <tr><td>Amount</td><td>10,000.00</td></tr>
  <tr><td>Currency</td><td>NGN</td></tr>
  <tr><td>Description</td><td>ATM WITHDRAWAL</td></tr>
  <tr><td>Transaction Type</td><td>DEBIT</td></tr>
  <tr><td>Available Balance</td><td>145,881.17</td></tr>
</table>
</body></html>
`;

// OTP / non-credit email — must be rejected
const OTP_HTML = `
<!DOCTYPE html>
<html><body>
<p>Your Zenith Bank OTP is: 123456. Valid for 5 minutes. Do not share.</p>
</body></html>
`;

// ── Test runner ───────────────────────────────────────────────────────────────

async function main() {
  console.log(`Running ${6} email parser fixtures...\n`);

  // ── Fixture 1: Fidelity credit alert ────────────────────────────────────────
  console.log("Fixture 1: Fidelity credit alert (₦39,500 · xxxxxx0025 · 18/08/2026)");
  const r1 = parseEmailAlert({
    from: "ibanking@fidelitybank.ng",
    subject: "Credit Alert Notification",
    html: FIDELITY_CREDIT_HTML,
  });
  check("ok:true", r1.ok === true, r1.ok ? "" : (r1 as any).reason);
  if (r1.ok) {
    const d = r1.data;
    check("bankName = Fidelity", d.bankName === "Fidelity", d.bankName);
    check("amount = 39500", d.amount === 39500, d.amount);
    check("maskedAccount = xxxxxx0025", d.maskedAccount === "xxxxxx0025", d.maskedAccount);
    check("transactionDate = 18/08/2026", d.transactionDate === "18/08/2026", d.transactionDate);
    check(
      "rawDescription contains narration",
      d.rawDescription.includes("TRF PATRICIA"),
      d.rawDescription.slice(0, 60)
    );
    check("balanceKey present", !!d.balanceKey, d.balanceKey);
    check("fingerprint is sha256 hex", /^[0-9a-f]{64}$/.test(d.fingerprint), d.fingerprint.slice(0, 16));
    console.log(`  balanceKey: ${d.balanceKey}`);
    console.log(`  fingerprint: ${d.fingerprint.slice(0, 16)}…\n`);
  } else {
    console.error(`  reason: ${(r1 as any).reason}\n`);
  }

  // ── Fixture 2: Zenith credit alert — account 238****209 ─────────────────────
  console.log("Fixture 2: Zenith credit alert (₦70,000 · 238****209 · 18/08/2026)");
  const r2 = parseEmailAlert({
    from: "ebusinessgroup@zenithbank.com",
    subject: "Credit Transaction Notification",
    html: ZENITH_CREDIT_HTML_1,
  });
  check("ok:true", r2.ok === true, r2.ok ? "" : (r2 as any).reason);
  if (r2.ok) {
    const d = r2.data;
    check("bankName = Zenith", d.bankName === "Zenith", d.bankName);
    check("amount = 70000", d.amount === 70000, d.amount);
    check("maskedAccount = 238****209", d.maskedAccount === "238****209", d.maskedAccount);
    check("transactionDate = 18/08/2026", d.transactionDate === "18/08/2026", d.transactionDate);
    check(
      "rawDescription contains payer name",
      d.rawDescription.includes("JOB ALEX ENYA"),
      d.rawDescription.slice(0, 60)
    );
    check("balanceKey present", !!d.balanceKey, d.balanceKey);
    check("fingerprint is sha256 hex", /^[0-9a-f]{64}$/.test(d.fingerprint), d.fingerprint.slice(0, 16));
    console.log(`  balanceKey: ${d.balanceKey}`);
    console.log(`  fingerprint: ${d.fingerprint.slice(0, 16)}…\n`);
  } else {
    console.error(`  reason: ${(r2 as any).reason}\n`);
  }

  // ── Fixture 3: Zenith credit alert — account 217****822 ─────────────────────
  console.log("Fixture 3: Zenith credit alert (₦500 · 217****822 · 18/08/2026)");
  const r3 = parseEmailAlert({
    from: "ebusinessgroup@zenithbank.com",
    subject: "Credit Transaction Notification",
    html: ZENITH_CREDIT_HTML_2,
  });
  check("ok:true", r3.ok === true, r3.ok ? "" : (r3 as any).reason);
  if (r3.ok) {
    const d = r3.data;
    check("bankName = Zenith", d.bankName === "Zenith", d.bankName);
    check("amount = 500", d.amount === 500, d.amount);
    check("maskedAccount = 217****822", d.maskedAccount === "217****822", d.maskedAccount);
    check("transactionDate = 18/08/2026", d.transactionDate === "18/08/2026", d.transactionDate);
    check(
      "rawDescription contains payer name",
      d.rawDescription.includes("OGHENERUKEVWE"),
      d.rawDescription.slice(0, 60)
    );
    console.log(`  balanceKey: ${d.balanceKey}`);
    console.log(`  fingerprint: ${d.fingerprint.slice(0, 16)}…\n`);
  } else {
    console.error(`  reason: ${(r3 as any).reason}\n`);
  }

  // ── Fixture 4: Fidelity debit — must be rejected ─────────────────────────────
  console.log("Fixture 4: Fidelity debit alert — must return ok:false");
  const r4 = parseEmailAlert({
    from: "ibanking@fidelitybank.ng",
    subject: "Debit Alert Notification",
    html: FIDELITY_DEBIT_HTML,
  });
  check("ok:false", r4.ok === false, r4.ok ? "was unexpectedly ok" : "");
  if (!r4.ok) {
    check("reason mentions debit", r4.reason.toLowerCase().includes("debit"), r4.reason);
    console.log(`  reason: ${r4.reason}\n`);
  }

  // ── Fixture 5: Zenith debit — must be rejected ────────────────────────────────
  console.log("Fixture 5: Zenith debit alert — must return ok:false");
  const r5 = parseEmailAlert({
    from: "ebusinessgroup@zenithbank.com",
    subject: "Debit Transaction Notification",
    html: ZENITH_DEBIT_HTML,
  });
  check("ok:false", r5.ok === false, r5.ok ? "was unexpectedly ok" : "");
  if (!r5.ok) {
    check("reason mentions debit", r5.reason.toLowerCase().includes("debit"), r5.reason);
    console.log(`  reason: ${r5.reason}\n`);
  }

  // ── Fixture 6: OTP / non-credit — must be rejected ───────────────────────────
  console.log("Fixture 6: OTP email — must return ok:false");
  const r6 = parseEmailAlert({
    from: "ebusinessgroup@zenithbank.com",
    subject: "Your OTP",
    html: OTP_HTML,
  });
  check("ok:false", r6.ok === false, r6.ok ? "was unexpectedly ok" : "");
  if (!r6.ok) {
    console.log(`  reason: ${r6.reason}\n`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log("─".repeat(50));
  if (failures > 0) {
    console.error(`\n${failures} of ${total} check(s) FAILED`);
    process.exit(1);
  }
  console.log(`\nAll ${total} checks passed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Test run crashed:", err);
  process.exit(1);
});
