# Niva live job-search application

> Historical baseline/deployed behavior. The newer career extension is local only; see [career-assistant.md](career-assistant.md) for feed, resume, matching, chat, configuration and retention changes.

The normal hosted experience opens real source jobs and account features by default. Landing-page actions lead to sign-in; the homepage preview uses actual retrieved listings. Demo switches, sample approval statistics and pause controls are excluded from the main real-job flow. Existing sample data, history, pause state and import remain available separately under the account's collapsed legacy-data section. Nothing is reclassified as a real application submission. The hosted display title is now **Niva — חיפוש עבודה**; the existing URL and audience are preserved.

Normal-experience verification: 156 browser cases passed across all four configurations; after the final landing-page copy/navigation changes, 44 focused journey and hosted-flow cases passed again. Frontend/server tests remained 38/18 passing, with type, format and production-build checks passing. No schema or authentication-provider configuration was changed for this release.

The hosted pilot uses the existing Niva Site, audience and URL. It now runs an Angular frontend plus a Cloudflare Worker, with D1 binding `DB`. Google/Apple/email credentials are not present in the hosted environment. The available hosted login is **Continue with ChatGPT**, using Sites dispatch's verified identity. This does not claim Google or Apple OAuth has been configured. The Node/Better Auth implementation remains available locally, including verified email/password when SMTP is configured.

## Try the journey

1. Open `/login`, choose **המשך עם ChatGPT** (or **המשך לחשבון שלי** if the hosting gate already authenticated you). The Site keeps its existing owner-only audience. A different visitor must have Site access before trying this private pilot.
2. Open `/app/profile`, enter a display name and optional professional headline, then save. CV selection validates file type/size locally; it is not an upload or analysis.
3. Open `/app/preferences`, choose district/category and any work styles. Everything is optional. For the initial feed, use **all work styles**, since the source does not specify work style. Unknown styles never masquerade as hybrid/on-site/remote.
4. Open `/app/jobs?source=real`. This first feed covers AppsFlyer's Herzliya office, not the entire Israeli job market. Save a job, open **השמורות שלי**, refresh and return after signing in again. Preferences and saved IDs belong to the authenticated identity.
5. Open job details and **פתיחת המשרה והגשה באתר המקור**. This opens the original employer URL; Niva neither submits nor records a confirmed application. The map uses an explicitly approximate city point, not a guessed employer address.
6. **נתוני הדגמה** switches to the separate sample catalog. Demo approvals remain marked `local-demo`; no real job can receive a demo approval.

## Architecture and boundaries

- `server/pilot.ts`: hosted routes, authoritative Sites identity, account ownership, exact-origin/custom-header CSRF checks, bounded request bodies, database-backed per-owner throttling, and version conflicts.
- `server/state.ts`: common validated mutations shared by Node and Worker. The Worker performs atomic revision-conditional UPSERTs; simultaneous writes return 409 instead of overwriting. Account documents contain profile, preferences/exclusions, saved IDs, demo approvals, pause, theme and one-time import marker.
- `db/schema.ts` and checked-in `drizzle/`: additive schema for `niva_pilot_states`, `niva_pilot_limits`, `niva_pilot_feed`, `niva_pilot_jobs`. State has a unique owner primary key. The platform owns identity; no duplicate password table is created in D1. Existing Node migrations and all device/demo data remain intact. Sites applies generated migrations before deploying the Worker. HTTP handlers never create tables.
- `NIVA_IMPORT_SECRET` is a generated server-only Sites secret used to bind import previews to owner, revision and normalized content. It is not a browser token or authentication credential. Import is explicit, deduplicated, one-time, and retains demo labels/local copies.
- `/api/session` exposes sanitized profile identity, not bearer tokens. Clients never supply an owner ID to select account data. Sites strips caller identity headers before injecting verified `oai-authenticated-user-*` headers. Local adapter tests mock this hosting boundary; the deployed check must verify actual dispatch behavior.
- `server/worker.ts` serves embedded same-origin Angular assets with security/cache headers and account theme metadata before Angular starts. `scripts/build-worker.mjs` keeps Angular/Tailwind intact and produces ESM under `dist/server/`, plus migration metadata. No separate React application was introduced.
- The original Node backend serves the same Angular build with Better Auth/SQLite. Its account identity namespace differs from Sites. This task does not silently migrate local server accounts to hosted identities; only the explicit demo-data import is supported.

## Job source and accuracy

The [Greenhouse Job Board API](https://docs.greenhouse.io/job-board) documents public GET access without authentication. The pilot requests only [AppsFlyer's public feed](https://boards-api.greenhouse.io/v1/boards/appsflyer/jobs?content=true), corroborated against [the employer careers page](https://careers.appsflyer.com/). No scraping, application POST, private Harvest API, API key or paid service is used.

Server-side normalization accepts only numeric provider IDs, the explicitly named Herzliya office, valid update timestamps and HTTPS application URLs on `careers.appsflyer.com`. It renders descriptions as plain text, rejects unsafe URLs and deduplicates IDs. Category is a disclosed title-based classification; other roles remain uncategorized. There are no generated match scores. Work style stays unknown.

The feed is cached for ten minutes in D1. A temporary upstream failure retains the last successful feed with an explicit stale warning, never sample substitutes. Old saved jobs retain their source snapshot and are labeled removed when absent from a successful refresh; they remain visible only in saved results. The current snapshot's source update time and fetch time appear separately. Active status reflects the most recent successful fetch, not a guarantee that an employer will still accept applications.

Herzliya's approximate city center, 32.16627 / 34.82536, comes from [GeoNames](https://www.geonames.org/294778/herzliya.html), CC BY 4.0, checked 24 October 2026. Its district is Tel Aviv. No street address is invented. Leaflet/OSM attribution stays visible; the list works when tiles fail and geolocation is never requested.

## Forms and accessibility

Shared form spacing, tokens, field notes/errors and status component cover profile/preferences and authentication. Registration shows required indicators and field-local errors after interaction or submit. Values survive recoverable failures. Primary actions expose busy/disabled states and prevent duplicates. Profile/preferences protect unsaved edits during route navigation and browser unload. Provider SVG templates are separate HTML files, decorative, and inherit appropriate theme behavior. Existing Hebrew/RTL, native selects and work-style checkbox group are retained.

## Local startup

Requires Node 24.15+. From the repository:

```powershell
npm ci
npm run build
$env:NIVA_MAIL_MODE='local'
$env:BETTER_AUTH_URL='http://127.0.0.1:4300'
npm run preview
```

Local verification/reset messages are private files under ignored `.data/outbox`; they are **not delivered**. Follow their link in the local browser. For real email delivery configure server-only `SMTP_URL` and `MAIL_FROM` using the [account configuration guide](accounts-map.md). Google and Apple require their own approved credentials and callbacks; the hosted pilot does not pretend these methods work. Never paste secrets into chat or source.

## Verification

Run `npm test`, `npm run test:server`, all three `typecheck:*` commands, `npm run format:check`, `npm run build`, and `CROSS_BROWSER=1 npx playwright test --workers=4`. `npm run db:generate` should report no schema changes after the committed migrations. `npm audit` is also checked; the migration tool's old development esbuild dependency is overridden to the current compatible installed build tool, without changing Angular's major version.

Server tests use SQLite to exercise D1 statement/batch semantics and mock the platform identity/provider-fetch boundary. Browser feed fixtures are explicitly named fixtures. These tests are not proof of real OAuth, real SMTP or physical devices. Live feed retrieval and hosted persistence checks are recorded separately after deployment. Screen-reader audits, actual multi-device sessions, backup/restore drills, public-scale tile capacity and broader employer coverage remain outside the verified pilot.

Recorded checks on 24 October 2026: **38 frontend tests, 18 server tests and 148 browser tests passed**, including Chromium desktop/mobile, Firefox and WebKit. All three TypeScript checks, formatting, production build, schema-generation check and `git diff --check` passed. `npm audit` reported zero vulnerabilities. One browser rerun was discarded after an overlapping rebuild stopped its server; the complete fixed-build rerun passed all 148 cases.

A direct, unmocked feed check at 09:40 UTC returned **22 Israeli listings**. The first original employer application URL returned HTTP 200. This verifies actual retrieval and an outbound destination, not application submission or all employer URLs.

| Automated form screenshots (fixture identity/disposable test data) | Desktop                                                       | Mobile                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------ |
| Pilot sign-in                                                      | [Screenshot](screenshots/pilot/pilot-login-desktop.png)       | [Screenshot](screenshots/pilot/pilot-login-mobile.png)       |
| Preferences                                                        | [Screenshot](screenshots/pilot/pilot-preferences-desktop.png) | [Screenshot](screenshots/pilot/pilot-preferences-mobile.png) |

## Deployed verification — 24 October 2026

The pilot is deployed at [the existing Niva URL](https://niva-demo-ziv-20261023.ork77.chatgpt.site/app/jobs?source=real). The Site's owner-only audience is unchanged. Live D1 inspection confirmed all four migration-owned tables under binding `DB`.

After the first hosted check exposed a stylesheet activation script blocked by CSP, production CSS was changed to load directly. `scripts/check-production-html.mjs` now rejects inline script/style-activation dependencies, and a browser regression exercises the actual script CSP. **20 focused pilot browser checks passed** across desktop/mobile Chromium, Firefox and WebKit after that fix. The security policy was retained. GitHub CI passed for the implementation and CSP fix.

The real, authenticated hosted journey was then checked in the in-app browser: ChatGPT sign-in, profile save/reload, category/district preference save/reload, fetching 22 real jobs, saving one real job, retrieving it after reload and after sign-out/sign-in, original employer link/details, and the live approximate-city map in light/dark themes. Temporary profile/preferences/saved-job test changes were restored; no existing data was deleted. The default System theme was restored. No Niva-origin browser error messages or Worker errors were recorded during the final check. This is one actual authenticated browser session; cross-user isolation and independent-device coverage remain automated rather than a second live human identity.

Live screenshots: [saved-job view](screenshots/pilot/live-saved-job.png), [dark map](screenshots/pilot/live-map-dark.png), [light map](screenshots/pilot/live-map-light.png). These use actual hosted data and live OSM tiles, unlike the fixture screenshots above. No application was submitted.
