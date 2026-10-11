# General School analytics — release preparation

The six-phase feature delivery is commit `7e315b1624356cfa561bb45c3896cdd783e7ee25` on `claude/email-ingest-realtime`. This release-preparation commit adds a read-only database inspection and removes automatic schema changes from the Replit post-merge hook. It does not deploy or apply a migration.

## Confirmed release setup

`.replit` configures Replit Autoscale, `npm run build`, `npm run start`, and port 5000. It also invokes `scripts/post-merge.sh` when merging code into the Replit project. That hook previously ran `npm run db:push`; it now installs locked dependencies with `npm ci` only. Pulling this release must not substitute an automatic Drizzle schema push for an approved migration.

The application still has existing startup migrations in `server/index.ts` and starts its email poller when launched. Do not use `npm run dev` or `npm run start` as a read-only database inspection. No change to those existing startup behaviors is included here.

The selected workspace has no `DATABASE_URL` or Replit deployment identity. GitHub access does not provide access to the live Replit app/database. The target app URL/project and deployment access must be identified before executing this release.

## Concrete migration for approval

File: [`scripts/migrations/20261011_student_history.sql`](../scripts/migrations/20261011_student_history.sql).

SHA-256: `3be7212988bb1beebed0e26122971f6abff203c4328be83f788caf9042e1a940`.

The reviewed, transactional migration adds three history tables, indexes, lifecycle/immutability triggers and evidence-based legacy backfill. It does not create a fifth school or invent old admission dates. It has been applied and rerun against disposable PostgreSQL fixtures. No application-startup or post-merge command applies it automatically.

Approval must identify the target live database and explicitly authorize applying this file and publishing the release. The user's implementation plan requires this explicit approval; a generic request to continue the completed phases does not identify the target or authorize these live actions.

## Release sequence for the approved target

1. Identify the Replit project, its connected database, the currently deployed version and the exact branch/release commit. Keep `main` untouched. Record the existing deployed version for code recovery.
2. Confirm a current database backup through the provider and preserve its recovery reference. Check the migration fingerprint against the value above.
3. In the target's database SQL console, run [`check_student_history.sql`](../scripts/migrations/check_student_history.sql). It uses `BEGIN TRANSACTION READ ONLY`, identifies the database, lists prerequisite/history tables, checks the six required history triggers and lists real school periods. It does not display credentials, student names or financial records and does not alter data. All prerequisite tables must exist; confirm the four expected schools and their configured periods.
4. After explicit approval, run the reviewed migration in that same identified database, with SQL error handling enabled. Do not run `db:push` instead. A failed migration must be corrected before publishing; its transaction must not be bypassed.
5. Run the read-only inspection again. All history tables must exist, all six triggers must be enabled, and the four school records must remain. Review unknown legacy history as unverified evidence, rather than manufacturing old totals.
6. Build the release and publish it through the identified Replit project using its configured `npm run build` / `npm run start` deployment. Starting the application executes its existing startup migrations and poller, so this belongs to the approved deployment action.
7. Sign in as main administrator and verify General School, all four branch links, current academic periods, realistic combined/individual figures, historical comparisons and Excel/PDF downloads. Confirm coverage/N/A warnings for unavailable history. Verify a sub-admin cannot access General School or its reporting endpoints. Check the existing branch payment and student workflows in the approved verification environment.
8. Record the live release version, migration outcome and verification evidence. If publication fails, use the recorded previous deployed code version; preserve the new history tables and records. Do not drop history or restore an old database over subsequent administrative/financial changes as a routine code rollback.

## Verification already available

The feature delivery passed 83 regression tests, 18 browser/acceptance tests, parser regressions and build. Its 123 existing TypeScript diagnostics remain unchanged. Both release-preparation tests passed: they exercise the hook with a fake npm executable and the inspection SQL with a disposable PGlite database, without connecting to production. The hook also passes `bash -n`, and package dependency declarations match the lockfile.

For the full acceptance matrix, data limitations and reproduction commands, see [the final verification report](general-school-analytics-phase-6.md). Historical evidence gaps, the existing TypeScript baseline, live-data rendering and production performance remain release limitations until the target environment is verified.
