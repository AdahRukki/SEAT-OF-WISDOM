# General School analytics — Phase 3

Branch: `claude/email-ingest-realtime`. This phase adds the reporting backend; dashboard charts and tables are Phase 4.

## Delivered APIs

All endpoints are authenticated, **main administrator only**, read-only and return `Cache-Control: private, no-store`.

| GET endpoint | Response |
| --- | --- |
| `/api/admin/analytics/overview` | All six reports and shared metadata |
| `/api/admin/analytics/population` | Combined, school and class population counts; previous-period growth |
| `/api/admin/analytics/admissions` | Original new admissions, readmissions, payment confirmation, names and time buckets |
| `/api/admin/analytics/withdrawals` | Official withdrawals, readmissions, registers, reasons, class/school counts, cohort rates |
| `/api/admin/analytics/finance` | Recorded confirmed revenue, tuition, balances, collection rates and receipt/assigned-period breakdowns |
| `/api/admin/analytics/academics` | Student-weighted scores, explicit pass threshold, subject/class/school/period breakdowns |
| `/api/admin/analytics/attendance` | Attendance, school/class/period comparisons and record completeness |
| `/api/admin/analytics/periods` | Actual recorded periods and their available data sources |
| `/api/admin/analytics/comparison` | Original/comparison values, differences and percentage changes, combined and by school |

## Filter contract

The shared Zod schemas are in `shared/general-school-analytics.ts`; report responses are typed as `GeneralSchoolReport` by the reporting service.

- Omit school IDs for All Schools. Use `schoolId=<real UUID>` or `schoolIds=<UUID>,<UUID>` for one or several branches. General School never becomes a database ID.
- `classId` must belong to a selected school. Archived classes remain filterable where immutable snapshots prove their identity and school.
- `session=2026/2027` selects an academic session. Add `term=First Term`, `Second Term` or `Third Term` for a particular term. A term requires a session; academic years must be consecutive.
- Without a session, each school uses its own current period, identified in response metadata. Schools without a usable academic period have unavailable period metrics.
- `dateFrom` and `dateTo` are inclusive UTC calendar dates. They filter admission/withdrawal occurrence dates and payment receipt dates. They do not rewrite a census, cumulative attendance or full assigned-period balances.
- `passThreshold` is a percentage from 0 to 100; the default is 40.
- Unknown filters, fake IDs, repeated school IDs, invalid dates and conflicting selections return 400. Unknown schools or a class outside the scope return 404. An unapplied Phase 1 migration returns an actionable 503.

For comparison, supply `mode=term`, `originalSession`, `originalTerm`, `comparisonSession`, `comparisonTerm`. For `mode=session`, supply both sessions; optionally provide both corresponding terms. The same school, class and pass-threshold filters apply.

## Calculation and integrity rules

Each report reads its sources in one repeatable-read, read-only database transaction. A comparison reads both periods in that same transaction. Score, attendance, payment and fee-charge reads are limited to the requested sessions; the period picker reads distinct metadata instead of all historical score/payment details.

**Population:** Closed terms use immutable `term_end` snapshots. Baselines are observations from migration time, never substitutes for missing historical censuses. Current periods use actual active students and active accounts; unknown original admissions are a separate category. A past whole session uses its Third Term closing census; an ongoing session identifies the current observation as incomplete. Overlapping branch snapshots are deduplicated by student ID for combined totals and flagged as partial. Missing branch censuses make the complete combined value `null`, while observed counts remain labelled separately.

**Admissions:** Original admission events establish new admissions independently of mutable payment `studentType`. Transfers create no new academy admission. Registers retain recorded full names, original classes and verification flags. Weekly buckets start Monday; monthly/term/session buckets use verified evidence. Original admissions, returning registrations and readmissions remain distinct. Counts in the baseline term are provisional; event coverage can become verified in subsequent periods. Growth and comparisons require covered baselines.

**Withdrawals and retention:** Only explicit withdrawal events count. Repeated withdrawal requests remain one event through Phase 1's guards; a later separate withdrawal counts as another event, while period student counts remain unique. Readmission preserves the earlier withdrawal. Withdrawal rate uses withdrawn members of the opening cohort divided by its prior closing census, avoiding inflated rates from unrelated new admissions. Retention measures opening-cohort students still active at the closing/current observation, excluding recorded graduations. Missing opening censuses and date-only cohorts yield unavailable rates; withdrawal rates also require covered event history. Current withdrawn status is reported separately from historical events and from unknown current status.

**Finance:** Confirmed parent payment records establish revenue once. For student attribution, a split receipt contributes its shares; its parent is not added again. Recorded and reversed payments are excluded. Split purposes override the parent purpose where saved. Malformed/overallocated splits are flagged; valid parent receipt revenue remains available, but uncertain tuition/balances do not become zero. Unallocated amounts are explicit. Money is summed in cents. Current tuition reuses the existing resolver and its exact scoped/type/global priorities; historical tuition uses explicit saved term charges, including historical students who later withdrew. Today's rates/discounts cannot manufacture past charges. Zero saved charges are valid zero amounts; rates with zero denominators remain `null`. Students owing are unique across periods and branches. Combined collection rate is combined applied tuition divided by combined expected tuition. Receipt-date filters affect revenue/tuition received, while balances continue to describe the entire assigned academic period.

**Academics:** The pass threshold applies to each student's mean usable total score. Each student contributes one mean, so combined averages and pass rates do not average branch percentages or weight students by their number of subjects. Existing bulk-promotion evidence restores historical class attribution when old scores were filed under the promoted class. Legacy defaults cannot distinguish a missing score from an actual zero: rows with any zero, missing or invalid component are conservatively excluded and reported as ambiguous/incomplete. Averages/pass rates are therefore provisional and accompanied by coverage flags. Exact approved subject selections are not stored; the API never claims that subject completeness was verified.

**Attendance:** Positive recorded possible days establish a denominator. An explicit zero present-day count with valid possible days represents real zero attendance. Empty or inconsistent records do not contribute zeros. Combined attendance sums present student-days and possible student-days. Missing records and unknown roster denominators are explicit. Duplicate assessment/attendance rows use the latest recorded update, count once and produce completeness warnings.

**Comparisons:** Differences require both values. Percentage change requires a nonzero, valid original value. Unknown/zero baselines return `null` for display as N/A. Rates are calculated from combined underlying numerators/denominators before comparison. Whole-session populations are not summed across terms.

## Files changed

- `shared/general-school-analytics.ts` — filter/comparison schemas and shared period/change helpers.
- `server/analytics-repository.ts` — scoped transactional source reads and period metadata.
- `server/general-school-analytics.ts` — typed report, completeness and comparison calculations.
- `server/analytics-routes.ts` — protected API registration and filter/error responses.
- `server/routes.ts` — registration using the existing authentication and main-admin guard.
- `server/storage.ts` — expose the existing tuition resolver; its calculations are unchanged.
- `scripts/tests/general-school-analytics.test.ts` — PostgreSQL-backed reporting regressions.
- `scripts/tests/general-school-analytics-routes.test.ts` — actual main-admin guard and HTTP contract tests.
- `package.json` — `npm run test:analytics`.

## Validation and release boundaries

- Analytics-specific suite: **17 passing**.
- Full isolated regression suite: **75 passing**.
- `npm run build`: passes.
- `npm run check`: retains **123 existing diagnostics**; no new diagnostics by file/error code.
- Tests cover all four schools, official lifecycle history, class/session/date filters, historical population stability, archived class selection, split payments, weighted calculations, unavailable baselines and main-admin authorization.

No new database migration is required for Phase 3. Phase 1's reviewed migration must be applied before these APIs can report history. No live migration or deployment was run. Tests use isolated PGlite PostgreSQL databases and an isolated HTTP server; production/database-server integrations remain unverified without local configuration.

Historical gaps, ambiguous score zeros, mutable fee-purpose names and absent approved subject selections remain explicit data limitations. Historical receipt revenue remains verifiable, but its tuition classification, applied balances and collection rate remain unavailable until preserved fee-purpose evidence exists; the service exposes observed values separately for review. The APIs cannot recover evidence that was never recorded. Phase 4 must display coverage warnings and N/A values alongside affected metrics, and use the reporting endpoints as the source for dashboard values.
