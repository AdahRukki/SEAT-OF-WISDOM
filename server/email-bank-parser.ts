// Email bank-alert parser.
//
// Converts an HTML credit-alert email (from a monitored Gmail inbox) into a
// normalised transaction ready for the reconciliation queue.  Only CREDIT
// alerts are accepted; debits, OTPs, balance enquiries, and marketing are
// skipped.
//
// Confirmed real-world formats:
//   Fidelity Bank  (ibanking@fidelitybank.ng)
//   Zenith Bank    (ebusinessgroup@zenithbank.com)
//
// Architecture:
//   1. HTML → tab-table text: htmlToTabText() converts each <tr> into a
//      tab-separated line ("Label\tValue") so table structure survives HTML
//      stripping.  Non-table block elements become plain newlines.
//   2. extractFields() builds a Map<normalised-label → value> for O(1) lookup.
//   3. Bank-specific parsers (parseFidelityEmail / parseZenithEmail) read the
//      map, validate credit/debit signals, and return a ParsedEmailAlert.
//   4. generateFingerprint(date, amount, description, balance) — the same
//      function used by the SMS and PDF parsers — so a transaction that
//      arrives via both email and SMS is deduplicated automatically.

import { generateFingerprint } from "./pdf-parser";
import { parse as parseHtml } from "node-html-parser";

// ── Public types ──────────────────────────────────────────────────────────────

export interface ParsedEmailAlert {
  bankName: string;
  amount: number;
  transactionDate: string; // DD/MM/YYYY
  rawDescription: string;
  reference?: string;
  /** Masked account — routing key (matched against school_bank_accounts). */
  maskedAccount?: string;
  balanceKey?: string; // running balance used as fingerprint dedupe key
  fingerprint: string;
}

export type EmailParseResult =
  | { ok: true; data: ParsedEmailAlert }
  | { ok: false; reason: string };

// ── MIME body extraction (kept from original — extractBodyFromRfc2822) ────────

function decodeQP(s: string): string {
  return s
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

export function extractBodyFromRfc2822(source: Buffer): { html: string; text: string } {
  const raw = source.toString("binary");

  let html = "";
  let text = "";

  const extractPart = (mimeType: "text/html" | "text/plain"): string => {
    const re = new RegExp(
      `Content-Type:\\s*${mimeType.replace("/", "\\/")}[^\\r\\n]*\\r?\\n` +
        `(?:[^\\r\\n]+\\r?\\n)*\\r?\\n` +
        `([\\s\\S]+?)(?=\\r?\\n--|$)`,
      "i"
    );
    const m = raw.match(re);
    if (!m) return "";

    const blockStart = m.index ?? 0;
    const headerBlock = raw.substring(blockStart, blockStart + m[0].length - m[1].length);
    const encMatch = headerBlock.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
    const enc = encMatch?.[1]?.toLowerCase().trim() ?? "7bit";

    let content = m[1];
    if (enc === "base64") {
      try {
        content = Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf8");
      } catch { /* leave as-is */ }
    } else if (enc === "quoted-printable") {
      content = decodeQP(content);
    }
    return content;
  };

  html = extractPart("text/html");
  text = extractPart("text/plain");

  if (!html && !text) {
    const sep = raw.indexOf("\r\n\r\n");
    const bodyRaw = sep !== -1 ? raw.substring(sep + 4) : raw;
    const bodyUtf = Buffer.from(bodyRaw, "binary").toString("utf8");
    if (/<html|<body|<div|<p\b/i.test(bodyUtf)) {
      html = bodyUtf;
    } else {
      text = bodyUtf;
    }
  }

  return { html, text };
}

// ── HTML → tab-structured plain text ─────────────────────────────────────────
//
// Converts HTML email body to plain text where each <tr> becomes one line with
// cells joined by tabs.  This preserves the "Label\tValue" structure of bank
// alert tables so extractFields() can build a lookup map.

export function htmlToTabText(html: string): string {
  if (!html) return "";

  let s = html;

  // Join adjacent table cells with a tab (before any other tag stripping).
  s = s.replace(/<\/td\s*>\s*<td[^>]*>/gi, "\t");
  s = s.replace(/<\/th\s*>\s*<th[^>]*>/gi, "\t");

  // Block-level elements → newlines.
  s = s.replace(/<\/tr[^>]*>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p[^>]*>/gi, "\n");
  s = s.replace(/<\/div[^>]*>/gi, "\n");
  s = s.replace(/<\/li[^>]*>/gi, "\n");
  s = s.replace(/<\/h[1-6][^>]*>/gi, "\n");

  // Strip all remaining tags.
  s = s.replace(/<[^>]+>/g, "");

  // Decode HTML entities.
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8358;/g, "₦")          // ₦ decimal
    .replace(/&#x20A6;/gi, "₦")        // ₦ hex
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

  // Clean up each line: collapse runs of spaces but keep tabs.
  return s
    .split("\n")
    .map((line) =>
      line
        .replace(/ {2,}/g, " ")    // collapse repeated spaces
        .replace(/\t +/g, "\t")    // remove space after tab
        .replace(/ +\t/g, "\t")    // remove space before tab
        .trim()
    )
    .filter(Boolean)
    .join("\n");
}

// ── Field extraction ──────────────────────────────────────────────────────────
//
// Builds a Map<lowercase-label → value> from a tab-structured text block.
// A line like "Account Number\t238****209" → key "account number", value "238****209".

function extractFields(text: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of text.split("\n")) {
    const tabIdx = line.indexOf("\t");
    if (tabIdx > 0) {
      const key = line.slice(0, tabIdx).trim().toLowerCase();
      const value = line.slice(tabIdx + 1).trim();
      if (key && value) {
        fields.set(key, value);
      }
    }
  }
  return fields;
}

// ── Shared utilities ──────────────────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function normalizeDate(raw: string): string | null {
  // DD/MM/YYYY or DD-MM-YYYY (Zenith "Date of Transaction" field)
  const dmy = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    return `${dmy[1].padStart(2, "0")}/${dmy[2].padStart(2, "0")}/${dmy[3]}`;
  }
  // DD/MON/YY or DD-MON-YYYY (e.g. 09/JUN/26)
  const dMonY = raw.match(/(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{2,4})/);
  if (dMonY) {
    const mon = MONTHS[dMonY[2].toLowerCase()];
    if (!mon) return null;
    let year = dMonY[3];
    if (year.length === 2) year = `20${year}`;
    return `${dMonY[1].padStart(2, "0")}/${mon}/${year}`;
  }
  // "Mon DD, YYYY [HH:MM:SS AM/PM]" — Fidelity email Date/Time field
  // e.g. "Aug 18, 2026 11:51:43 AM"
  const mdY = raw.match(/([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})/);
  if (mdY) {
    const mon = MONTHS[mdY[1].toLowerCase()];
    if (mon) {
      return `${mdY[2].padStart(2, "0")}/${mon}/${mdY[3]}`;
    }
  }
  return null;
}

function todayDate(): string {
  const now = new Date();
  return (
    `${String(now.getDate()).padStart(2, "0")}/` +
    `${String(now.getMonth() + 1).padStart(2, "0")}/` +
    `${now.getFullYear()}`
  );
}

function parseAmount(raw: string | undefined | null): number | null {
  if (!raw) return null;
  // Strip currency symbols, spaces, commas
  const cleaned = raw.replace(/[₦NGN,\s]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) || n <= 0 ? null : n;
}

/** Strip currency symbols, commas, and a trailing "CR" suffix from a balance string. */
function extractBalance(raw: string): string | undefined {
  const cleaned = raw.replace(/[₦NGN,\s]/g, "").replace(/CR$/i, "").trim();
  return cleaned || undefined;
}

/**
 * Normalise a raw account string from an email field.
 * Returns the account identifier as-is if it looks like a masked account
 * (mix of digits, lowercase x, asterisks), otherwise undefined.
 */
function normalizeAccount(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const m = trimmed.match(/([0-9xX*]{5,})/);
  return m ? m[1] : undefined;
}

/** Assemble the final ParsedEmailAlert and generate the fingerprint. */
function buildResult(
  bankName: string,
  amount: number,
  transactionDate: string,
  rawDescription: string,
  maskedAccount: string | undefined,
  balanceKey: string | undefined,
  reference: string | undefined
): EmailParseResult {
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
      rawDescription: rawDescription.trim(),
      reference,
      maskedAccount,
      balanceKey,
      fingerprint,
    },
  };
}

// ── Fidelity Bank email parser ────────────────────────────────────────────────
//
// Real confirmed format:
//   ₦39,500.00 CR                        ← credit signal (top of body)
//   Account\txxxxxx0025                  ← masked account
//   Narration\tTRF PATRICIA To FAITH|…   ← payer narration
//   Date/Time\tAug 18, 2026 11:51:43 AM  ← month-name date
//   Available Balance\t₦1,827,112.00CR   ← balance with trailing CR

function parseFidelityEmail(
  fields: Map<string, string>,
  tabText: string
): EmailParseResult {
  // Credit/debit detection from the "₦AMOUNT CR/DR" line at the top.
  const creditLine = tabText.match(/^\s*[₦]?\s*([\d,]+\.?\d*)\s+(CR|DR)\b/m);
  if (!creditLine) {
    return { ok: false, reason: "Fidelity: no CR/DR amount line found" };
  }
  const signal = creditLine[2].toUpperCase();
  if (signal === "DR") {
    return { ok: false, reason: "Fidelity: debit alert — skipped" };
  }

  // Amount from the credit line itself.
  const amount = parseAmount(creditLine[1]);
  if (amount === null) {
    return { ok: false, reason: "Fidelity: no credit amount found" };
  }

  // Account (handles both xxxxxx0025 and ****0025 styles).
  const maskedAccount = normalizeAccount(fields.get("account") ?? "");

  // Narration / description.
  const rawDescription =
    fields.get("narration") ??
    fields.get("description") ??
    "Fidelity credit alert";

  // Date — Fidelity uses "Date/Time" label with "Aug 18, 2026 11:51:43 AM" value.
  const dateRaw =
    fields.get("date/time") ??
    fields.get("date") ??
    fields.get("transaction date") ??
    "";
  const transactionDate = normalizeDate(dateRaw) ?? todayDate();

  // Balance — strip ₦, commas, and trailing "CR".
  const balanceRaw = fields.get("available balance") ?? "";
  const balanceKey = extractBalance(balanceRaw);

  // Reference.
  const reference =
    (fields.get("transaction reference") ?? fields.get("reference code") ?? "").trim() ||
    undefined;

  return buildResult("Fidelity", amount, transactionDate, rawDescription, maskedAccount, balanceKey, reference);
}

// ── Zenith Bank email parser ──────────────────────────────────────────────────
//
// Real confirmed format:
//   CREDIT TRANSACTION NOTIFICATION      ← credit signal (heading)
//   Account Number\t238****209           ← masked account
//   Date of Transaction\t18/08/2026      ← DD/MM/YYYY date
//   Amount\t70,000.00                    ← amount (no currency symbol)
//   Currency\tNGN                        ← currency on a separate row
//   Description\tCIP CR/ JOB ALEX…       ← payer description
//   Transaction Type\tCREDIT             ← explicit type field
//   Available Balance\t155,881.17        ← balance (no currency symbol)

function parseZenithEmail(
  fields: Map<string, string>,
  tabText: string
): EmailParseResult {
  // Credit/debit detection.
  const txType = (fields.get("transaction type") ?? "").trim().toLowerCase();
  const hasNotificationHeader = /CREDIT\s+TRANSACTION\s+NOTIFICATION/i.test(tabText);
  const isCredit = txType === "credit" || hasNotificationHeader;
  const isDebit = txType === "debit" || /DEBIT\s+TRANSACTION\s+NOTIFICATION/i.test(tabText);

  if (isDebit && !isCredit) {
    return { ok: false, reason: "Zenith: debit alert — skipped" };
  }
  if (!isCredit) {
    return { ok: false, reason: "Zenith: not a credit alert" };
  }

  // Amount (no currency symbol in the Amount field; Currency row is separate).
  const amountRaw = fields.get("amount") ?? "";
  const amount = parseAmount(amountRaw);
  if (amount === null) {
    return { ok: false, reason: "Zenith: no credit amount found" };
  }

  // Account.
  const maskedAccount = normalizeAccount(fields.get("account number") ?? "");

  // Description.
  const rawDescription =
    fields.get("description") ??
    fields.get("narration") ??
    "Zenith credit alert";

  // Date — Zenith uses "Date of Transaction" → DD/MM/YYYY.
  const dateRaw =
    fields.get("date of transaction") ??
    fields.get("transaction date") ??
    fields.get("date") ??
    "";
  const transactionDate = normalizeDate(dateRaw) ?? todayDate();

  // Balance — no currency symbol, no CR suffix.
  const balanceRaw = fields.get("available balance") ?? "";
  const balanceKey = extractBalance(balanceRaw);

  // Reference code (Zenith often leaves this blank).
  const reference = (fields.get("reference code") ?? "").trim() || undefined;

  return buildResult("Zenith", amount, transactionDate, rawDescription, maskedAccount, balanceKey, reference);
}

// ── Generic credit-alert fallback ────────────────────────────────────────────
//
// Last-resort parser for senders whose bank-specific format is not yet
// confirmed.  Accepts any email that contains an unambiguous credit signal
// and a parseable amount.

function parseGenericEmail(
  fields: Map<string, string>,
  tabText: string
): EmailParseResult {
  const hasCredit =
    /\bCR\b/i.test(tabText) ||
    /\bcredit(?:ed)?\b/i.test(tabText) ||
    /transaction\s+type\s*:\s*credit/i.test(tabText);
  const hasDebit =
    /\bDR\b/i.test(tabText) && !/\bCR\b/i.test(tabText);

  if (hasDebit) return { ok: false, reason: "generic: debit — skipped" };
  if (!hasCredit) return { ok: false, reason: "generic: not a credit alert" };

  // Try common amount field names.
  const amountRaw =
    fields.get("amount") ??
    fields.get("amount credited") ??
    tabText.match(/[₦N]?\s*([\d,]+\.\d{2})\s+CR/i)?.[1];
  const amount = parseAmount(amountRaw);
  if (amount === null) {
    return { ok: false, reason: "generic: no credit amount found" };
  }

  const maskedAccount = normalizeAccount(
    fields.get("account") ??
    fields.get("account number") ??
    ""
  );

  const rawDescription =
    fields.get("description") ??
    fields.get("narration") ??
    fields.get("details") ??
    "bank credit alert";

  const dateRaw =
    fields.get("date") ??
    fields.get("date/time") ??
    fields.get("transaction date") ??
    fields.get("date of transaction") ??
    "";
  const transactionDate = normalizeDate(dateRaw) ?? todayDate();

  const balanceKey = extractBalance(fields.get("available balance") ?? "");
  const reference = (fields.get("reference") ?? fields.get("reference code") ?? "").trim() || undefined;

  return buildResult("Unknown", amount, transactionDate, rawDescription, maskedAccount, balanceKey, reference);
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Parse a bank credit-alert email and return a normalised transaction.
 *
 * @param from     Sender email address (e.g. "ibanking@fidelitybank.ng")
 * @param subject  Email subject line
 * @param html     HTML body of the email (use extractBodyFromRfc2822 to obtain)
 */
export function parseEmailAlert(input: {
  from: string;
  subject: string;
  html: string;
}): EmailParseResult {
  const { from, subject, html } = input;

  if (!html && !subject) {
    return { ok: false, reason: "empty email" };
  }

  // Convert HTML to tab-structured plain text.
  const tabText = htmlToTabText(html || "");

  if (!tabText.trim()) {
    return { ok: false, reason: "empty body after HTML conversion" };
  }

  // Build field map for structured lookup.
  const fields = extractFields(tabText);

  // Detect bank from sender domain.
  const fromLower = from.toLowerCase();
  const subjectLower = subject.toLowerCase();
  const hay = `${fromLower} ${subjectLower}`;

  if (hay.includes("fidelitybank.ng") || hay.includes("fidelity bank") || hay.includes("fidelity")) {
    return parseFidelityEmail(fields, tabText);
  }
  if (hay.includes("zenithbank.com") || hay.includes("zenith bank") || hay.includes("zenith")) {
    return parseZenithEmail(fields, tabText);
  }
  if (hay.includes("accessbankplc.com") || hay.includes("accessbank.com") || hay.includes("access bank")) {
    // Access Bank format not yet confirmed — fall through to generic parser.
    return parseGenericEmail(fields, tabText);
  }

  // Body-content bank detection fallback (when sender domain is generic).
  if (/fidelity/i.test(tabText)) return parseFidelityEmail(fields, tabText);
  if (/zenith/i.test(tabText)) return parseZenithEmail(fields, tabText);

  return parseGenericEmail(fields, tabText);
}
