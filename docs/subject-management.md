# Subject management

Open **Academics → Subject management** as a main administrator. Select the source subject and the subject to retain, then click **Merge Subjects**. You can preview first. A direct merge pauses for a choice only when the same student, class, session and term have different marks. Select the assessment to keep for each conflict and submit again. The merge can be reviewed and restored from **Merge History**.

## Merge and recovery behaviour

- The merge accepts duplicate names after case and whitespace normalisation. The database rejects new duplicates and writes using archived subject IDs.
- The executor locks the subject, assignment, assessment, and report dependencies and checks that the selected subjects, assignments and assessments still match the preview. The transaction backs up the complete input rows before it changes them.
- Identical CA and exam marks are consolidated automatically, with preference given to the retained subject’s existing record. Zero and a missing mark are distinct. When marks conflict, the administrator chooses a complete original assessment. The rejected records remain in the backup.
- Each affected class keeps one assignment. The retained subject’s existing assignment takes precedence. Where several candidate assignments exist for that subject, a custom name takes precedence over a blank name, then the assignment ID breaks ties. The backup retains every original assignment and custom name.
- Published, previously generated and historical periods use their captured pre-change subject and score data in report and published-score views. The first capture for a period is immutable. Current unpublished score-entry views use live assessments. A snapshot preserves the subject and score inputs visible before the change. It cannot reconstruct data already lost or altered before capture. Attendance, behaviour and other non-subject report inputs continue to come from their existing sources.
- Recovery verifies that the relevant live rows still match the merge result. It restores original assessment and assignment IDs and archives the operation and both administrators in history. Recover successive merges in reverse order. If scores, subjects or class assignments changed after a merge, recovery stops before it can overwrite that work. Historical report copies remain available after recovery.
- Master configuration is versioned per academic session and normalised class name. Synchronisation adds missing subjects across matching classes and keeps branch-specific assignments. It stops for unmatched or ambiguous class names, subject-name conflicts or an inactive session. Merge aliases resolve to the retained subject in saved versions. The version and preview revision are checked at apply time.

## Automatic database migration

Startup calls `migrateSubjectManagement()` before accepting requests. Version 1 creates or updates the archive registry and its write guards, duplicate prevention, historical subject lists, versioned master configurations, sync history, recoveries, and frozen report snapshots. It records completion in `subject_management_migrations` and uses a PostgreSQL advisory lock to prevent concurrent installation. The changes are additive and transactional. The app database role needs ownership or permission to create these objects and install the triggers. Startup stops if the migration fails.

The migration reads SQL from the checkout's `server/` directory. Keep that directory beside `dist/` in packaged deployments. No merge or master write flags are required. Migration itself performs no merges.

## Test and release procedure

For testing, create a disposable PostgreSQL database named `subject_management_test` on localhost. Point `DATABASE_URL` at it and apply the base schema using `npm run db:push -- --force`. Then run:

```bash
SUBJECT_TEST_DATABASE_URL="$DATABASE_URL" node --import tsx --test scripts/tests/subject-management-postgres.test.ts
```

The integration test seeds four schools and leaves fixtures for the browser test. Start the production build pointed at the same disposable database and set `SUBJECT_TEST_BASE_URL` to the local application URL. Run:

```bash
SUBJECT_TEST_DATABASE_URL="$DATABASE_URL" node --test scripts/tests/subject-management.browser.mjs
```

Set `CHROMIUM_EXECUTABLE_PATH` if Chromium is installed outside Playwright. Recreate the disposable database before rerunning the fixture suite.

## VPS deployment and rollback

Before deploying, record the live Git SHA and take a PostgreSQL backup of `sowa_academy` using the VPS's configured backup role. Validate that the dump can be listed with `pg_restore --list`. Keep the backup private because it contains student records.

Use the reviewed feature tip and a clean checkout. From the VPS, run:

```bash
cd /var/www/SEAT-OF-WISDOM && test -z "$(git status --porcelain)" && git fetch origin feature/subject-management-safe-merge && git merge --ff-only FETCH_HEAD && npm ci && npm run build && pm2 restart seatofwisdom --update-env
```

Check PM2 logs for startup and migration success. Verify an administrator can load the subject audit and preview a duplicate before making the first merge. The fast-forward check stops deployment if the VPS branch has diverged.

Before any merge or synchronisation, an application rollback consists of rebuilding the previously recorded commit and restarting PM2. Leave the additive schema installed. After subject operations, prefer in-app recovery for individual merges. An older application can read the consolidated live data and lack the preserved report paths, so resolve affected operations or restore a verified pre-deploy database backup in a maintenance window before reverting to older code. A full PostgreSQL restore discards database changes after the backup. Account for later school activity before deciding to restore the whole database.
