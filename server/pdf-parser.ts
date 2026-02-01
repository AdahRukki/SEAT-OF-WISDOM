import * as XLSX from "xlsx";
import * as crypto from "crypto";
import { createRequire } from "module";

// Use createRequire for pdf-parse (CommonJS module in ESM context)
const require = createRequire(import.meta.url);
const pdfParseModule = require("pdf-parse");
// Handle both module.exports = fn and { default: fn } patterns
const pdfParse = pdfParseModule.default ?? pdfParseModule;

export interface ParsedTransaction {
  date: string;
  credit: number;
  rawDescription: string;
  fingerprint: string;
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  if (!data.text || data.text.trim().length === 0) {
    throw new Error("Scanned PDF detected - cannot extract text. Please use a text-based PDF or convert to Excel.");
  }
  return data.text;
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

export function parseTransactions(rawText: string): ParsedTransaction[] {
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  const transactions: ParsedTransaction[] = [];

  for (const line of lines) {
    // Match dates in DD/MM/YYYY or DD-MM-YYYY format
    const dateMatch = line.match(/\d{2}[\/\-]\d{2}[\/\-]\d{4}/);
    if (!dateMatch) continue;

    // Extract all amounts from the line
    const amounts = line.match(/[\d,]+\.\d{2}/g);
    if (!amounts || amounts.length === 0) continue;

    // Parse all amounts and find the positive one (credit)
    const parsedAmounts = amounts.map(a => parseFloat(a.replace(/,/g, "")));
    
    let credit = 0;
    
    // Strategy 1: If we have multiple amounts, check for credit/debit pattern
    if (parsedAmounts.length >= 2) {
      // Common bank format: [debit, credit] or [amount, balance]
      // Look for the second-to-last as credit if last looks like running balance (large number)
      const lastAmount = parsedAmounts[parsedAmounts.length - 1];
      const secondLast = parsedAmounts[parsedAmounts.length - 2];
      
      // If last amount is much larger (likely balance), use second-to-last
      if (lastAmount > secondLast * 10 && secondLast > 0) {
        credit = secondLast;
      } else {
        // Take the last positive amount that's not unreasonably large
        for (let i = parsedAmounts.length - 1; i >= 0; i--) {
          if (parsedAmounts[i] > 0 && parsedAmounts[i] < 10000000) {
            credit = parsedAmounts[i];
            break;
          }
        }
      }
    } else if (parsedAmounts.length === 1) {
      // Single amount - check if line indicates credit (not debit/withdrawal)
      const lowerLine = line.toLowerCase();
      const isDebit = lowerLine.includes("debit") || 
                      lowerLine.includes("withdrawal") || 
                      lowerLine.includes("transfer out") ||
                      lowerLine.includes("payment to");
      
      if (!isDebit && parsedAmounts[0] > 0) {
        credit = parsedAmounts[0];
      }
    }

    if (credit <= 0) continue;

    // Normalize date format to DD/MM/YYYY
    const normalizedDate = dateMatch[0].replace(/-/g, "/");
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
