/**
 * Conservative, count-aware pre-import duplicate detection.
 * The same bank credit may arrive through an email alert and a statement
 * with DIFFERENT SHA fingerprints (email hashes a running balance).
 *
 * Only strong matches are auto-skipped: same school (enforced by the query),
 * bank, calendar date, amount and complete normalized narration, or an exact
 * fingerprint. A depositor-only match is NOT enough to discard a payment.
 * Existing rows are consumed one-for-one: two identical credits in a statement
 * with only one matching email retain one new credit.
 */
export interface StatementCredit {
  date: string; // DD/MM/YYYY
  credit: number;
  rawDescription: string;
  fingerprint: string;
}
export interface ExistingCredit {
  id: string;
  schoolId: string | null;
  transactionDate: Date | string;
  amount: string | number;
  transactionType: string;
  rawDescription: string;
  fingerprint: string;
  source: string | null;
  bankFormat?: string | null;
  smsAccount?: string | null;
  emailFrom?: string | null;
  emailSubject?: string | null;
}
export interface BankAccountHint {
  maskedAccountNumber: string;
  bankName: string;
}
export interface SkippedStatementCredit {
  date: string;
  amount: number;
  description: string;
  existingTransactionId: string;
  existingSource?: string;
  reason: "exact_fingerprint" | "existing_bank_credit";
}
export interface StatementImportPlan {
  imports: StatementCredit[];
  skipped: SkippedStatementCredit[];
}

export function normalizeBankName(name: string | null | undefined): string | null {
  const s = (name ?? "").toLowerCase();
  if (/zenith/.test(s)) return "zenith";
  if (/fidelity/.test(s)) return "fidelity";
  if (/moniepoint/.test(s)) return "moniepoint";
  if (/access/.test(s)) return "access";
  return null;
}
export function normalizeCreditNarration(narration: string): string {
  return narration.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
export function creditDateKey(date: Date | string): string {
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }
  const str = String(date).trim();
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const iso = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso?.[1] ?? "";
}
function creditKey(date: Date | string, amount: string | number, description: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "";
  const day = creditDateKey(date);
  const narration = normalizeCreditNarration(description);
  if (!day || !narration) return "";
  return `${day}|${n.toFixed(2)}|${narration}`;
}
function bankForExisting(row: ExistingCredit, accounts: BankAccountHint[]): string | null {
  if ((row.source ?? "statement") === "statement") {
    return normalizeBankName(row.bankFormat);
  }
  if (row.smsAccount) {
    const account = accounts.find(a => a.maskedAccountNumber.trim() === row.smsAccount?.trim());
    if (account) return normalizeBankName(account.bankName);
  }
  // Fallback for legacy emails not mapped to an account.
  return normalizeBankName(`${row.emailFrom ?? ""} ${row.emailSubject ?? ""}`);
}

export function planStatementImport(
  incoming: StatementCredit[],
  existing: ExistingCredit[],
  options: { schoolId: string | null | undefined; bankFormat: string | null | undefined; accounts?: BankAccountHint[] },
): StatementImportPlan {
  const bank = normalizeBankName(options.bankFormat);
  const accounts = options.accounts ?? [];
  const usedExisting = new Set<string>();
  const existingByFingerprint = new Map<string, ExistingCredit[]>();
  const existingByCredit = new Map<string, ExistingCredit[]>();

  for (const row of existing) {
    if (row.transactionType !== "credit" || row.schoolId !== (options.schoolId ?? null)) continue;
    // Do not let records from another bank cause an automatic skip.
    const rowBank = bankForExisting(row, accounts);
    if (!bank || rowBank !== bank) continue;
    const byFingerprint = existingByFingerprint.get(row.fingerprint) ?? [];
    byFingerprint.push(row);
    existingByFingerprint.set(row.fingerprint, byFingerprint);
    const key = creditKey(row.transactionDate, row.amount, row.rawDescription);
    if (!key) continue;
    const group = existingByCredit.get(key) ?? [];
    group.push(row);
    existingByCredit.set(key, group);
  }

  // Prefer identifying an earlier email over an older uploaded statement.
  // Preserve one-to-one matching for genuine repeated credits.
  const rank = (s: string | null) => s === "email" ? 0 : s === "sms" ? 1 : 2;
  for (const group of existingByCredit.values()) {
    group.sort((a, b) => rank(a.source) - rank(b.source));
  }

  const imports: StatementCredit[] = [];
  const skipped: SkippedStatementCredit[] = [];
  for (const tx of incoming) {
    const exact = (existingByFingerprint.get(tx.fingerprint) ?? [])
      .find(row => !usedExisting.has(row.id));
    const narration = normalizeCreditNarration(tx.rawDescription);
    // Full narration match, never a name-only or amount-only guess.
    const key = creditKey(tx.date, tx.credit, tx.rawDescription);
    const matching = !exact && narration.length >= 16
      ? (existingByCredit.get(key) ?? []).find(row => !usedExisting.has(row.id))
      : undefined;
    const found = exact ?? matching;
    if (found) {
      usedExisting.add(found.id);
      skipped.push({
        date: tx.date, amount: tx.credit, description: tx.rawDescription,
        existingTransactionId: found.id,
        existingSource: found.source ?? "statement",
        reason: exact ? "exact_fingerprint" : "existing_bank_credit",
      });
    } else {
      imports.push(tx);
    }
  }
  return { imports, skipped };
}
