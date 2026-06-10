// SMS bank-alert parser.
//
// Turns a raw bank credit-alert SMS (forwarded automatically from the school
// phone) into a normalized transaction we can drop into the existing
// reconciliation queue. Only CREDIT alerts are ingested; debits, OTPs, balance
// enquiries and marketing are skipped.
//
// Supported (confirmed) formats: Zenith, Fidelity, Access — plus a generic
// credit-alert fallback for any future/variant shape.

import { generateFingerprint } from "./pdf-parser";

export interface ParsedSms {
  bankName: string;        // Zenith, Fidelity, Access, Unknown
  amount: number;          // credit amount
  transactionDate: string; // normalized DD/MM/YYYY
  rawDescription: string;  // payer / narration
  reference?: string;
  maskedAccount?: string;  // e.g. 238****209, **0025 — routing key
  balanceKey?: string;     // running balance, used as fingerprint dedupe key
  fingerprint: string;
}

export type SmsParseResult =
  | { ok: true; data: ParsedSms }
  | { ok: false; reason: string };

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function normalizeDate(raw: string): string | null {
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    return `${dmy[1].padStart(2, "0")}/${dmy[2].padStart(2, "0")}/${dmy[3]}`;
  }
  // DD/MON/YY or DD-MON-YYYY (Fidelity, e.g. 09/JUN/26)
  const dMonY = raw.match(/(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{2,4})/);
  if (dMonY) {
    const mon = MONTHS[dMonY[2].toLowerCase()];
    if (!mon) return null;
    let year = dMonY[3];
    if (year.length === 2) year = `20${year}`;
    return `${dMonY[1].padStart(2, "0")}/${mon}/${year}`;
  }
  return null;
}

function parseAmount(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) || n <= 0 ? null : n;
}

function firstMatch(body: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = body.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return undefined;
}

function detectBank(body: string, sender?: string): string {
  const hay = `${sender || ""} ${body}`.toLowerCase();
  if (/\*966#/.test(body) || /zenith/.test(hay)) return "Zenith";
  if (/fidelity/.test(hay)) return "Fidelity";
  if (/access/.test(hay)) return "Access";
  // Structural hints when the bank name is absent.
  if (/avail\s*bal/i.test(body) && /\bacc\s*:/i.test(body)) return "Access";
  if (/\bdesc\s*:/i.test(body) && /\bdt\s*:/i.test(body)) return "Fidelity";
  return "Unknown";
}

// Zenith: description is the line immediately before "CR Amt:".
function zenithDescription(body: string): string | undefined {
  const lines = body.split(/\r?\n/).map((l) => l.trim());
  const idx = lines.findIndex((l) => /CR\s*Amt\s*:/i.test(l));
  if (idx <= 0) return undefined;
  for (let i = idx - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;
    if (/^(Acct?|DT)\s*:/i.test(line)) continue;
    return line;
  }
  return undefined;
}

export function parseBankAlertSms(body: string, sender?: string): SmsParseResult {
  if (!body || !body.trim()) {
    return { ok: false, reason: "empty body" };
  }

  const bankName = detectBank(body, sender);

  // Credit vs debit detection.
  const hasCredit =
    /\bCR\s*Amt\s*:/i.test(body) ||
    /\bCR\s*:/i.test(body) ||
    /(^|\n)\s*Credit\b/i.test(body) ||
    /\bcredited\b/i.test(body);
  const hasDebit =
    /\bDR\s*Amt\s*:/i.test(body) ||
    /\bDR\s*:/i.test(body) ||
    /(^|\n)\s*Debit\b/i.test(body) ||
    /\bdebited\b/i.test(body) ||
    /\bwithdrawn\b/i.test(body);

  if (hasDebit && !hasCredit) {
    return { ok: false, reason: "debit alert — skipped" };
  }
  if (!hasCredit) {
    return { ok: false, reason: "not a credit alert" };
  }

  // Amount.
  const amountRaw = firstMatch(body, [
    /CR\s*Amt\s*:\s*(?:NGN|N|₦)?\s*([\d,]+\.?\d*)/i, // Zenith
    /CR\s*:\s*(?:NGN|N|₦)?\s*([\d,]+\.?\d*)/i,        // Fidelity
    /Amt\s*:\s*(?:NGN|N|₦)?\s*([\d,]+\.?\d*)/i,       // Access
    /(?:NGN|₦)\s*([\d,]+\.?\d*)/i,                    // generic
  ]);
  const amount = parseAmount(amountRaw);
  if (amount === null) {
    return { ok: false, reason: "no credit amount found" };
  }

  // Date.
  const dateRaw = firstMatch(body, [
    /DT\s*:\s*([0-9]{1,2}[\/\-][A-Za-z0-9]{2,4}[\/\-][0-9]{2,4})/i,
    /Date\s*:\s*([0-9]{1,2}[\/\-][A-Za-z0-9]{2,4}[\/\-][0-9]{2,4})/i,
  ]);
  let transactionDate = dateRaw ? normalizeDate(dateRaw) : null;
  if (!transactionDate) {
    // Fallback: first date-looking token anywhere.
    const anyDate =
      body.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/) ||
      body.match(/(\d{1,2}[\/\-][A-Za-z]{3}[\/\-]\d{2,4})/);
    transactionDate = anyDate ? normalizeDate(anyDate[1]) : null;
  }
  if (!transactionDate) {
    // Last resort: today, so a valid credit is never dropped for a date quirk.
    const now = new Date();
    transactionDate = `${String(now.getDate()).padStart(2, "0")}/${String(
      now.getMonth() + 1
    ).padStart(2, "0")}/${now.getFullYear()}`;
  }

  // Masked account number (routing key). "Acct:" (Zenith/Fidelity) or "Acc:" (Access).
  const maskedAccount = firstMatch(body, [
    /\bAcc(?:t)?\s*:\s*([0-9xX*]+)/i,
  ]);

  // Description / payer narration.
  let rawDescription =
    bankName === "Zenith"
      ? zenithDescription(body)
      : firstMatch(body, [/Desc\s*:\s*(.+)/i]);
  if (!rawDescription) {
    rawDescription = firstMatch(body, [/Desc\s*:\s*(.+)/i]) || zenithDescription(body);
  }
  if (!rawDescription || !rawDescription.trim()) {
    rawDescription = `${bankName} credit alert`;
  }
  rawDescription = rawDescription.trim();

  // Reference (optional).
  const reference = firstMatch(body, [
    /Ref(?:erence)?\s*(?:Code|No)?\s*:\s*([A-Za-z0-9\/-]+)/i,
  ]);

  // Balance — used as a dedupe key so two legitimate same-day/same-amount/
  // same-payer credits don't collapse into one fingerprint, and so a Zenith
  // SMS dedupes against the later Zenith PDF (whose parser also keys on balance).
  const balanceRaw = firstMatch(body, [
    /Avail\s*Bal\s*:\s*(?:NGN|N|₦)?\s*([\d,]+\.?\d*)/i,
    /Bal\s*:\s*(?:NGN|N|₦)?\s*([\d,]+\.?\d*)/i,
  ]);
  const balanceKey = balanceRaw ? balanceRaw.replace(/,/g, "") : undefined;

  const fingerprint = generateFingerprint(
    transactionDate,
    amount,
    rawDescription,
    balanceKey
  );

  return {
    ok: true,
    data: {
      bankName,
      amount,
      transactionDate,
      rawDescription,
      reference,
      maskedAccount,
      balanceKey,
      fingerprint,
    },
  };
}
