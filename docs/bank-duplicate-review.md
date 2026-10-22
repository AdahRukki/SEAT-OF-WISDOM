# Email and statement duplicate review

New bank credits now use the same similarity check whether they arrive from a
statement, an automatic email alert, SMS, or approval of a parsed email.
Exact fingerprint duplicates retain the existing uniqueness protection.

Possible duplicates require the same school, transaction calendar date and
amount, plus a matching reference or similar sender/narration. Matching tolerates
channel/reference noise, punctuation, word order and truncated names. Conflicting
known banks, account suffixes or references exclude a pair. A match is flagged
for review; it is never automatically deleted or treated as a confirmed payment.
The review panel labels each entry's source.

Insertion and checking share a database transaction. A failed comparison rolls
back that entry. Statement uploads report any entries that could not be saved;
retrying skips the exact fingerprints already saved. Concurrent inserts within a
school are serialized during the check.

After deployment, choose School 2, open reconciliation's statement upload history,
and use the existing re-scan action for the relevant statement. This checks stored
entries against earlier credits, including emails. It retains existing flags and
respects pairs marked Not a duplicate. Deployment does not automatically change
historical records or run the re-scan.

Limits: differing transaction dates, missing school routing, or narrations without
enough identifying text still need manual review. Genuine repeated payments can
be flagged; compare the two entries before dismissing either one.

Focused verification: `node --import tsx --test scripts/tests/bank-duplicate-match.test.ts`.
