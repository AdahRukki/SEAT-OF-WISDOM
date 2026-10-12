export function recoveryEligible(row: any): boolean {
  return !!row && row.review_status === 'open' && !row.linked_transaction_id
    && ['unparsed', 'error'].includes(row.outcome);
}
export function assertRecoveryIdentity(state: any, mailboxInfo: any, row: any, message: any, bank: string): void {
  if (!state || String(state.uid_validity) !== String(mailboxInfo.uidValidity))
    throw new Error('Mailbox UID validity changed; recovery stopped.');
  if (row.uid > Number(state.last_processed_uid)) throw new Error('UID is ahead of the listener; allow normal ingestion.');
  if (!message?.source || message.uid !== row.uid) throw new Error('Requested Gmail message is missing.');
  const from = message.envelope?.from?.[0]?.address || '';
  const domain = bank === 'access' ? /^[^@]+@(?:accessbankplc\.com|accessbank\.com)$/i : /^[^@]+@fidelitybank\.ng$/i;
  if (!domain.test(from) || from.toLowerCase() !== (row.from_address || '').toLowerCase()
      || (message.envelope?.subject || '') !== row.subject)
    throw new Error('Gmail identity does not match the saved failed alert.');
  const actual = new Date(message.envelope?.date).getTime();
  const stored = new Date(row.received_at).getTime();
  if (!Number.isFinite(actual) || !Number.isFinite(stored) || actual !== stored)
    throw new Error('Email date does not match the saved record.');
}
