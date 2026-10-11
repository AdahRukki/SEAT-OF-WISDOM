# General School analytics — Phase 5

Branch: `claude/email-ingest-realtime`.

## Delivered exports

Main administrators can download Excel (`.xlsx`) and PDF management reports from General School:

1. General School overview — combined executive metrics, school comparisons and completeness.
2. School-by-school population — combined counts, branch censuses and historical class breakdowns.
3. New admission register — original admissions, all registration events, payment confirmation, class counts and time grouping.
4. Withdrawal and readmission report — unique students versus events, cohort rates, reasons, historical class/name registers and current status.
5. Financial performance comparison — combined/branch revenue, tuition, balances, collection rates, verification gaps and receipt/assigned-period breakdowns.
6. Historical term/session comparison — both selected periods, every combined/branch metric, absolute differences, percentage changes, units and coverage.

Choose Management report above the displayed report, then Download Excel or Download PDF. Opening population/admissions/withdrawal/finance sections selects the corresponding export. Academic and attendance sections select the overview. Comparison exports appear only after a comparison has loaded; they include all metrics, regardless of the chart's selected metric.

## Matching the dashboard

Exports use the same authenticated reporting API response currently displayed. They do not issue another database query, recalculate financial totals, average school percentages or modify records. Report generation time and export time are both included, so managers can distinguish the captured data from the download date. Refresh reports to include later database changes.

Applied schools, real school IDs, historical class selection, session, term, pass threshold and inclusive UTC event/receipt dates are included. Comparison files identify both periods and explain that date filters do not apply. School-specific current periods remain visible when branches use different academic periods.

Registers export all returned records, including those beyond the current table page or excluded by local search. The new-admission sheet contains only original `new` admissions; a separate registration-event sheet preserves returning registrations and readmissions.

Exports retain N/A, partial-history warnings, unfinished-session status and academic limitations. Missing historical tuition evidence remains unavailable rather than zero. Raw numbers remain numeric in Excel; percentage values stay in percentage units with explicit number formats. Rate differences use percentage points. Spreadsheet names/reasons that resemble formulas remain literal string cells.

## Presentation and access

Both formats carry Seat of Wisdom Academy branding and school names. Excel includes a Filters and coverage sheet, labelled tables, numeric formats and autofilters. PDFs use the configured academy logo when available, a branded header, embedded DejaVu Sans, searchable vector text, repeated table headers and page numbering. Wide tables split into readable column bands with repeated identity columns; long rows continue without truncating their remaining text. Comparison tables keep all seven columns together.

Font and PDF/workbook modules load when exporting; the font is served by this application, without a third-party font request. If a logo cannot be loaded, academy text branding remains. If required export assets fail, no empty file is downloaded and the user can retry. Unapplied filters and changed comparison controls disable the corresponding export buttons. Repeated clicks while preparing a download are ignored.

Access remains main-admin only, enforced by the existing General School guard and reporting APIs. There is no new public export endpoint or additional reporting permission. Report data stays excluded from the persisted offline query cache. Downloaded files are generated locally from the already-authorized report response.

## Files changed

- `shared/analytics-export.ts` — one typed, pure report-document model for the six reports, scope metadata, completeness and filenames.
- `shared/analytics-metrics.ts` — shared comparison metric names/units, reused by the dashboard and exports.
- `client/src/lib/analytics-display.ts` — re-export shared metric definitions without changing display behavior.
- `client/src/lib/analytics-export-files.ts` — Excel generation and paginated vector PDF generation.
- `client/src/lib/download-analytics-export.ts` — lazy export loading, local font/logo assets and browser downloads.
- `client/src/components/analytics/export-controls.tsx` — download progress, duplicate-click protection and retryable errors.
- `client/src/components/analytics/general-school-analytics.tsx` and `historical-comparisons.tsx` — report selection and exports from displayed responses.
- `client/src/assets/fonts/DejaVuSans.ttf`, `LICENSE-DejaVu.txt` — embedded font and its distribution notices.
- `scripts/tests/analytics-export.test.ts`, `general-school-analytics.browser.mjs` and `package.json` — serialized-file and browser verification.

## Validation

- Full isolated regression suite: **80 passing**.
- Export unit suite: **5 passing**, covering all report models, workbook roundtrips, zero versus N/A, literal spreadsheet text, scope/date/period metadata, preserved names, comparison metrics, Unicode PDF text, long rows, wide tables, last records and page numbering. PDF extraction uses the existing `pdf-parse` dependency.
- Analytics browser suite: **8 passing**, including desktop/mobile downloads of all six report types in both formats, register search/pagination independence, exact workbook values, displayed-response reuse, missing-asset retries and disabled exports for unapplied filters.
- Existing navigation browser suite: **7 passing**, including main-admin/sub-admin/student restrictions and branch navigation.
- Final download-specific browser run: **3 passing** after PDF layout refinements.
- `npm run build`: passes; existing CSS deprecation and bundle-size warnings remain.
- `npm run check`: **123 existing diagnostics**, with no new locations/error codes/messages introduced by this phase.
- A downloaded PDF was rendered and inspected locally; branding, readable cells, notes and pagination were verified.

Tests use deterministic browser/API fixtures and isolated PGlite databases. No live database migration, production deployment or external report sharing was performed. No new migration is required for Phase 5; Phase 1's reviewed student-history migration remains required for live analytics. Historical gaps and ambiguous score/tuition classification cannot be reconstructed by exports. Live-data downloads remain unverified until a configured environment and reviewed migration are available.

Phase 6 is the final cross-phase verification and review.
