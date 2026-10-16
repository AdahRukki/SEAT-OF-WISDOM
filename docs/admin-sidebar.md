# Administrator sidebar

The existing ten dashboard pages now use a grouped sidebar. The standalone Users route, General School and school chooser also remain available. No backend permission, payment, reconciliation, student, assessment or report-card logic is changed.

## Navigation

- Overview: General School and school chooser (main administrators), school overview when permitted.
- Students: Students.
- Academics: Scores, Ratings, Report cards.
- Finance: Finance; existing payment recording, ledger, broadsheet and reconciliation stay inside this page.
- Administration: Settings, News & notifications, Inquiries, Activity log, plus the standalone Users page for main administrators.

Desktop widths of at least 1024px show a sidebar that can collapse to icons with tooltips. Smaller screens use the existing Radix Sheet drawer primitive, with focus trapping, Escape-to-close, return focus on dismissal and focus on page content after selecting a destination. The drawer reserves no content width. Desktop collapse and group preferences are stored per signed-in user; unavailable storage does not prevent navigation.

Existing paths are unchanged. Dashboard pages can be linked with `?tab=finance`, `?tab=students`, `?tab=reports`, etc. Old links without a page parameter select the first permitted page. Role and permission changes select only permitted pages, including activity-only accounts. The active group expands on navigation. Related controls/tabs inside pages are retained.

Changing school carries only a valid page parameter, never school-specific student/class query parameters. The existing school guard and school-keyed dashboard remount remain intact; school-scoped query keys remain unchanged. From General School, a school-operation link opens the school chooser, whose branch links retain the intended page.

## Verification

`npm run test:sidebar` verifies original permission mapping, direct-link fallbacks and school/page selection. `npm run test:sidebar:browser` includes the existing navigation browser suite and dedicated desktop, 390px phone and 820px tablet checks, focus, Escape, saved preferences, back/forward, deep links, school changes and existing workflow access. API calls are intercepted in browser tests; no production database or payments are changed.

The Admin sidebar checks GitHub Actions workflow builds the real production bundle, runs regressions and Chromium browser checks, and compares TypeScript diagnostic categories with the prior commit. The current repository has pre-existing TypeScript errors; the workflow fails for additional diagnostic categories/counts. Legacy Replit package-mirror URLs are resolved to the public npm registry only in the CI runner before installing the locked versions.

The implementation was prepared through connected GitHub tools because this session's local filesystem is read-only. Local in-memory checks verify parsing, TypeScript diagnostics and navigation logic; full build/browser results are reported from Actions when available. No production deployment or migration is part of this change.

## Server update

On the VPS, use the existing repository and service:

```bash
cd /var/www/SEAT-OF-WISDOM
git switch claude/email-ingest-realtime
git pull --ff-only origin claude/email-ingest-realtime
npm ci
npm run build
```

After checks pass, restart only the application's existing PM2 or systemd service using its actual configured name. This change requires no database migration. For installed web apps, reconnect, reopen and accept Update now when offered.
