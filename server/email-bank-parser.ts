// Email bank-alert parser.
//
// Converts an HTML credit-alert email (forwarded to a monitored Gmail inbox) into
// a normalised transaction ready for the reconciliation queue.  Only CREDIT alerts
// are accepted; debits, OTPs, balance enquiries, and marketing are skipped.
//
// Strategy: strip the HTML body to plain text, then delegate to the existing
// parseBankAlertSms() which already handles Zenith / Access / Fidelity and a
// generic credit-alert fallback.  This ensures email and SMS rows share the
// same fingerprint format, so a payment that arrives via both channels is
// deduplicated automatically.
//
// Supported banks (detected via sender email domain or subject keywords):
//   zenithbank.com       → Zenith
//   accessbankplc.com / accessbank.com → Access
//   fidelitybank.ng      → Fidelity
//   (fallback)           → Unknown / generic

import { parse as parseHtml } from "node-html-parser";
import { parseBankAlertSms } from "./sms-parser";

export interface ParsedEmailAlert {
  bankName: string;
  amount: number;
  transactionDate: string;
  rawDescription: string;
  reference?: string;
  /** Masked account number — used as the school routing key (same as SMS). */
  maskedAccount?: string;
  balanceKey?: string;
  fingerprint: string;
}

export type EmailParseResult =
  | { ok: true; data: ParsedEmailAlert }
  | { ok: false; reason: string };

// ── MIME body extraction ──────────────────────────────────────────────────────

/** Decode a quoted-printable encoded string. */
function decodeQP(s: string): string {
  return s
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

/** Extract HTML and plain-text content from a raw RFC 2822 message buffer. */
export function extractBodyFromRfc2822(source: Buffer): { html: string; text: string } {
  // Work in binary (latin1) so byte-level slicing is safe before we know encoding.
  const raw = source.toString("binary");

  let html = "";
  let text = "";

  // Helper: find the content of a text/* part, honouring transfer encoding.
  const extractPart = (mimeType: "text/html" | "text/plain"): string => {
    // Match the Content-Type header line + optional extra headers + blank line + body.
    // The body ends at the next MIME boundary ("--") or end of string.
    const re = new RegExp(
      `Content-Type:\\s*${mimeType.replace("/", "\\/")}[^\\r\\n]*\\r?\\n` +
        `(?:[^\\r\\n]+\\r?\\n)*\\r?\\n` +
        `([\\s\\S]+?)(?=\\r?\\n--|$)`,
      "i"
    );
    const m = raw.match(re);
    if (!m) return "";

    // Find the transfer encoding in the same block.
    const blockStart = m.index ?? 0;
    const headerBlock = raw.substring(blockStart, blockStart + m[0].length - m[1].length);
    const encMatch = headerBlock.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
    const enc = encMatch?.[1]?.toLowerCase().trim() ?? "7bit";

    let content = m[1];
    if (enc === "base64") {
      try {
        content = Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf8");
      } catch {
        /* leave as-is */
      }
    } else if (enc === "quoted-printable") {
      content = decodeQP(content);
    }
    return content;
  };

  html = extractPart("text/html");
  text = extractPart("text/plain");

  // If no multipart structure, the body starts after the first blank line.
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

// ── Bank detection ────────────────────────────────────────────────────────────

function detectBankHint(from: string, subject: string): string {
  const hay = `${from} ${subject}`.toLowerCase();
  if (hay.includes("zenithbank.com") || hay.includes("zenith bank") || hay.includes("zenith")) return "Zenith";
  if (hay.includes("accessbankplc.com") || hay.includes("access bank") || hay.includes("accessbank")) return "Access";
  if (hay.includes("fidelitybank.ng") || hay.includes("fidelity bank") || hay.includes("fidelity")) return "Fidelity";
  return "";
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Parse a bank credit-alert email and return a normalised transaction.
 *
 * @param from    Sender email address (e.g. "alerts@zenithbank.com")
 * @param subject Email subject line
 * @param html    HTML body of the email (use extractBodyFromRfc2822 to obtain it)
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

  // Strip HTML to plain text — the SMS parser's regex patterns work on plain text.
  let bodyText = "";
  try {
    const root = parseHtml(html || "");
    bodyText = root.text.replace(/\t/g, " ").replace(/ {2,}/g, " ").trim();
  } catch {
    bodyText = html || "";
  }

  if (!bodyText.trim()) {
    return { ok: false, reason: "empty email body after HTML stripping" };
  }

  // Build a sender hint string that the SMS parser's detectBank() will recognise.
  const bankHint = detectBankHint(from, subject);
  // Prepend the bank hint so detectBank() sees it in the `${sender} ${body}` haystack.
  const sender = bankHint || from;

  const smsResult = parseBankAlertSms(bodyText, sender);

  if (!smsResult.ok) {
    return { ok: false, reason: smsResult.reason };
  }

  const d = smsResult.data;
  return {
    ok: true,
    data: {
      bankName: d.bankName !== "Unknown" ? d.bankName : (bankHint || "Unknown"),
      amount: d.amount,
      transactionDate: d.transactionDate,
      rawDescription: d.rawDescription,
      reference: d.reference,
      maskedAccount: d.maskedAccount,
      balanceKey: d.balanceKey,
      fingerprint: d.fingerprint,
    },
  };
}
