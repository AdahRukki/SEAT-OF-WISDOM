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
