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
  totalCredits?: number;
  totalDebits?: number;
  transactionCount?: number;
}

export async function parsePDFBankStatement(buffer: Buffer): Promise<PDFParseResult> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    
    if (!data.text || data.text.trim().length === 0) {
      return {
        success: false,
        transactions: [],
        error: "PDF appears to be scanned or contains no extractable text. Please upload a text-based PDF or Excel file."
      };
    }

    const rawText = data.text;
    console.log('[PDF Parser] Raw text length:', rawText.length);
    
    const transactions = parseZenithBankFormat(rawText);

    if (transactions.length === 0) {
      return {
        success: false,
        transactions: [],
        error: "Could not identify any transactions in the PDF. The format may not be recognized.",
      };
    }

    const totalCredits = transactions.filter(t => t.credit > 0).reduce((sum, t) => sum + t.credit, 0);
    const totalDebits = transactions.filter(t => t.debit > 0).reduce((sum, t) => sum + t.debit, 0);

    console.log(`[PDF Parser] Found ${transactions.length} transactions. Credits: ${totalCredits}, Debits: ${totalDebits}`);

    return {
      success: true,
      transactions,
      totalCredits,
      totalDebits,
      transactionCount: transactions.length
    };
  } catch (error: any) {
    console.error('[PDF Parser] Error:', error);
    return {
      success: false,
      transactions: [],
      error: `Failed to parse PDF: ${error.message}`
    };
  }
}

function parseZenithBankFormat(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split('\n');
  
  const dateRegex = /^(\d{2}\/\d{2}\/\d{4})\s+(.+)/;
  const amountRegex = /[\d,]+\.\d{2}/g;
  
  let currentTransaction: {
    date: string;
    descriptionParts: string[];
    amounts: string[];
    rawLine: string;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    if (line.includes('Opening Balance') || 
        line.includes('Page ') || 
        line.includes('ZENITH BANK') ||
        line.includes('Account Statement') ||
        line.includes('DATE') && line.includes('DESCRIPTION') ||
        line.includes('ACCOUNT') ||
        line.includes('CURRENCY:') ||
        line.includes('Period:')) {
      continue;
    }

    const dateMatch = line.match(dateRegex);
    
    if (dateMatch) {
      if (currentTransaction) {
        const tx = processTransaction(currentTransaction);
        if (tx) transactions.push(tx);
      }
      
      currentTransaction = {
        date: dateMatch[1],
        descriptionParts: [dateMatch[2]],
        amounts: [],
        rawLine: line
      };
      
      const amounts = line.match(amountRegex);
      if (amounts) {
        currentTransaction.amounts = amounts;
      }
    } else if (currentTransaction) {
      currentTransaction.descriptionParts.push(line);
      const amounts = line.match(amountRegex);
      if (amounts) {
        currentTransaction.amounts.push(...amounts);
      }
    }
  }
  
  if (currentTransaction) {
    const tx = processTransaction(currentTransaction);
    if (tx) transactions.push(tx);
  }

  return transactions;
}

function processTransaction(raw: {
  date: string;
  descriptionParts: string[];
  amounts: string[];
  rawLine: string;
}): ParsedTransaction | null {
  if (raw.amounts.length < 2) return null;
  
  const fullDescription = raw.descriptionParts.join(' ').replace(/\s+/g, ' ').trim();
  
  const amounts = raw.amounts.map(a => parseFloat(a.replace(/,/g, '')));
  
  let debit = 0;
  let credit = 0;
  let balance = 0;
  
  if (amounts.length >= 3) {
    const potentialDebit = amounts[0];
    const potentialCredit = amounts[1];
    balance = amounts[amounts.length - 1];
    
    if (potentialDebit === 0 && potentialCredit > 0) {
      credit = potentialCredit;
    } else if (potentialCredit === 0 && potentialDebit > 0) {
      debit = potentialDebit;
    } else {
      debit = potentialDebit;
      credit = potentialCredit;
    }
  } else if (amounts.length === 2) {
    const amount = amounts[0];
    balance = amounts[1];
    
    const descLower = fullDescription.toLowerCase();
    if (descLower.includes('cr/') || descLower.includes('charge') || 
        descLower.includes('debit') || descLower.includes('nip cr/') ||
        descLower.includes('cip/cr/') || descLower.includes('airtime')) {
      debit = amount;
    } else {
      credit = amount;
    }
  }
  
  if (debit === 0 && credit === 0) return null;
  
  if (fullDescription.toLowerCase().includes('charge') && 
      !fullDescription.toLowerCase().includes('school')) {
    return null;
  }
  if (fullDescription.toLowerCase().includes('stamp duty')) {
    return null;
  }
  
  let reference = '';
  const refPatterns = [
    /\/(\d{20,})\//,
    /\|(\d+):/,
    /ZMO\d+/,
    /AT\d+/
  ];
  
  for (const pattern of refPatterns) {
    const match = fullDescription.match(pattern);
    if (match) {
      reference = match[0];
      break;
    }
  }
  
  let cleanDescription = fullDescription;
  cleanDescription = cleanDescription.replace(/[\d,]+\.\d{2}/g, '').trim();
  cleanDescription = cleanDescription.replace(/\s+/g, ' ').trim();
  
  const datePart = raw.date;
  cleanDescription = cleanDescription.replace(new RegExp(datePart.replace(/\//g, '\\/'), 'g'), '').trim();

  return {
    date: raw.date,
    description: cleanDescription || fullDescription,
    credit,
    debit,
    reference,
    balance
  };
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
