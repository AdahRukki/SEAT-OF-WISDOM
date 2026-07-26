---
name: Historical class membership & score filing
description: Promotion ledger is the source of truth for which class a student was in during a session; assessment upsert must never re-file past scores.
---

The assessment upsert matches on student+subject+term+session (ignoring class), so any save can move a row's classId. Rule: keep an existing row's classId when (a) a promotion record for that student+session says they were promoted FROM the stored class, or (b) the row's session is older than the school's current session.

**Why:** Promotion happens at end of Third Term *before* the school's session advances, so a "current session" check alone is not enough — regenerating reports right after promotion re-filed old scores under the new class, emptying past-session rosters. The promotion ledger (promotion_records) is the authoritative record of a student's class per session; historical rosters and score fetches also union/exclude by it.

**How to apply:** Any code that writes or fetches assessments by class for a past session must consult promotion_records, not the student's current classId. Client Scores tab keeps unsaved inputs in `scoreInputs`; it must be cleared on class/term/session/subject changes or empty strings shadow fetched scores (`'' ?? x` returns `''`).
