# Restore student balance Word download

Branch: feature/subject-management-safe-merge.

Finance → Payment Ledger now has a visible Download student balances (Word) button,
as well as the Actions menu item. Select a school, term and session; clear any
confirmation-date range first. Class, name, student-type and payment-status filters apply.

The A4 report groups students by class and uses full names. It includes active
students who have made a payment and have a verified positive tuition balance.
Zero-payment, fully paid and unverified-balance rows are excluded. It uses the
ledger's balance directly, not tuition minus all-purpose payments. Other-purpose
payments do not reduce outstanding tuition. No financial records are changed.

Validation: generated DOCX tests cover amounts, exclusion rules, full names and
class/name ordering. Production build required before deployment.
