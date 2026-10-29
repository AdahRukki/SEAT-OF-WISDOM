# Historical tuition in Finance

Branch: `claude/email-ingest-realtime`. No production deployment or live migration was performed while preparing this change.

## What was wrong

Fee Types Management already stores exact term/session/class/student-type rates in `tuition_class_amounts`. No replacement fee table is needed. The ledger previously accepted only individual `student_fees` for historical tuition, while balances, class totals and the broadsheet used separate calculations. The broadsheet could add a configured amount to an individual tuition charge. Current class, discount and type could also leak into earlier periods.

## Shared decision

`shared/historical-tuition.ts` resolves tuition from recorded facts. The ledger, payment-entry balances, summary cards, class breakdown and tuition broadsheet use it through the same storage path; their printouts and workbooks export that result. General School Finance uses the same resolver while retaining its historical population-coverage requirements.

1. An individual tuition charge for the exact school/period wins, including an explicit zero. It is already a net charge: no additional configured tuition or discount is applied.
2. Otherwise, use the exact period's historical class/type rate; use its universal class rate if no applicable type-specific rate exists.
3. General defaults and current student information are allowed only for the school's current period.
4. Missing membership, ambiguous class, unknown required type, invalid discount or absent/conflicting applicable rates produce `Not verified` and a reason.

Existing charges, payment evidence, verified status/class events, snapshots, assessments and annual promotion records establish historical facts. Registration timestamps do not establish an admission date. Verified later admissions are excluded from earlier debt; contradictory earlier payments remain visible with an unresolved charge. Disabled accounts are not removed from historical finance. Saved charges remain usable even when their historical class cannot be resolved.

Confirmed tuition and other purposes remain separate. Existing split allocations and confirmation-date filters are retained. The broadsheet is explicitly tuition-only; it does not mix other-purpose charges into tuition debt. Summary totals are verified subtotals when some charges are unknown, and collection percentages become unavailable. Unknown amounts are not counted as verified zero debt or fully paid. Payment Status filtering continues to use existing paid/balance values.

The Finance term/session selection controls Ledger, Recording, entry balances, fee-rate editing and reports. Saved financial periods are available even if absent from the general calendar. Query keys include school and period.

Finance keeps verification explanations inside the **Data details** and **Ledger details** popups. They open only when requested and close with the close button, an outside tap or Escape. Tuition table cells show the amount or `Not verified`; the source, reason and historical discount note are available in each student's Payment Details window. Downloaded verification notes and all calculation rules remain unchanged.

## Historical limitations and reviewed corrections

Old snapshots did not retain discount or student type. Existing events may establish these facts, but missing evidence cannot be recovered automatically. If no historical discount is recorded, the exact saved class rate is shown without today's discount, with an explicit note; it is not evidence that a past concession never existed. Where type-specific prices require an unknown historical type, tuition remains unverified. Existing saved individual charges are not discounted again.

Overwritten general rates cannot verify old periods. Select the school and historical Finance term/session, open Fee Types Management and **Edit tuition rates**, enter rates from approved school records, check the verification confirmation and supply its source/reason. The server requires that confirmation and reason, validates school/class and complete period scope, and atomically records the before/after audit with the rate update. It changes only that exact scope. It does not repair ambiguous class history or invent admissions; these need authoritative history or an explicitly reviewed individual charge through existing workflows.

No old snapshots/events are rewritten. The resolver can use available financial evidence without the optional history tables, but absent historical facts remain unverified. Deactivated tuition fee types retain their exact historical rates and charges.

## Migration

File: `scripts/migrations/20261029_tuition_history_context.sql`

SHA-256: `e4d649bf189bb45a8104cee70be5e6ea22266d1eff5afd1c1ddf48f6c0ebf413`

Prerequisite: the reviewed `20261011_student_history.sql` migration and all six enabled history/immutability triggers. The new migration rejects incomplete prerequisites. It transactionally replaces only the population-capture function; it adds no tables or columns. It is not invoked by startup or post-merge hooks.

On a future actual period closure, it captures discount and effective student type and freezes applicable current general class rates into that closing period where scoped rates do not already take priority. Existing scoped rates and valid zeros survive. It cannot reconstruct already-closed periods or old discounts. Rate updates and closure use the same school-row lock. Applying this function change alone does not close a term or backfill rates.

## Deployment procedure

These are operator instructions, not actions already performed. Do not run `db:push` as a substitute for the reviewed migration.

First update code, preserving any local server edits:

```bash
cd /var/www/SEAT-OF-WISDOM
git status --short
git switch claude/email-ingest-realtime
git pull --ff-only origin claude/email-ingest-realtime
npm ci
npm run build
npm run analytics:status
sha256sum scripts/migrations/20261029_tuition_history_context.sql
```

If `analytics:status` reports missing Phase 1 objects, follow `docs/general-school-analytics-release.md` first; do not bypass the prerequisite checks. It checks Phase 1 readiness, not this new function version.

After identifying the correct production database, taking a backup and obtaining explicit approval for that target, apply the new migration with SQL error handling. The following assumes the operator's shell already has the application's `DATABASE_URL`; it does not load or print secrets:

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/migrations/20261029_tuition_history_context.sql
```

Verify the function definition includes discount/type capture and the scoped-rate insert, using a read-only SQL console:

```sql
SELECT pg_get_functiondef('sowa_capture_population(uuid,text,text,text)'::regprocedure);
```

Publish/restart through the server's existing process manager after approval. Inspect `ecosystem.config.cjs` and `pm2 list` for the actual application name rather than assuming one; Replit deployments use their existing publish workflow. Starting the application runs its existing startup migrations and email poller. Record the deployed commit and verify the live checks below before declaring the website fixed. A code rollback must preserve the additive history and recorded financial data.

## Verification

- `npm run test:regression`: 140 passing tests, including real SQL executed in disposable PGlite databases. Cases cover scoped rates without charges, historical class/type/discount, inactive accounts, later admissions, ambiguity, zeros, single-charge priority, shared totals/exports, split payments, exact-scope writes, atomic audit rollback and migration reruns/future closure.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/sowa-historical-tuition/browsers npm run test:sidebar:browser`: 21 passing browser checks against Vite and intercepted fixture APIs, including desktop/mobile shared Finance periods, an older saved year, payment-entry balances and reviewed historical-rate editing. Browser fixtures do not verify production responses.
- `npm run build`: passes.
- `npm run check`: 120 existing diagnostics versus 123 before this change; no new diagnostics, compared with `scripts/compare-sidebar-types.mjs`. Type checking does not fully pass.

On the deployed site, select a known past term with a saved class rate and no individual charge. Compare the ledger, cards, class breakdown, entry balance, broadsheet and downloads. Verify the displayed historical class/type and source, and the warning for missing discount evidence. Repeat with a saved zero charge, a disabled former student, a later admission and an unverified case. Check main/sub-admin school restrictions and normal split/payment recording. Test future closure on staging; do not advance a production school period just to test the migration.
