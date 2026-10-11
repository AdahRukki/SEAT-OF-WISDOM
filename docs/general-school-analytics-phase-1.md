# General School Analytics: Phase 1

Branch: `claude/email-ingest-realtime`. This phase supplies historical data;
General School navigation, aggregate dashboards and exports follow in later phases.

## Required migration

Review and explicitly apply `scripts/migrations/20261011_student_history.sql` to
an approved database before releasing this code. It is not included in application
startup migrations. No production migration or deployment is part of this change.
The migration uses one transaction, creates three additive tables, indexes and
triggers, and is safe to rerun. Do not use `db:push` as a substitute: Drizzle does
not install the history triggers or perform the evidence-based backfill.
Lifecycle writes check that the migration's tables and triggers are installed
and fail before changing the student if they are missing or disabled.

The tables are:

- `student_status_events`: immutable admissions, explicit withdrawals,
  readmissions, graduations, transfers and class changes. Identity, school/class
  names and administrative context are retained independently of current records.
- `student_history_commands`: immutable command receipts for safe retries.
- `student_population_snapshots`: immutable student-level baselines and closing
  term censuses, unique by school/session/term/kind.

The historical tables deliberately have no cascading foreign keys. Student,
class, user or school cleanup does not remove them. Updates, deletions and
truncation of these tables are rejected by database triggers. Existing financial
audit writes still use `payment_audit_logs`; the event ledger supplements that
activity log rather than replacing it.

## Recorded behavior

Student creation, bulk imports, account reactivation, explicit status changes,
school transfers, class rollback, individual promotion and bulk promotion record
history in the same transaction as the student mutation. An event failure rolls
back the student/account change and command receipt. School locks serialize term
closure with lifecycle operations; row locks protect individual transitions.

An explicit withdrawal uses the academic period stored on the student's actual
school. Multiple-school batches preserve each school's period. Repeated clicks
while already withdrawn do not change the withdrawal's period. Re-enabling a
withdrawn account is a readmission, preserves its earlier withdrawal and clears
only the mutable current status fields. Disabling an account does not constitute
a withdrawal. Assessments and attendance never create withdrawal events.

Transfers produce a transfer-out and a transfer-in event and update the student's
user-school association. They do not create another academy admission. The
student number remains reserved after a transfer. Promotions now save their
existing promotion ledger and permanent history atomically. Rollback refuses to
readmit a withdrawn student implicitly.

`studentType` remains the financial classification. Payment confirmation may
continue to change it without changing the admission event. New registrations
record the explicit new-admission action and its school's period. Returning
registrations do not claim an original admission date, period or class unless
the administrator supplies those details.

## API metadata and replay contract

Existing lifecycle endpoints accept `clientRequestId` and optional `reason`.
Actor identity/role is taken from authentication, never the request body. A
request key is retained in the first HTTP attempt and the offline queue. An old
withdrawal replay after a subsequent readmission is a no-op. Reusing a key with
different command details returns a conflict. Unkeyed identical current-state
transitions also produce no duplicate events; old unkeyed queued requests cannot
be distinguished from new instructions, so clients must supply keys.

Registration additionally accepts `admissionDate` (`YYYY-MM-DD`),
`admissionTerm`, `admissionSession`, `admissionClassId` and `admissionCategory`.
Term and session must be supplied together. The original class must belong to
the registration school. Returning students' omitted original facts remain
unknown. New admissions use the registration action's date when no historical
date is supplied; this behavior is never applied to backfilled records.

Bulk import replay keys depend on the normalized worksheet rows, target class
and row index. Re-saving identical content in a new Excel file preserves keys.
Successful rows in an interrupted batch are skipped on retry. Identical rows at
different indices remain distinct students. Changes to the rows/order/class
constitute a different import; this does not attempt to match children by names.

The protected inspection endpoints are:

- `GET /api/admin/students/:id/history`: main administrators see the complete
  ledger; other permitted staff see only events attributed to their school.
- `GET /api/admin/student-population-snapshots`: main administrators only;
  optional `schoolId`, `session`, and `term` filters. Missing periods are unknown.

## Population and historical limits

A baseline is a census observed when this migration runs, not a historical
term-end population. A term-end census is frozen transactionally when a school's
explicit term/session changes. It retains individual statuses, account flags,
names and historical classes. Account disablement is separate from enrolment
status. The closing census can distinguish active, withdrawn and graduated
students; it is not a cumulative count of everyone who attended during the term.

Promotion events for that precise period recover the class before promotion,
even when students move before the school advances its session. Existing bulk
promotion records are reliable evidence of Third Term, school, session and FROM
class and are imported once. Legacy individual promotions used global academic
information; unresolved class membership is `null` with
`historicalClassVerified: false`. Current names copied during a legacy import
are identified by the event's `promotion_ledger` source, not asserted as the names
used in an old issued document.

Existing registration timestamps, current classes and mutable `studentType` do
not prove original admission facts. They become `legacy_observation` events with
unknown admission dates/periods/classes. Existing withdrawn/graduated status
fields are preserved as unverified legacy evidence when no reliable event
exists. The old global withdrawal periods cannot be safely certified per school.
No earlier readmission/withdrawal history that was already erased can be
recovered. A school with no explicit academic period has unknown event periods,
and no period census is invented for it.

These tables require reporting code to use verification flags and source/kind:
never treat unknown fields as zero, count both transfer events as admissions, or
count unverified legacy status evidence twice alongside verified events. Closed
snapshots remain unchanged if an administrator reopens a period. Corrections to
closed history will require a separately reviewed append-only correction design.
Global-only calendar changes do not close an explicitly configured school's
period; school-period changes are the census boundary.

## Verification

`npm run test:history` runs the actual migration, extracted storage methods and
browser request function against disposable PGlite databases and mocked network
failures. It requires no live database. The PGlite development dependency also
makes the existing `scripts/tests/*.test.ts` suite reproducible.

Tests cover immutable admission classification after payment-type changes,
unknown backfill, four-school populations, per-school withdrawal periods,
readmission, duplicate/concurrent requests, transfers, persistent student numbers,
authorization, promotion history, term closure, immutability, transaction rollback,
offline request keys and normalized bulk import keys. Build/type-check results and
the pre-existing TypeScript baseline are recorded in the delivery summary.

Validation completed: all 56 tests in `scripts/tests/*.test.ts` passed, including
14 new history/browser tests. The production build passed. `npm run check`
reports 123 existing diagnostics versus 126 on the untouched starting commit;
there are no new diagnostic locations in the changed implementation. The three
independent PDF, SMS and email parser scripts also passed. Seven older integration
scripts could not initialize because no development `DATABASE_URL`/server is
configured in this environment.

The older `scripts/test-*.ts` integrations that import the application database or
exercise a development HTTP server require a separately approved disposable
PostgreSQL/server fixture. They must not be pointed at production as a substitute.
