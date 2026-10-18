// Similarity is evidence for human review, never permission to discard money.
export interface DuplicateCredit {
  schoolId?: string | null;
  transactionDate: Date;
  amount: string;
  transactionType?: string | null;
  rawDescription: string;
  reference?: string | null;
  smsAccount?: string | null;
  emailFrom?: string | null;
  smsSender?: string | null;
  bankFormat?: string | null;
  status?: string | null;
}

const noise = new Set(('TRF TRANSFER TRANSFERS FROM TO VIA NIP MOB MOBILE WEB WEBAPP ONB USSD POS ATM REF REFERENCE FT INT INTERBANK RTGS BANK FIDELITY ACCESS ZENITH MONIEPOINT PAYMENT PAYMENTS INSTANT CREDIT CR NGN NAIRA ONLINE TRANSACTION').split(' '));
function words(text: string): string[] {
  return [...new Set(text.normalize('NFKD').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').split(/\s+/)
    .filter(word => word.length >= 3 && !/\d/.test(word) && !noise.has(word)))];
}

function sender(text: string): string | null {
  const normalized = text.toUpperCase().replace(/\s+/g, ' ').trim();
  // Prefer the actual sender, so a shared recipient such as the school's
  // account holder cannot make two unrelated parents look alike.
  const from = normalized.match(/\b(?:TRANSFER|TRF)\s+FROM\s+(.+?)(?=\s+TO\b|[|/*]|$)/);
  if (from) return from[1];
  const trf = normalized.match(/\bTRF\s+(.+?)\s+TO\b/);
  if (trf) return trf[1];
  const channel = normalized.match(/^(.+?)\s*\/\s*(?:MOB|WEBAPP|WEB|NIP)\b/);
  return channel?.[1] ?? null;
}

function similarWords(a: string[], b: string[], explicitSenders: boolean): boolean {
  if (!a.length || !b.length) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length === 1) {
    return explicitSenders && long.length === 1 && short[0].length >= 5 && short[0] === long[0];
  }
  // Accept changed word order, channel/reference noise, and a truncated final
  // name. Require two substantial shared words; amount/day alone never match.
  const available = [...long];
  let shared = 0;
  for (const word of short) {
    const index = available.findIndex(other => word === other ||
      (word.length >= 4 && other.length >= 4 && (word.startsWith(other) || other.startsWith(word))));
    if (index >= 0) { shared++; available.splice(index, 1); }
  }
  return shared >= 2 && shared / short.length >= 0.8;
}

function bank(row: DuplicateCredit): string | undefined {
  const value = `${row.bankFormat ?? ''} ${row.emailFrom ?? ''} ${row.smsSender ?? ''}`.toLowerCase();
  return ['fidelity', 'access', 'zenith', 'moniepoint'].find(name => value.includes(name));
}

function accountConflict(a?: string | null, b?: string | null): boolean {
  const left = a?.match(/\d+$/)?.[0];
  const right = b?.match(/\d+$/)?.[0];
  if (!left || !right || Math.min(left.length, right.length) < 3) return false;
  const length = Math.min(left.length, right.length);
  return left.slice(-length) !== right.slice(-length);
}

export function isPossibleDuplicateCredit(a: DuplicateCredit, b: DuplicateCredit): boolean {
  if (!a.schoolId || a.schoolId !== b.schoolId) return false;
  if ((a.transactionType ?? 'credit') !== 'credit' || (b.transactionType ?? 'credit') !== 'credit') return false;
  if (a.status === 'ignored' || b.status === 'ignored') return false;
  const amount = Number(a.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount !== Number(b.amount)) return false;
  if (!Number.isFinite(a.transactionDate.getTime()) || !Number.isFinite(b.transactionDate.getTime()) ||
      a.transactionDate.toISOString().slice(0, 10) !== b.transactionDate.toISOString().slice(0, 10)) return false;
  const bankA = bank(a), bankB = bank(b);
  if ((bankA && bankB && bankA !== bankB) || accountConflict(a.smsAccount, b.smsAccount)) return false;
  const refA = a.reference?.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const refB = b.reference?.replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (refA && refB) return refA === refB;
  const senderA = sender(a.rawDescription), senderB = sender(b.rawDescription);
  if (senderA && senderB) return similarWords(words(senderA), words(senderB), true);
  // If only one format identifies the sender, compare that name with the
  // other narration rather than comparing both full account-holder strings.
  return similarWords(words(senderA ?? a.rawDescription), words(senderB ?? b.rawDescription), false);
}
