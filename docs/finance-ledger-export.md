# Ledger with payment records

In Finance → Ledger, select school, term, session and any student filters. Under Actions choose **Ledger with payment records**.

The Excel file contains:
- Ledger summary: one row per matching student.
- Payment records: confirmed payments, with recorded and confirmed times in Nigeria time. A split payment contributes only that student's allocation.
- Filters and totals: the selection used and matching summary/detail totals.

Pending and reversed records are excluded. The detailed export always includes student IDs and payment details, regardless of the table's visible columns. It fetches fresh data at click time and uses those records for the summary totals. No payment data is modified.

## First payments

Choose confirmation dates, then select **Students to include → First payment in these dates**. Available on Ledger and Broadsheet. A term and session must also be selected.

This means the earliest currently confirmed payment for that student in the selected term/session, across all payment purposes. It is not the student's first payment ever, nor the bank transfer date. Earlier direct and split payments are checked before applying the date range. Students with an unknown historical confirmation time are excluded because their first confirmation cannot be established reliably.

All payments within the range for qualifying students contribute to totals, not only the first payment. Date boundaries use Nigerian midnight, including the complete final day. Clearing dates also clears the first-payment selection.

## Verification

Run `node --import tsx --test scripts/tests/ledger-export.test.ts` and `npm run build`.

Tests cover date boundaries, earlier payments, split allocations, unknown timestamps, workbook serialization, totals and API school scope. These are fixture tests; they do not access the production database.

## Ledger correction: tuition, names and historical periods

- Approval of a name-change request now invalidates the ledger query. Ledger data also refreshes on mount/window focus, and an open detail view follows the refreshed student entry. Approval updates and profile changes commit in one transaction.
- `totalPaid` remains all confirmed payments. `tuitionPaid` contains only payments whose recorded purpose matches a school fee type marked as tuition (including inactive tuition types); `nonTuitionPaid` contains the remainder. Direct payments and each student's split share follow identical rules. Renamed/deleted historical purpose definitions cannot be reconstructed automatically.
- Tuition status, outstanding/full-payment filters and balances use `tuitionPaid`. Other payments are never inferred from excess tuition. Downloads, mobile cards, details and table totals share those fields. `totalAssigned`/`balance` in this ledger now refer to tuition; this is not an all-fee debt report.
- A unique bulk promotion source class for the selected session is authoritative. Otherwise a unique assessment class for the selected term/session supplies historical membership. Current periods can fall back to the current class. Missing/conflicting historical membership is shown as unverified under All classes, not silently attributed to today's class.
- Explicit tuition assignments in `student_fees` for the selected term/session are used as recorded charges; today's discount is not subtracted again. For the current period only, configured class/type tuition and current discount are used when there is no saved assignment. Past periods without a saved tuition charge show **Not verified**, even when a class rate exists: old individual discounts were not snapshotted. All-term views also omit unverified tuition balances. This repair does not manufacture or backfill historical charges.
- Missing charges are excluded from outstanding/fully-paid filters and identified in the UI and workbook. Displayed tuition charge/balance totals include only verified charges; collected payment totals remain complete for the included active students. The pre-existing active-student-only scope has not changed.

Regression checks (uses a disposable in-memory PostgreSQL database; never production):

```bash
npm install --prefix /tmp/sowa-ledger-test --ignore-scripts --no-audit --no-fund @electric-sql/pglite
PGLITE_TEST_MODULE=/tmp/sowa-ledger-test/node_modules/@electric-sql/pglite/dist/index.js node --liftoff-only --import tsx --test scripts/tests/ledger-corrections.test.ts scripts/tests/ledger-export.test.ts scripts/tests/payment-integration.test.ts
npm run build
```
