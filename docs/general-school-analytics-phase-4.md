# General School analytics — Phase 4

Branch: `claude/email-ingest-realtime`.

## Delivered interface

Main administrators now open a dedicated reporting dashboard at `/portal` or `/portal/admin/general`. It reads the Phase 3 reporting APIs. The school directory and existing branch administration remain available through the existing routes.

- Executive overview: combined summary cards, coverage badges, school population chart and school comparison table.
- Population: current or saved census counts, school/class breakdowns, new/returning/unknown classification, graduation/withdrawal counts and previous-census growth.
- New enrolment: original admissions versus readmissions, payment confirmation, weekly/monthly/term/session charts, class breakdowns and a searchable full-name admission register with 20-row pagination.
- Withdrawals and retention: unique students and event counts, current status versus selected-period history, cohort rates, reasons, class breakdowns, withdrawal and readmission registers.
- Finance: confirmed revenue, tuition received/expected/applied/outstanding, students owing, collection rate, branch comparisons, payment assignment periods and monthly receipt charts. Existing server financial calculations remain the source.
- Academic performance: student-weighted scores, explicit pass threshold, exam percentage, pass trends, subject comparisons, school/class breakdowns and incomplete-result indicators.
- Attendance: combined student-day percentage, coverage and missing-record counts, school/term charts and class breakdowns. Genuine zero attendance displays as `0%`.
- Historical comparisons: term comparison across sessions, whole-session comparison, or terms within sessions; combined and school values, absolute differences, percentage changes, metric charts and coverage details. Rate differences are labelled in percentage points.

## Filters and record integrity

The filter form supports All Schools, any individual branch or multiple branches, recorded academic sessions, term, real or preserved historical class, inclusive UTC date range and pass threshold. Changes take effect only after Apply filters. Applied scope and report generation time remain visible. Reset returns to each school's current academic period.

Date ranges affect admission/withdrawal events and payment receipt dates only. Population, attendance, assessments and tuition balances retain their academic-period meaning. Comparisons use applied school/class/threshold filters, with independently selected periods; date ranges do not affect them.

No fabricated General School UUID or new school record is introduced. Main-admin authorization remains enforced before the dashboard mounts and on the reporting APIs. School operations remain on their existing branch routes.

Unknown values display as N/A rather than zero. Partial event counts explicitly say recorded only. Unfinished sessions and missing historical censuses are labelled. Academic results remain provisional because legacy zero defaults and exact approved subject selections are unverifiable. Historical tuition classification/balance gaps remain N/A; charts do not turn missing values into zeros or join lines across missing values.

Every chart has a table of its exact values. Tables scroll within their own containers on mobile, filters and navigation wrap, and class details expand on demand. Search and pagination operate on the register returned by the reporting API; no separate dashboard totals are entered manually.

Management queries are keyed by authenticated user, refetched on mount and excluded from the existing persisted offline query cache. Failed requests show retry controls and do not continue displaying old figures as current.

## Additive API metadata

- `/api/admin/analytics/periods` also returns scoped class identities/names, including archived classes proved by immutable snapshots. The existing reporting scope validates these IDs.
- Readmission registers include the saved class name and student number. The interface uses the event's historical class name instead of inferring it from the current census.
- `shared/general-school-analytics-contracts.ts` exposes type-only response contracts. Browser code does not import the server reporting implementation at runtime.

## Files changed

- `client/src/components/analytics/general-school-analytics.tsx` — API queries, applied filters and section navigation.
- `client/src/components/analytics/report-sections.tsx` — the seven management report sections and admission time grouping.
- `client/src/components/analytics/historical-comparisons.tsx` — comparison controls, tables, charts and coverage.
- `client/src/components/analytics/report-elements.tsx` — reusable metric cards, charts, tables, registers and coverage notices.
- `client/src/lib/analytics-display.ts` — value formatting, stable filter serialization and metric definitions.
- `client/src/pages/general-school.tsx` — connect the dashboard to the General School view.
- `client/src/lib/queryClient.ts` — exclude management reporting data from offline persistence.
- `shared/general-school-analytics-contracts.ts`, `server/analytics-repository.ts`, `server/general-school-analytics.ts` — typed responses and additive historical metadata.
- Browser fixtures/tests, reporting regression assertions and `package.json` — verification scripts.

## Validation and remaining work

- Full isolated regression suite: **75 passing**.
- Final analytics suite: **17 passing**, including current/archived class metadata and saved readmission details.
- Existing navigation browser suite: **7 passing**, including main admin, sub-admin, student/signed-out restrictions and mobile branch switching.
- Analytics browser suite: **5 passing**, covering all dashboard sections at 1440px and 390px, register search/pagination, class expansion, zero attendance, applied filters, archived classes, term/session comparisons, N/A baselines, retries, GET-only requests and offline-cache exclusion.
- `npm run build`: passes. Existing CSS deprecation and large-bundle warnings remain.
- `npm run check`: retains **123 existing TypeScript diagnostics**, with no new diagnostics introduced by this phase.
- Desktop/mobile screenshots were inspected locally. Browser APIs use deterministic test fixtures; PostgreSQL reporting tests use isolated PGlite databases.

No new database migration is required for Phase 4. Phase 1's `scripts/migrations/20261011_student_history.sql` remains required before live reporting. No live migration or production deployment was run. Historical gaps cannot be reconstructed by this interface; missing score completion and historical tuition-purpose evidence remain limitations.

Phase 5 adds Excel/PDF management exports from these same reporting responses. Production data rendering remains unverified until the reviewed migration and an appropriately configured environment are available.
