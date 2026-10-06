# Recording a transfer by payment purpose

The recording dialog starts with a purpose (tuition when available) and an amount. Select the student, then use **Add another payment** for books, uniforms or another purpose. For multiple students, the first purpose retains student allocations; each additional row identifies its student explicitly. Date, depositor, method and reference apply to every row. The review section compares the breakdown with **Amount received** using cents.

The new `/api/payments/records/batch` endpoint writes a separate pending payment record and audit entry for every student/purpose row in one database transaction. No excess is reassigned to miscellaneous. Pending and confirmed tuition payments, including legacy split shares, reserve tuition balance. Amounts above the remaining balance are rejected with an explanation. Missing historical charges must be verified before recording tuition against them. Unknown historical discounts are not reconstructed.

Submission keys, a transaction advisory lock, and record keys protect offline/slow-network replays. Student row locks serialize tuition checks between batch submissions. A failed row rolls back all records and audits. Existing single/multi endpoints remain compatible with older queued submissions; those legacy endpoints do not acquire the new batch locks. Amount/purpose edits to existing payments still use their existing workflows.

All top finance cards now describe tuition: confirmed, expected, outstanding, collection rate and students owing. Only confirmed tuition contributes to collections. Other purposes remain in records and the ledger. Unverified historical charges are excluded from expected/outstanding/rate and explicitly flagged. The active-student scope of the ledger remains unchanged. This change does not reclassify previously recorded miscellaneous payments.

Validation uses disposable PostgreSQL (PGlite), including rollback, replay, scope, pending/confirmed balance and cent-precision checks. Install PGlite in the development workspace only (not needed in production):

```bash
npm install --no-save --package-lock=false @electric-sql/pglite
node --liftoff-only --import tsx --test scripts/tests/payment-batch.test.ts
npm run build
```

No database schema migration is required.
