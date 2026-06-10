---
name: SMS bank-alert ingestion
description: Design decisions & gotchas for the automatic credit-alert SMS → reconciliation webhook
---

# Automatic SMS bank-alert ingestion

One Android phone (Tasker) forwards every bank SMS to `POST /api/ingest/sms`. Credit
alerts become `unmatched` `bank_transactions` rows (`source='sms'`), routed to a school
by masked account number via the `school_bank_accounts` lookup table.

## Non-obvious decisions / gotchas

- **Tasker `%TIMES` is epoch SECONDS, not milliseconds.** The webhook scales any numeric
  `receivedAt < 1e12` up by ×1000 before `new Date(...)`. Forgetting this stores 1970-era
  timestamps. **Why:** Android/Tasker time variables are in seconds; JS Date wants ms.

- **HTTP status is part of the contract with Tasker.** `skipped` (non-credit) and
  `duplicate` return **200** so Tasker does NOT retry; `created`/`unrouted` return 201.
  Only auth/config/rate-limit failures return 4xx/5xx. **Why:** a retry storm on a
  benign skip would flood the endpoint.

- **The webhook is intentionally PUBLIC** — the phone is not logged in. Auth is the
  shared secret `SMS_INGEST_TOKEN` in the `X-SMS-Token` header (also accepts
  `Authorization: Bearer`). Plus IP rate limiting. No audit-log row is written because
  `paymentAuditLogs.userId` is `notNull` and there is no user.

- **Fingerprint dedupe is shared with the PDF parser** (`generateFingerprint` in
  `server/pdf-parser.ts`), keyed on date + amount + normalized description + **balance**.
  Including balance lets a Zenith SMS dedupe against the later Zenith PDF row (whose parser
  also keys on balance) and stops two legit same-day/same-amount/same-payer credits from
  collapsing into one.

- **Masked account number is the routing key** and is trimmed on both the write path
  (upsert schema `.transform(trim)`) and the read path (`getSchoolBankAccountByMasked`)
  so stray whitespace never causes avoidable "unrouted" SMS. Format differs per bank:
  Zenith/Fidelity use `Acct:`, Access uses `Acc:`.

- **Unrouted SMS are kept, not dropped.** If the masked account isn't mapped, the row is
  saved with `schoolId=null` and shown with an "Unrouted" badge. Admin adds the mapping in
  the Bank Accounts tab, then "Re-route unmatched SMS" backfills `school_id`.

- Confirmed bank SMS sample shapes and the 4 account→school mappings live in
  `.local/tasks/sms-payment-ingestion.md`. Parser regression tests: `scripts/test-sms-parser.ts`.
