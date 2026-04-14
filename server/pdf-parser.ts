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
  if (lower.includes("moniepoint")) return "moniepoint";
  if (lower.includes("zenith bank") || lower.includes("zenith bank plc")) return "zenith";
  if (lower.includes("access bank")) return "access";
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

  const dateLineRegex = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:$/;
  const amountsLineRegex = /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const dateMatch = line.match(dateLineRegex);
    if (!dateMatch) { i++; continue; }

    const formattedDate = `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}`;
    i++;
    i++;

    if (i >= lines.length) break;
    const narration = lines[i];
    i++;

    if (i < lines.length && /\*{4,}/.test(lines[i])) i++;

    if (i < lines.length && lines[i].startsWith("/")) i++;

    if (i >= lines.length) break;
    const amountsLine = lines[i];
    i++;

    const amountsMatch = amountsLine.match(amountsLineRegex);
    if (!amountsMatch) continue;

    const debit  = parseFloat(amountsMatch[1].replace(/,/g, ""));
    const credit = parseFloat(amountsMatch[2].replace(/,/g, ""));

    if (debit > 0 || credit <= 0) continue;

    const fingerprint = generateFingerprint(formattedDate, credit, narration);
    transactions.push({ date: formattedDate, credit, rawDescription: narration, fingerprint });
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
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  const transactions: ParsedTransaction[] = [];

  // Each transaction is one line: PostedDate ValueDate Description Debit Credit Balance
  // Debit and Credit use "----" as a zero/null marker
  const txRegex = /^(\d{2}-[A-Za-z]{3}-\d{2})\s+(\d{2}-[A-Za-z]{3}-\d{2})\s+(.+)\s+(----|-?[\d,]+\.\d+)\s+(----|-?[\d,]+\.\d+)\s+(-?[\d,]+\.\d+)\s*$/;

  const skipRegex = /^(opening balance|closing balance|total withdrawal|total lodgement|transactions|posted date|cleared balance|uncleared balance|currency|account name|account class|account number|branch address)/i;

  for (const line of lines) {
    if (skipRegex.test(line)) continue;

    const match = line.match(txRegex);
    if (!match) continue;

    const [, , valueDate, description, debitStr, creditStr] = match;

    const debit  = debitStr  === "----" ? 0 : parseFloat(debitStr.replace(/,/g, ""));
    const credit = creditStr === "----" ? 0 : parseFloat(creditStr.replace(/,/g, ""));

    if (debit > 0 || credit <= 0) continue;

    const normalizedDate = parseDateString(valueDate);
    if (!normalizedDate) continue;

    const desc = description.trim();
    const fingerprint = generateFingerprint(normalizedDate, credit, desc);
    transactions.push({ date: normalizedDate, credit, rawDescription: desc, fingerprint });
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
