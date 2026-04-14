import * as XLSX from "xlsx";
import * as crypto from "crypto";
import { createRequire } from "module";

// Use createRequire for pdf-parse (CommonJS module in ESM context)
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

export interface ParsedTransaction {
  date: string;
  credit: number;
  rawDescription: string;
  fingerprint: string;
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // pdf-parse v2 uses class-based API
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  
  if (!result.text || result.text.trim().length === 0) {
    throw new Error("Scanned PDF detected - cannot extract text. Please use a text-based PDF or convert to Excel.");
  }
  return result.text;
}

export function normalizeForFingerprint(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

function detectBankFormat(rawText: string): "fidelity" | "generic" {
  const lower = rawText.toLowerCase();
  if (lower.includes("fidelitybank") || lower.includes("fidelity bank") ||
      (lower.includes("pay in") && lower.includes("pay out") && lower.includes("balance"))) {
    return "fidelity";
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
      // Prefer the Value Date (second date on the line) over Transaction Date (first)
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

// Outgoing-transfer keywords that indicate a debit/outgoing row
const OUTGOING_KEYWORDS = ["trf to", "payment to", "transfer to"];

function isOutgoingRow(description: string): boolean {
  const lower = description.toLowerCase();
  if (OUTGOING_KEYWORDS.some(kw => lower.includes(kw))) return true;
  // "DR" debit indicator may appear before trailing numeric columns (e.g. "SOME TRF DR 100.00 0.00 500.00").
  // Strip all decimal amounts first so the end-of-string check still works.
  const withoutAmounts = description.replace(/[\d,]+\.\d{2}/g, "").trim();
  if (/\bdr\s*$/i.test(withoutAmounts)) return true;
  return false;
}

// Detect Debit/Credit/Balance column header positions from the raw PDF text
function detectDebitCreditColumns(rawText: string): { debitPos: number; creditPos: number; balancePos: number } | null {
  for (const line of rawText.split("\n")) {
    const lower = line.toLowerCase();
    if (lower.includes("debit") && lower.includes("credit")) {
      const debitPos = lower.indexOf("debit");
      const creditPos = lower.indexOf("credit");
      const balancePos = lower.indexOf("balance");
      if (debitPos >= 0 && creditPos >= 0) {
        return { debitPos, creditPos, balancePos: balancePos >= 0 ? balancePos : -1 };
      }
    }
  }
  return null;
}

// Given a raw (untrimmed) line and column header positions, extract debit/credit/balance amounts
// by finding each decimal number's character position and assigning it to the nearest column.
function extractAmountsByColumnPosition(
  rawLine: string,
  cols: { debitPos: number; creditPos: number; balancePos: number }
): { debit: number; credit: number; balance: number } {
  const result = { debit: 0, credit: 0, balance: 0 };
  const amountRegex = /[\d,]+\.\d{2}/g;
  let m: RegExpExecArray | null;
  while ((m = amountRegex.exec(rawLine)) !== null) {
    const value = parseFloat(m[0].replace(/,/g, ""));
    const pos = m.index + m[0].length / 2; // centre of the number string
    const distDebit = Math.abs(pos - cols.debitPos);
    const distCredit = Math.abs(pos - cols.creditPos);
    const distBalance = cols.balancePos >= 0 ? Math.abs(pos - cols.balancePos) : Infinity;
    if (distDebit <= distCredit && distDebit <= distBalance) {
      result.debit = value;
    } else if (distCredit <= distDebit && distCredit <= distBalance) {
      result.credit = value;
    } else {
      result.balance = value;
    }
  }
  return result;
}

export function parseTransactions(rawText: string): ParsedTransaction[] {
  const format = detectBankFormat(rawText);
  if (format === "fidelity") {
    return parseFidelityTransactions(rawText);
  }

  // Detect column layout from header row (may be null for PDFs without explicit headers)
  const colPositions = detectDebitCreditColumns(rawText);

  const rawLines = rawText.split("\n");
  const transactions: ParsedTransaction[] = [];

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Find all date matches and use the second (Value Date) when present, else the first
    const allDateMatches = [...line.matchAll(/\d{1,2}[\/\-](\d{2}|[A-Za-z]{3})[\/\-]\d{2,4}/g)];
    if (allDateMatches.length === 0) continue;

    const chosenMatch = allDateMatches.length >= 2 ? allDateMatches[1] : allDateMatches[0];
    const normalizedDate = parseDateString(chosenMatch[0]);
    if (!normalizedDate) continue;

    // Skip outgoing/debit keyword rows
    if (isOutgoingRow(line)) continue;

    const amounts = line.match(/[\d,]+\.\d{2}/g);
    if (!amounts || amounts.length === 0) continue;

    const parsedAmounts = amounts.map(a => parseFloat(a.replace(/,/g, "")));

    let credit = 0;

    if (colPositions) {
      // Use column-position-based assignment when we have a header
      const cols = extractAmountsByColumnPosition(rawLine, colPositions);
      // Skip rows where debit column has a value but credit column is zero
      if (cols.debit > 0 && cols.credit === 0) continue;
      credit = cols.credit;
    } else if (parsedAmounts.length >= 3) {
      // No header detected: assume [debit, credit, balance] order (most common)
      // Last amount is balance; second-to-last is credit; third-to-last is debit
      const debit = parsedAmounts[parsedAmounts.length - 3];
      const creditCandidate = parsedAmounts[parsedAmounts.length - 2];
      if (debit > 0 && creditCandidate === 0) continue; // outgoing row
      credit = creditCandidate;
    } else if (parsedAmounts.length === 2) {
      // Assume [credit, balance]: credit is the smaller/first amount
      const first = parsedAmounts[0];
      const second = parsedAmounts[1];
      credit = first < second ? first : second;
    } else if (parsedAmounts.length === 1) {
      const lowerLine = line.toLowerCase();
      const isDebit = lowerLine.includes("debit") ||
                      lowerLine.includes("withdrawal") ||
                      lowerLine.includes("transfer out");
      if (!isDebit && parsedAmounts[0] > 0) {
        credit = parsedAmounts[0];
      }
    }

    if (credit <= 0) continue;

    const fingerprint = generateFingerprint(normalizedDate, credit, line);

    transactions.push({
      date: normalizedDate,
      credit,
      rawDescription: line,
      fingerprint
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
  
  // Try to detect column headers
  const headers = data[0]?.map(h => String(h || "").toLowerCase()) || [];
  const dateCol = headers.findIndex(h => h.includes("date"));
  const descCol = headers.findIndex(h => h.includes("desc") || h.includes("narr") || h.includes("particular"));
  const creditCol = headers.findIndex(h => h.includes("credit") || h.includes("deposit") || h.includes("amount"));
  
  // Fallback to positional if headers not found
  const useDateCol = dateCol >= 0 ? dateCol : 0;
  const useDescCol = descCol >= 0 ? descCol : 1;
  const useCreditCol = creditCol >= 0 ? creditCol : 2;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 2) continue;
    
    let dateStr = "";
    let credit = 0;
    let rawDescription = "";
    
    // Parse date
    const dateVal = row[useDateCol];
    if (dateVal) {
      if (typeof dateVal === "number") {
        // Excel serial date
        const excelDate = new Date((dateVal - 25569) * 86400 * 1000);
        dateStr = excelDate.toLocaleDateString("en-GB");
      } else {
        dateStr = String(dateVal);
      }
    }
    
    // Parse description
    if (row[useDescCol]) {
      rawDescription = String(row[useDescCol]);
    }
    
    // Parse credit amount
    const creditVal = row[useCreditCol];
    if (creditVal) {
      const parsed = parseFloat(String(creditVal).replace(/,/g, ""));
      if (!isNaN(parsed) && parsed > 0) {
        credit = parsed;
      }
    }
    
    if (!dateStr || credit <= 0) continue;
    
    // Check for existing fingerprint or generate new one
    const existingFingerprint = row[3] ? String(row[3]) : null;
    const fingerprint = existingFingerprint || generateFingerprint(dateStr, credit, rawDescription);
    
    transactions.push({
      date: dateStr,
      credit,
      rawDescription,
      fingerprint
    });
  }
  
  return transactions;
}
