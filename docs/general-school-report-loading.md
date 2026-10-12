# General School report-loading recovery

The original dashboard displayed the same message for every failed report request: “Management reports could not be loaded. Historical records may need to be prepared.” That message did not establish whether the history migration was missing, the selected scope was invalid, a connection failed or another reporting query failed.

The updated reporting API and dashboard distinguish these cases:

- Missing history tables or missing/disabled lifecycle/immutability triggers: HTTP 503, `STUDENT_HISTORY_NOT_READY`, and “History setup required.” The protected API includes the exact missing objects.
- Invalid filters/scope: a filter-specific explanation.
- Forbidden access: main-administrator sign-in explanation.
- Network/offline failures: reconnect explanation.
- Other service failures: a separate unavailable/request-failed message. Unexpected backend errors include a unique support reference matching the server log, without exposing raw SQL or connection details in the browser.

Retry reports also reloads academic-period metadata, so completing setup restores school/session/class filters along with the report. The app never creates missing history, changes database schema or replaces unavailable records with invented totals during a retry.

## Read-only terminal diagnosis

In the actual app's terminal, on `claude/email-ingest-realtime`, pull the committed update and run:

```bash
git pull --ff-only origin claude/email-ingest-realtime
npm ci
npm run analytics:status
```

`analytics:status` uses the app's configured database driver and a read-only, repeatable-read transaction. It does not import application startup, run startup migrations, start email polling or modify records. It reports only history readiness, missing table names and missing/disabled trigger names; no database URL, password, student names or payment data is printed.

- `ready: false`: complete the approved database setup. Pulling code and running `npm run build` do not apply the history migration. Review `scripts/migrations/20261011_student_history.sql` and obtain explicit approval for the target live database before applying it. If tables exist but triggers are absent/disabled, setup is still incomplete.
- `ready: true`: history setup is present. Build/restart the updated application, retry the report, and use its error reference to identify any remaining backend failure in the server logs.
- Configuration/connection error: run this in the connected app terminal and verify its database configuration. Do not paste database passwords or connection URLs into diagnostic output.

The status command exits with 0 only when history setup is ready; incomplete setup or an inspection failure exits with 1. It performs no repair automatically. Application restart/deployment retains the existing release-approval boundary because startup executes the application's existing migrations and background jobs.

## Verification

- Five targeted regressions pass: actual protected missing-setup responses, recovery after the real migration in a disposable database, disabled trigger diagnostics, immutable-history verification, generic SQL-failure support references, safe error translation and the no-connection CLI path.
- The database/API/browser acceptance suite has four passing cases, including a mobile setup-error → disposable migration → Retry reports → loaded overview and restored academic filters flow.
- The analytics calculation/route suite has 20 passing cases.
- Existing dashboard/export browser checks pass; the first cold navigation under concurrent build load required a rerun after Vite had warmed up.
- Full regression suite, production build and the unchanged TypeScript baseline are recorded in the delivery response.

The live database was not inspected or modified from this workspace because it has no configured app database/deployment connection. The user's reported live failure cannot be certified as a missing migration until the actual app's status/error output is available. Test migrations ran only inside disposable PGlite databases. For the reviewed migration fingerprint and deployment procedure, see [release preparation](general-school-analytics-release.md).
