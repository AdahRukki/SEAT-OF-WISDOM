# Bulk student receipts

In Finance > Ledger, set school, class, term/session and confirmation-date filters. Open the actions menu and choose **Print / download student receipts**. Select individual payments or all filtered payments, then Print or Download PDF (up to 2,000 receipts per batch).

Only confirmed payments qualify. One parent payment shared across students produces one receipt per student; that student's purpose allocations appear together. Multiple parent payments for a student retain separate receipts. This does not create, split or confirm any payment.

PDFs are ordered by class, surname, first name, student ID and payment date. Each A4 page has three receipt slots and cut lines. Long breakdowns continue in additional slots with the same number and a continuation indicator; the student's total appears only on the last slip. Amounts use NGN. Dates and confirmation times use Africa/Lagos. The school's configured logo is used, or the academy logo if none is configured. If the image cannot load, the school name still prints. Print opens the PDF in another browser tab; download is available if mobile printing or pop-ups are restricted.

The server checks school permissions and locks/rechecks confirmed payment parents before issuing. Receipt numbers use a global database sequence with a unique payment/student pair. Gaps in the sequence are normal. First issuance saves immutable details, including the student's class at issuance (not a reconstructed historical class). Reprints retain those details and the receipt number. Issuance/reprint are audited. Reversed payments cannot be reprinted; changed financial details after issuance require review rather than silently reusing an old receipt. Printed copies cannot be recalled after a reversal.

Deployment requires `npm ci`, build and PM2 restart. Startup creates `payment_student_receipts`; existing payments are not rewritten. Receipt data must be included in normal database backups. No production data or receipt numbers were used in development testing.
