const pdfParse = require('pdf-parse');

interface ParsedTransaction {
  date: string;
  description: string;
  credit: number;
  debit: number;
  reference: string;
  balance?: number;
}

interface PDFParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  error?: string;
  rawText?: string;
}

export async function parsePDFBankStatement(buffer: Buffer): Promise<PDFParseResult> {
  try {
    const data = await pdfParse(buffer);
    
    if (!data.text || data.text.trim().length === 0) {
      return {
        success: false,
        transactions: [],
        error: "PDF appears to be scanned or contains no extractable text. Please upload a text-based PDF or Excel file."
      };
    }

    const rawText = data.text;
    const transactions = parseTransactionsFromText(rawText);

    if (transactions.length === 0) {
      return {
        success: false,
        transactions: [],
        error: "Could not identify any transactions in the PDF. Please check the format or use Excel/CSV instead.",
        rawText: rawText.substring(0, 1000)
      };
    }

    return {
      success: true,
      transactions,
      rawText: rawText.substring(0, 500)
    };
  } catch (error: any) {
    return {
      success: false,
      transactions: [],
      error: `Failed to parse PDF: ${error.message}`
    };
  }
}

function parseTransactionsFromText(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  const datePatterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})/,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
  ];

  const amountPattern = /[\d,]+\.?\d{0,2}/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    let dateMatch: RegExpMatchArray | null = null;
    let dateStr = '';
    
    for (const pattern of datePatterns) {
      dateMatch = line.match(pattern);
      if (dateMatch) {
        dateStr = dateMatch[1];
        break;
      }
    }

    if (!dateStr) continue;

    const amounts = line.match(amountPattern);
    if (!amounts || amounts.length === 0) continue;

    const numericAmounts = amounts
      .map(a => parseFloat(a.replace(/,/g, '')))
      .filter(a => !isNaN(a) && a > 0);

    if (numericAmounts.length === 0) continue;

    let credit = 0;
    let debit = 0;
    let balance: number | undefined;

    const lineUpper = line.toUpperCase();
    const isCreditIndicator = lineUpper.includes('CR') || 
                               lineUpper.includes('CREDIT') || 
                               lineUpper.includes('DEPOSIT') ||
                               lineUpper.includes('TRANSFER FROM') ||
                               lineUpper.includes('RECEIVED');
    
    const isDebitIndicator = lineUpper.includes('DR') || 
                              lineUpper.includes('DEBIT') || 
                              lineUpper.includes('WITHDRAWAL') ||
                              lineUpper.includes('TRANSFER TO') ||
                              lineUpper.includes('PAYMENT');

    if (numericAmounts.length >= 2) {
      if (numericAmounts.length >= 3) {
        balance = numericAmounts[numericAmounts.length - 1];
        if (isCreditIndicator) {
          credit = numericAmounts[0];
        } else if (isDebitIndicator) {
          debit = numericAmounts[0];
        } else {
          credit = numericAmounts[0];
          debit = numericAmounts[1];
        }
      } else {
        credit = numericAmounts[0];
        debit = numericAmounts[1];
      }
    } else {
      const amount = numericAmounts[0];
      if (isCreditIndicator) {
        credit = amount;
      } else if (isDebitIndicator) {
        debit = amount;
      } else {
        credit = amount;
      }
    }

    if (credit === 0 && debit === 0) continue;

    let description = line;
    description = description.replace(dateStr, '').trim();
    for (const amt of amounts) {
      description = description.replace(amt, '').trim();
    }
    description = description.replace(/\s+/g, ' ').trim();

    let reference = '';
    const refMatch = line.match(/(?:REF|TRN|TXN|ID)[:\s#]*([A-Z0-9]+)/i);
    if (refMatch) {
      reference = refMatch[1];
    }

    transactions.push({
      date: dateStr,
      description: description || 'Bank Transaction',
      credit,
      debit,
      reference,
      balance
    });
  }

  return transactions;
}

export function convertTransactionsToRows(transactions: ParsedTransaction[]): any[] {
  return transactions.map(tx => ({
    date: tx.date,
    description: tx.description,
    credit: tx.credit > 0 ? tx.credit : '',
    debit: tx.debit > 0 ? tx.debit : '',
    reference: tx.reference,
    balance: tx.balance || ''
  }));
}
