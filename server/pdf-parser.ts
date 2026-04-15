import * as XLSX from "xlsx";
import * as crypto from "crypto";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

export interface ParsedTransaction {
  date: string;
  credit: number;
  rawDescription: string;
  fingerprint: string;
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  if (!result.text || result.text.trim().length === 0) {
    throw new Error("Scanned PDF detected - cannot extract text. Please use a text-based PDF or convert to Excel.");
  }
  return result.text;
}

export function normalizeForFingerprint(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function generateFingerprint(date: string, amount: number, description: string): string {
  const normalizedDesc = normalizeForFingerprint(description);
  const data = `${date}|${amount.toFixed(2)}|${normalizedDesc}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function parseDateString(raw: string): string | null {
  const ddmmyyyy = raw.match(/(\d{1,2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[1].padStart(2, "0")}/${ddmmyyyy[2]}/${ddmmyyyy[3]}`;
  }

  const dMonYY = raw.match(/(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{2,4})/);
  if (dMonYY) {
    const day = dMonYY[1].padStart(2, "0");
    const mon = MONTH_MAP[dMonYY[2].toLowerCase()];
    if (!mon) return null;
    let year = dMonYY[3];
    if (year.length === 2) year = `20${year}`;
    return `${day}/${mon}/${year}`;
  }

  return null;
}

function detectBankFormat(rawText: string): "fidelity" | "moniepoint" | "zenith" | "access" | "generic" {
  const lower = rawText.toLowerCase();
  if (lower.includes("fidelitybank") || lower.includes("fidelity bank") ||
      (lower.includes("pay in") && lower.includes("pay out") && lower.includes("balance"))) {
    return "fidelity";
  }
  if (lower.includes("moniepoint") || lower.includes("moniepoint mfb")) return "moniepoint";
  if (lower.includes("zenith bank") || lower.includes("zenith bank plc")) return "zenith";
  // Access Bank: detect by name OR by unique column header combination
  if (lower.includes("access bank") ||
      (lower.includes("posted date") && lower.includes("debit (ngn)") && lower.includes("credit (ngn)"))) {
    return "access";
  }
  return "generic";
}

function parseFidelityTransactions(rawText: string): ParsedTransaction[] {
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  const transactions: ParsedTransaction[] = [];

  const dateRegex = /^(\d{1,2}-[A-Za-z]{3}-\d{2})/;
  let currentDate = "";
  let currentDescription = "";
  let currentAmounts: number[] = [];

  const flushTransaction = () => {
    if (!currentDate || currentAmounts.length === 0) return;
    const parsed = parseDateString(currentDate);
    if (!parsed) return;

    let credit = 0;
    if (currentAmounts.length >= 2) {
      const balance = currentAmounts[currentAmounts.length - 1];
      for (let i = currentAmounts.length - 2; i >= 0; i--) {
        if (balance > currentAmounts[i] * 5 && currentAmounts[i] > 0) {
          credit = currentAmounts[i];
          break;
        }
      }
      if (credit === 0) {
        const secondLast = currentAmounts[currentAmounts.length - 2];
        if (secondLast > 0 && secondLast < balance) {
          credit = secondLast;
        }
      }
    }

    if (credit > 0) {
      const desc = currentDescription.replace(/\s+/g, " ").trim();
      const fingerprint = generateFingerprint(parsed, credit, desc);
      transactions.push({ date: parsed, credit, rawDescription: desc, fingerprint });
    }
  };

  for (const line of lines) {
    if (line.match(/^opening balance/i) || line.match(/^closing balance/i) ||
        line.match(/^transaction\s+date/i) || line.match(/^\d+\s+of\s+\d+/) ||
        line.match(/^page\s+\d+/i)) continue;

    const dateMatch = line.match(dateRegex);
    if (dateMatch) {
      flushTransaction();
      const rest = line.substring(dateMatch[0].length).trim();
      const valueDateMatch = rest.match(/\d{1,2}-[A-Za-z]{3}-\d{2}/);
      currentDate = valueDateMatch ? valueDateMatch[0] : dateMatch[1];
      const restAfterValueDate = valueDateMatch
        ? rest.substring(rest.indexOf(valueDateMatch[0]) + valueDateMatch[0].length).trim()
        : rest;
      const amounts = restAfterValueDate.match(/[\d,]+\.\d{2}/g);
      currentAmounts = amounts ? amounts.map(a => parseFloat(a.replace(/,/g, ""))) : [];
      const descPart = restAfterValueDate.replace(/[\d,]+\.\d{2}/g, "").replace(/\s+/g, " ").trim();
      currentDescription = descPart;
    } else {
      const amounts = line.match(/[\d,]+\.\d{2}/g);
      if (amounts) {
        currentAmounts.push(...amounts.map(a => parseFloat(a.replace(/,/g, ""))));
      }
      const descPart = line.replace(/[\d,]+\.\d{2}/g, "").replace(/\s+/g, " ").trim();
      if (descPart && !descPart.match(/^[\s\d\/\-,\.]+$/)) {
        currentDescription += " " + descPart;
      }
    }
  }
  flushTransaction();

  return transactions.filter(t => {
    const lower = t.rawDescription.toLowerCase();
    return !lower.includes("sms alert charge") && !lower.includes("stamp duty");
  });
}

const OUTGOING_KEYWORDS = [
  "trf to", "transfer to", "payment to",
  "w/d", "withdrawal", "charge", "charges", "levy",
  "stamp duty", "vat on", "sms alert", "maintenance fee",
  "card maintenance", "commission on turnover", "cot",
  "interbank transfer", "airtime purchase", "bill payment", "ussd",
];

function isOutgoingRow(description: string): boolean {
  const lower = description.toLowerCase();
  if (OUTGOING_KEYWORDS.some(kw => lower.includes(kw))) return true;
  const withoutAmounts = description.replace(/[\d,]+\.\d{2}/g, "").trim();
  if (/\b(dr|dbt)\b\s*$/i.test(withoutAmounts)) return true;
  return false;
}

// Returns "dcb" (Debit left of Credit) or "cdb" (Credit left of Debit) or null
type ColumnOrder = "dcb" | "cdb" | null;

function detectColumnOrder(rawText: string): ColumnOrder {
  for (const line of rawText.split("\n")) {
    const lower = line.toLowerCase();
    if (lower.includes("debit") && lower.includes("credit")) {
      return lower.indexOf("debit") < lower.indexOf("credit") ? "dcb" : "cdb";
    }
  }
  return null;
}

function resolveCreditAmount(parsedAmounts: number[], columnOrder: ColumnOrder, rawLine = ""): number {
  const len = parsedAmounts.length;
  if (len === 0) return 0;

  if (columnOrder !== null && len >= 3) {
    const debit   = columnOrder === "dcb" ? parsedAmounts[len - 3] : parsedAmounts[len - 2];
    const credit  = columnOrder === "dcb" ? parsedAmounts[len - 2] : parsedAmounts[len - 3];
    const balance = parsedAmounts[len - 1];
    if (debit > 0 || credit === 0 || credit === balance) return 0;
    return credit;
  }

  if (len >= 3) {
    const debit   = parsedAmounts[len - 3];
    const credit  = parsedAmounts[len - 2];
    const balance = parsedAmounts[len - 1];
    if (debit > 0 || credit === 0 || credit === balance) return 0;
    return credit;
  }

  if (len === 2) {
    const smaller = Math.min(...parsedAmounts);
    const larger  = Math.max(...parsedAmounts);
    if (smaller === larger) return 0;
    return smaller;
  }

  if (len === 1) {
    if (/debit|withdrawal|transfer out/i.test(rawLine)) return 0;
    return parsedAmounts[0];
  }

  return 0;
}

function extractDescription(line: string): string {
  return line
    .replace(/\d{1,2}[\/\-](\d{2}|[A-Za-z]{3})[\/\-]\d{2,4}/g, "")
    .replace(/[\d,]+\.\d{2}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseMoniePointTransactions(rawText: string): ParsedTransaction[] {
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  const transactions: ParsedTransaction[] = [];

  // Verified from real pdf-parse output: date IS always on its own line e.g. "2026-01-15T12:"
  const dateLineRegex = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:$/;
  // Amounts: line ends with three decimal numbers (Debit Credit Balance)
  const amountsLineRegex = /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;

  // Lines to skip when accumulating narration (they are not descriptive text)
  const isSkipLine = (l: string) =>
    /^\d{2}:\d{2}/.test(l) ||     // time continuation e.g. "21:45" or compact "40:45 REF..."
    /^[\d*]+$/.test(l) ||          // pure card mask line e.g. "506105*********0775" (only digits+stars)
    l.startsWith("/") ||            // reference continuation e.g. "/PUR|..."
    /^--\s*\d+/.test(l);           // page marker e.g. "-- 1 of 15 --"

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const dateMatch = line.match(dateLineRegex);
    if (!dateMatch) { i++; continue; }

    const formattedDate = `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}`;
    i++; // advance past date line

    // Inner scan: accumulate narration and find the amounts line
    let narration = "";
    let amountsMatch: RegExpMatchArray | null = null;

    while (i < lines.length) {
      const candidate = lines[i];

      // Stop if we hit the next date line (compact debit had time+amounts on one line,
      // which we already consumed as the amounts line; or the transaction has no amounts)
      if (dateLineRegex.test(candidate)) break;

      // Check for amounts at end of line (compact debits also match here and get skipped)
      const m = candidate.match(amountsLineRegex);
      if (m) {
        amountsMatch = m;
        i++;
        break;
      }

      // Skip non-narration lines
      if (isSkipLine(candidate)) {
        i++;
        continue;
      }

      // Accumulate narration text
      if (!narration) narration = candidate;
      else narration += " " + candidate;
      i++;
    }

    if (!amountsMatch) continue;

    const debit  = parseFloat(amountsMatch[1].replace(/,/g, ""));
    const credit = parseFloat(amountsMatch[2].replace(/,/g, ""));

    if (debit > 0 || credit <= 0) continue;

    // If no narration was captured (e.g. the only pre-amounts line was a card mask),
    // extract the reference prefix from the amounts line itself as a fallback description.
    // This avoids empty-string fingerprints that collide for same-date / same-amount credits.
    let desc = narration.trim();
    if (!desc && amountsMatch.input) {
      const rawAmounts = amountsMatch.input;
      // Strip the trailing "Debit Credit Balance" numbers to get the reference prefix
      const prefixEnd = rawAmounts.lastIndexOf(amountsMatch[1]);
      const prefix = prefixEnd > 0 ? rawAmounts.substring(0, prefixEnd).trim() : "";
      // Use the last segment of the reference (after the last "|" or space) as a short key
      desc = prefix.replace(/\|/g, " ").replace(/\s{2,}/g, " ").trim().substring(0, 80);
    }

    const fingerprint = generateFingerprint(formattedDate, credit, desc);
    transactions.push({ date: formattedDate, credit, rawDescription: desc, fingerprint });
  }

  return transactions;
}

function parseZenithTransactions(rawText: string): ParsedTransaction[] {
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  const transactions: ParsedTransaction[] = [];

  const dateLineRegex = /^(\d{2}\/\d{2}\/\d{4})\s+[A-Za-z]/;
  const amountsLineRegex = /^([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+\d{2}\/\d{2}\/\d{4}\s+[\d,]+\.\d{2}\s*$/;

  let pendingDate: string | null = null;
  let pendingDescription = "";

  const flush = (debit: number, credit: number) => {
    if (!pendingDate) return;
    if (debit > 0 || credit <= 0) {
      pendingDate = null; pendingDescription = "";
      return;
    }
    const desc = pendingDescription.replace(/\s{2,}/g, " ").trim();
    const fingerprint = generateFingerprint(pendingDate, credit, desc);
    transactions.push({ date: pendingDate, credit, rawDescription: desc, fingerprint });
    pendingDate = null; pendingDescription = "";
  };

  for (const line of lines) {
    if (/^(date\s+description|opening balance|closing balance|account name|account no|currency|period)/i.test(line)) continue;

    const amountsMatch = line.match(amountsLineRegex);
    if (amountsMatch) {
      const debit  = parseFloat(amountsMatch[1].replace(/,/g, ""));
      const credit = parseFloat(amountsMatch[2].replace(/,/g, ""));
      flush(debit, credit);
      continue;
    }

    const dateMatch = line.match(dateLineRegex);
    if (dateMatch) {
      if (pendingDate) { pendingDate = null; pendingDescription = ""; }
      pendingDate = dateMatch[1];
      pendingDescription = line.substring(11).trim();
      continue;
    }

    if (pendingDate) {
      pendingDescription += " " + line;
    }
  }

  return transactions;
}

function parseAccessTransactions(rawText: string): ParsedTransaction[] {
  // Verified from real pdf-parse output: columns are TAB-separated (\t), NOT spaces.
  // Transactions can span 1 to 4+ lines. Three formats verified in real data:
  //   Format 1 (single line): Date\tDate\tDesc\tDebit\tCredit\tBalance
  //   Format 2 (two lines):   Date\tDate\tPartialDesc  /  Continuation\tDebit\tCredit\tBalance
  //   Format 3 (multi-line):  Date\tDate  /  DescLine1  /  DescLine2  /  Debit\tCredit\tBalance
  // The null marker for zero amounts is "-" (single dash).
  // Detection: split each line by \t; last 3 tab-fields are [Debit, Credit, Balance].
  const rawLines = rawText.split("\n");
  const transactions: ParsedTransaction[] = [];

  const dateFmt     = /^\d{2}-[A-Za-z]{3}-\d{2}$/;
  const posAmount   = /^[\d,]+\.\d+$/;       // positive decimal number
  const amountOrNull = /^-$|^[\d,]+\.\d+$/;  // "-" or positive decimal
  const pageMarker  = /^--\s*\d+.*--$/i;

  const skipPatterns = /^(opening balance|closing balance|clearing balance|total withdrawal|total lodgement|transactions|posted date|cleared balance|uncleared balance|currency|account name|account class|account number|branch address|financial summary|account details|statement period)/i;
  const descSkip    = /^(opening balance|closing balance|clearing balance)/i;

  // True if last 3 tab-parts of the parts array look like [Debit, Credit, Balance]
  const hasAmounts = (parts: string[]): boolean =>
    parts.length >= 3 &&
    posAmount.test(parts[parts.length - 1]) &&
    amountOrNull.test(parts[parts.length - 2]) &&
    amountOrNull.test(parts[parts.length - 3]);

  interface Pending { date: string; descParts: string[]; }
  let pending: Pending | null = null;

  const tryEmit = (parts: string[], extraDescParts: string[]) => {
    if (!pending) return;
    const debitStr  = parts[parts.length - 3];
    const creditStr = parts[parts.length - 2];
    const debit  = debitStr  === "-" ? 0 : parseFloat(debitStr.replace(/,/g, ""));
    const credit = creditStr === "-" ? 0 : parseFloat(creditStr.replace(/,/g, ""));
    if (credit > 0 && debit === 0) {
      const desc = [...pending.descParts, ...extraDescParts]
        .filter(Boolean).map(s => s.trim()).join(" ").trim();
      if (!descSkip.test(desc)) {
        const fp = generateFingerprint(pending.date, credit, desc);
        transactions.push({ date: pending.date, credit, rawDescription: desc, fingerprint: fp });
      }
    }
    pending = null;
  };

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (pageMarker.test(line)) continue;
    if (skipPatterns.test(line)) { pending = null; continue; }

    // Split by tab; empty fields filtered out
    const parts = rawLine.split("\t").map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) continue;

    // Date-start line: first two fields are DD-MON-YY dates
    if (parts.length >= 2 && dateFmt.test(parts[0]) && dateFmt.test(parts[1])) {
      // Abandon any pending transaction that never got its amounts line
      pending = null;
      const valueDate = parts[1];
      const normalizedDate = parseDateString(valueDate);
      if (!normalizedDate) continue;

      if (hasAmounts(parts)) {
        // All fields on one line — emit immediately
        const lineDescParts = parts.slice(2, parts.length - 3);
        pending = { date: normalizedDate, descParts: [] };
        tryEmit(parts, lineDescParts);
      } else {
        // Amounts will come on a subsequent line; save any partial description
        const descStart = parts.slice(2).join(" ").trim();
        pending = { date: normalizedDate, descParts: descStart ? [descStart] : [] };
      }
      continue;
    }

    // Non-date line
    if (!pending) continue;

    if (hasAmounts(parts)) {
      // This line completes the current transaction; everything before the last 3 fields
      // is additional description (e.g. "A/school fees bal/35085505237")
      const lineDescParts = parts.slice(0, parts.length - 3).filter(Boolean);
      tryEmit(parts, lineDescParts);
    } else {
      // Pure continuation description line (no tabs, no amounts)
      pending.descParts.push(line);
    }
  }

  return transactions;
}

export function parseTransactions(rawText: string): ParsedTransaction[] {
  const format = detectBankFormat(rawText);
  if (format === "fidelity") {
    return parseFidelityTransactions(rawText);
  }
  if (format === "moniepoint") {
    return parseMoniePointTransactions(rawText);
  }
  if (format === "zenith") {
    return parseZenithTransactions(rawText);
  }
  if (format === "access") {
    return parseAccessTransactions(rawText);
  }

  const columnOrder = detectColumnOrder(rawText);
  const rawLines = rawText.split("\n");
  const transactions: ParsedTransaction[] = [];

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;

    const allDateMatches = [...line.matchAll(/\d{1,2}[\/\-](\d{2}|[A-Za-z]{3})[\/\-]\d{2,4}/g)];
    if (allDateMatches.length === 0) continue;

    const chosenMatch = allDateMatches.length >= 2 ? allDateMatches[1] : allDateMatches[0];
    const normalizedDate = parseDateString(chosenMatch[0]);
    if (!normalizedDate) continue;

    if (isOutgoingRow(line)) continue;

    const rawAmounts = line.match(/[\d,]+\.\d{2}/g);
    if (!rawAmounts || rawAmounts.length === 0) continue;

    const parsedAmounts = rawAmounts.map(a => parseFloat(a.replace(/,/g, "")));
    const credit = resolveCreditAmount(parsedAmounts, columnOrder, line);
    if (credit <= 0) continue;

    const description = extractDescription(line);
    const fingerprint = generateFingerprint(normalizedDate, credit, description);
    const displayDescription = description.length > 2 ? description : line;

    transactions.push({
      date: normalizedDate,
      credit,
      rawDescription: displayDescription,
      fingerprint,
    });
  }

  return transactions;
}

export function generateExcelBuffer(transactions: ParsedTransaction[]): Buffer {
  const data: (string | number)[][] = [["Date", "Description", "Credit", "Fingerprint"]];
  transactions.forEach(t =>
    data.push([t.date, t.rawDescription, t.credit, t.fingerprint])
  );

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function parseExcelTransactions(buffer: Buffer): ParsedTransaction[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  const transactions: ParsedTransaction[] = [];

  const headers = data[0]?.map(h => String(h || "").toLowerCase()) || [];
  const dateCol   = headers.findIndex(h => h.includes("date"));
  const descCol   = headers.findIndex(h => h.includes("desc") || h.includes("narr") || h.includes("particular"));
  const creditCol = headers.findIndex(h => h.includes("credit") || h.includes("deposit") || h.includes("amount"));

  const useDateCol   = dateCol   >= 0 ? dateCol   : 0;
  const useDescCol   = descCol   >= 0 ? descCol   : 1;
  const useCreditCol = creditCol >= 0 ? creditCol : 2;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 2) continue;

    let dateStr = "";
    let credit = 0;
    let rawDescription = "";

    const dateVal = row[useDateCol];
    if (dateVal) {
      if (typeof dateVal === "number") {
        const excelDate = new Date((dateVal - 25569) * 86400 * 1000);
        dateStr = excelDate.toLocaleDateString("en-GB");
      } else {
        dateStr = String(dateVal);
      }
    }

    if (row[useDescCol]) {
      rawDescription = String(row[useDescCol]);
    }

    const creditVal = row[useCreditCol];
    if (creditVal) {
      const parsed = parseFloat(String(creditVal).replace(/,/g, ""));
      if (!isNaN(parsed) && parsed > 0) {
        credit = parsed;
      }
    }

    if (!dateStr || credit <= 0) continue;

    const existingFingerprint = row[3] ? String(row[3]) : null;
    const fingerprint = existingFingerprint || generateFingerprint(dateStr, credit, rawDescription);

    transactions.push({ date: dateStr, credit, rawDescription, fingerprint });
  }

  return transactions;
}
