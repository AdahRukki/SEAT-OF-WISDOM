# Recording a transfer by payment purpose

The recording dialog shows amount received, date, method and depositor once. Term/session come from the selected finance period. Searching for a student adds a compact allocation with tuition selected when available; each allocation has a student, purpose and amount. **Add allocation** supports other purposes or students. Reference and notes are collapsed under **More details**. A sticky footer shows allocated/remaining amounts and a single **Record payment** button.

The new `/api/payments/records/batch` endpoint writes one pending parent payment and audit entry, plus a purpose-bearing split for every student/purpose allocation in one database transaction. No excess is reassigned to miscellaneous. Pending and confirmed tuition payments, including legacy split shares, reserve tuition balance. Amounts above the remaining balance are rejected with an explanation. Missing historical charges must be verified before recording tuition against them. Unknown historical discounts are not reconstructed.

Submission keys, a transaction advisory lock, and record keys protect offline/slow-network replays. Student row locks serialize tuition checks between batch submissions. A failed row rolls back all records and audits. Existing single/multi endpoints remain compatible with older queued submissions; those legacy endpoints do not acquire the new batch locks. Amount/purpose edits to existing payments still use their existing workflows.

All top finance cards now describe tuition: confirmed, expected, outstanding, collection rate and students owing. Only confirmed tuition contributes to collections. Other purposes remain in records and the ledger. Unverified historical charges are excluded from expected/outstanding/rate and explicitly flagged. The active-student scope of the ledger remains unchanged. This change does not reclassify previously recorded miscellaneous payments.

Validation uses disposable PostgreSQL (PGlite), including rollback, replay, scope, pending/confirmed balance and cent-precision checks. Install PGlite in the development workspace only (not needed in production):

```bash
npm install --no-save --package-lock=false @electric-sql/pglite
node --liftoff-only --import tsx --test scripts/tests/payment-batch.test.ts
npm run build
```

Startup adds nullable `purpose` to `fee_payment_student_splits`. Older splits use their parent purpose when this is null. Mixed-purpose transfers retain each allocation purpose in tuition totals, student history and ledger exports. Confirmation/reversal applies to the parent and therefore all its allocations. The confirmation card shows one total and expandable allocation details.

Existing separate records saved by the previous batch implementation are not merged or deleted automatically: some may already be confirmed or linked to bank transactions. Replaying their original submission key returns those existing records without creating a new parent. Only new submissions use the corrected layout. Review existing affected batches before any financial repair.
