# General School analytics — Phase 2

Branch: `claude/email-ingest-realtime`.

## Delivered

- `/portal` and `/portal/admin` open General School for the main administrator. Sub-administrators keep their school dashboard.
- `/portal/admin/general` is a separate, read-only management page. It lists database school records and each school's recorded academic term/session; missing periods display **Not recorded**.
- `/portal/admin/schools` offers **General School — All Schools** alongside the existing branches. General School is a navigation choice, not a school record.
- `/portal/admin/school/:schoolId` validates the school before mounting the existing operational dashboard. Selected schools survive refresh; browser Back restores the previous view.
- Desktop and mobile dashboard selectors offer a return to General School. Selecting a branch remounts the operational dashboard with the real school ID.
- Main-admin guards protect General School and the selection screen, including direct URLs. A sub-administrator cannot open another school's dashboard through the new route. Existing API authorization remains authoritative.
- Loading, empty and failed school-list responses have explicit states and retry support.
- Portal root routes now use `/` instead of an empty path: Wouter treats an empty path as a wildcard, which previously intercepted deeper portal routes. Users, Profile and the new management routes now match their intended pages.

## Scope and data boundaries

This phase delivers navigation and the management landing page. Aggregated population, admissions, withdrawals, finance, academic and attendance reporting are Phase 3. The landing page displays no invented analytics totals. It reads the existing main-admin-only `/api/admin/schools` endpoint and school-specific recorded periods.

General School's selector value is translated directly to a page destination. It is never assigned to the operational `selectedSchoolId` state or sent as an API school UUID. Existing authentication prefetch continues to cache real school data for offline use; the management page adds no mutation or school-operation queries.

No server, database schema, migration, financial calculation or deployment changes are required for Phase 2. Phase 1's unapplied historical migration remains a separate release requirement.

## Changed files

- `client/src/App.tsx` — role-sensitive default page and explicit portal routes.
- `client/src/lib/admin-navigation.ts` — real-school destinations and access checks.
- `client/src/pages/general-school.tsx` — dedicated management page and shared school selection.
- `client/src/pages/admin-school.tsx` — validated operational school-route boundary.
- `client/src/pages/admin-dashboard.tsx` — initialize the selected real school and navigate between views.
- `scripts/tests/admin-navigation.test.ts` — navigation and school access unit tests.
- `scripts/tests/admin-navigation.browser.mjs` — browser navigation, authorization and responsive checks.
- `package.json`, `package-lock.json` — Playwright development dependency and navigation test commands.

## Validation

- Existing isolated regression suite plus navigation unit tests: **58 passing**.
- Browser suite: **7 passing**, including desktop (1440px), mobile (390px), five navigation choices, branch switching, refresh, Back, sub-admin restrictions, student/signed-out restrictions, invalid school IDs, empty/error states and account navigation.
- Production build: passes.
- TypeScript check: retains **123 existing diagnostics** from the Phase 1 baseline; no new diagnostics.
- Desktop/mobile screenshots inspected; the new page has no horizontal overflow at 390px.

The browser tests intercept API responses with explicit fixtures and block service workers; they never access a database. Live database/server integration cannot be verified in this workspace without the corresponding local configuration. No production migration or deployment was run.

To reproduce:

```sh
node --import tsx --test scripts/tests/*.test.ts
npx playwright install chromium
# In a separate terminal:
npx vite --host 127.0.0.1 --port 5173
# With that local frontend running:
npm run test:navigation:browser
npm run build
npm run check
```

`NAVIGATION_TEST_URL` can override the browser test URL. All test API calls are intercepted.
