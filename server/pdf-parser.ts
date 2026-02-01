import * as XLSX from "xlsx";
import * as crypto from "crypto";
import { createRequire } from "module";

// Use createRequire for pdf-parse (CommonJS module in ESM context)
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

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

export function parseTransactions(rawText: string): ParsedTransaction[] {
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  const transactions: ParsedTransaction[] = [];

  for (const line of lines) {
    const dateMatch = line.match(/\d{2}\/\d{2}\/\d{4}/);
    const amounts = line.match(/[\d,]+\.\d{2}/g);

    if (!dateMatch || !amounts || amounts.length < 2) continue;

    const credit = parseFloat(amounts[1].replace(/,/g, ""));
    if (credit <= 0) continue;

    const fingerprint = generateFingerprint(dateMatch[0], credit, line);

    transactions.push({
      date: dateMatch[0],
      credit,
      rawDescription: line,
      fingerprint
    });
  }
  return transactions;
}

export function generateFingerprint(date: string, amount: number, description: string): string {
  const data = `${date}|${amount}|${description}`;
  return crypto.createHash("sha256").update(data).digest("hex");
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
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 3) continue;
    
    let dateStr = "";
    let credit = 0;
    let rawDescription = "";
    
    if (row[0]) {
      if (typeof row[0] === "number") {
        const excelDate = new Date((row[0] - 25569) * 86400 * 1000);
        dateStr = excelDate.toLocaleDateString("en-GB");
      } else {
        dateStr = String(row[0]);
      }
    }
    
    if (row[1]) {
      rawDescription = String(row[1]);
    }
    
    if (row[2]) {
      credit = parseFloat(String(row[2]).replace(/,/g, ""));
    }
    
    if (!dateStr || credit <= 0) continue;
    
    const fingerprint = row[3] ? String(row[3]) : generateFingerprint(dateStr, credit, rawDescription);
    
    transactions.push({
      date: dateStr,
      credit,
      rawDescription,
      fingerprint
    });
  }
  
  return transactions;
}
