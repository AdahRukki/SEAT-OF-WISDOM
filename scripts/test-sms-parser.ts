/**
 * Regression tests for the SMS bank-alert parser (`server/sms-parser.ts`).
 *
 * Feeds the confirmed real-world credit-alert samples (2 Zenith accounts,
 * Access, Fidelity) plus several "must be ignored" cases (debit, OTP,
 * marketing) through `parseBankAlertSms` and asserts the parsed bank, amount,
 * masked account, normalized date, and credit/skip verdict.
 *
 * Run with:  npx tsx scripts/test-sms-parser.ts
 *
 * To add a case: append a row to CASES below. Credit cases set `expect`;
 * skip cases set `skip: true`.
 */
import { parseBankAlertSms } from "../server/sms-parser";

interface CreditExpect {
  bankName: string;
  amount: number;
  maskedAccount?: string;
  transactionDate: string; // normalized DD/MM/YYYY
}

interface Case {
  name: string;
  body: string;
  sender?: string;
  skip?: boolean; // true = should NOT be ingested (debit/OTP/etc.)
  expect?: CreditExpect;
}

const CASES: Case[] = [
  {
    name: "Zenith — school 1 Ikpoto (238****209)",
    sender: "Zenith",
    body: [
      "Acct:238****209",
      "DT:08/06/2026 10:47:37 AM",
      "ISW UCHE OGADIMM Trf for Custo",
      "CR Amt:48,000.00",
      "Bal:1,043,716.95",
      "Dial *966# for quick airtime/Data purchase",
    ].join("\n"),
    expect: { bankName: "Zenith", amount: 48000, maskedAccount: "238****209", transactionDate: "08/06/2026" },
  },
  {
    name: "Zenith — school 4 Akwuose (217****822)",
    sender: "Zenith",
    body: [
      "Acct:217****822",
      "DT:09/06/2026 09:12:01 AM",
      "CIP CR/ MUIDEEN OLALEKAN RAFIU",
      "CR Amt:120,500.00",
      "Bal:2,500,000.00",
      "Dial *966# for quick airtime/Data purchase",
    ].join("\n"),
    expect: { bankName: "Zenith", amount: 120500, maskedAccount: "217****822", transactionDate: "09/06/2026" },
  },
  {
    name: "Fidelity — school 2 Bonsac (**0025)",
    sender: "Fidelity",
    body: [
      "Acct:**0025",
      "CR:N28,000.00",
      "Desc:AWUENYI COLLIET/FIPUSSDAWUENYI COLLIETH UUSSD",
      "DT:09/JUN/26 15:29PM",
      "Bal:N13,854,945.80CR",
      "Your Fidelity Naira Cards are now enabled for cross-border transactions...",
    ].join("\n"),
    expect: { bankName: "Fidelity", amount: 28000, maskedAccount: "**0025", transactionDate: "09/06/2026" },
  },
  {
    name: "Access — school 3 Akwuofor (192****748)",
    sender: "Access",
    body: [
      "Credit",
      "Amt:NGN10,000.00",
      "Acc:192****748",
      "Desc:025NIPL261600232/mimi cashout/mimi cashout Nomba Transfer 1",
      "Date:09/06/2026",
      "Avail Bal:NGN27,175,953.19",
      "Total",
    ].join("\n"),
    expect: { bankName: "Access", amount: 10000, maskedAccount: "192****748", transactionDate: "09/06/2026" },
  },
  {
    name: "Zenith debit — must be ignored",
    sender: "Zenith",
    body: [
      "Acct:238****209",
      "DT:08/06/2026 11:00:00 AM",
      "POS PURCHASE SHOPRITE",
      "DR Amt:5,000.00",
      "Bal:1,038,716.95",
    ].join("\n"),
    skip: true,
  },
  {
    name: "OTP message — must be ignored",
    sender: "Zenith",
    body: "Your one-time password (OTP) is 123456. Do not share it with anyone.",
    skip: true,
  },
  {
    name: "Marketing message — must be ignored",
    sender: "Access",
    body: "Enjoy zero charges on transfers this weekend! Dial *901# to learn more.",
    skip: true,
  },
];

interface Result {
  name: string;
  ok: boolean;
  failures: string[];
}

function runCase(c: Case): Result {
  const failures: string[] = [];
  const res = parseBankAlertSms(c.body, c.sender);

  if (c.skip) {
    if (res.ok) failures.push(`expected SKIP but parser accepted it as a credit (amount ${res.data.amount})`);
    return { name: c.name, ok: failures.length === 0, failures };
  }

  if (!res.ok) {
    failures.push(`expected a credit but parser skipped: ${res.reason}`);
    return { name: c.name, ok: false, failures };
  }

  const exp = c.expect!;
  const got = res.data;
  if (got.bankName !== exp.bankName) failures.push(`bank: expected ${exp.bankName}, got ${got.bankName}`);
  if (Math.abs(got.amount - exp.amount) > 0.01) failures.push(`amount: expected ${exp.amount}, got ${got.amount}`);
  if (got.transactionDate !== exp.transactionDate) failures.push(`date: expected ${exp.transactionDate}, got ${got.transactionDate}`);
  if (exp.maskedAccount && got.maskedAccount !== exp.maskedAccount) {
    failures.push(`maskedAccount: expected ${exp.maskedAccount}, got ${got.maskedAccount}`);
  }
  if (!got.fingerprint) failures.push(`missing fingerprint`);

  return { name: c.name, ok: failures.length === 0, failures };
}

(() => {
  console.log(`Running ${CASES.length} SMS parser cases...\n`);
  const results = CASES.map((c) => {
    process.stdout.write(`  ${c.name} ... `);
    const r = runCase(c);
    console.log(r.ok ? "PASS" : "FAIL");
    if (!r.ok) for (const f of r.failures) console.log(`      - ${f}`);
    return r;
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\nSummary: ${passed} passed, ${failed} failed (of ${results.length}).`);
  process.exit(failed === 0 ? 0 : 1);
})();
