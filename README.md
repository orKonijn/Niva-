# Niva

Latest published release: **application0.4.6 / Sites54**, 29 October 2026 at [getnivajobs.com](https://getnivajobs.com). Manual-testing lists are recognized as evidence; the personalized tile opens Personal search with its full total; rapid filters persist; source excerpts keep whole words; unavailable page modules offer explicit recovery. [Changelog](CHANGELOG.md), [verification and images](docs/review-repairs-20261029.md), [publication/live receipt](docs/verification/publication-20261029-v54.json).66 frontend and186 server tests passed; all288 Chromium journeys passed either initially (286) or on isolated retry (2), and10 focused Firefox/WebKit checks passed. Matching and navigation verified live. No schema migration or account edits. Reload an old tab or open a fresh one for this release.

Previous release: **application0.4.5 / Sites53**, 28 October 2026 at [getnivajobs.com](https://getnivajobs.com). The protected account page shows saved identity/profile details, search preferences, saved-job count and expandable matching details. Data readiness and account changes are handled without rendering writes. [Changelog](CHANGELOG.md), [publication/live receipt](docs/verification/publication-20261028-v53.json), [account comparison and checks](docs/screenshots/changes/account-overview.md). Build,59 frontend tests and54 browser checks passed, including real local registration, account data/export/deletion journeys and résumé integration. Live summary structure/source mapping verified. No migration required.

Previous release: **application0.4.3 / Sites51**, 28 October 2026 at [getnivajobs.com](https://getnivajobs.com). The homepage offers visitor login/signup or signed-in workspace/jobs/account actions, including mobile navigation and the final CTA. [Changelog](CHANGELOG.md), [publication/live receipt](docs/verification/publication-20261028-v51.json), [visitor/member comparisons and checks](docs/screenshots/changes/home-session.md). Build,59 frontend tests and50 browser checks passed, including slow session loading, cross-tab changes and setup routing. Live signed-in behavior/source mapping verified. No migration required.

Previous job-finding release: **application0.3.2 / Sites44**, 27 October 2026 at [getnivajobs.com](https://getnivajobs.com). [Changelog](CHANGELOG.md), [publication receipt](docs/verification/publication-20261027-v44.json) and [live reassessment](docs/live-reassessment-20261027-v44.md). GitHub CI passed for reviewed source `f1fd729`; live build metadata matches the reviewed mapping. Search, regional filtering, source alternatives/structure, pagination, save/reload/unsave and an employer application handoff were verified without submitting. The observed job-finding score is **7.3/10**, with remaining presentation, source-eligibility/freshness and hosted operational limits documented. Prior0.3.1 / Sites43 remains historical.

The [focused repair report](docs/repair-cycle-20261026.md) and PDF/DOCX outputs retain their earlier local-review timestamp and scope. Their earlier Unreleased wording is historical; publication is established by the separate receipts. The two synthetic local accounts and secure access are described in [disposable staging](docs/disposable-staging.md). Hosted identity/D1, private cleanup/restore and approved alert delivery remain unverified. Operator unassigned; alerts disabled.

The [complete audit tracker](docs/job-finding-audit-20261026.md) retains every finding and its limits. The PDF/DOCX reports preserve the earlier local-review scope; publication is established by the separate receipts. Discovery combines24 selected Greenhouse/Lever/Jobicy sources with configuration-gated LinkedIn/Indeed feeds through JSearch. Coverage remains partial, with shared daily publisher samples. Cleanup/alert, identity/restore and human device verification gaps remain documented in [current status](docs/current-status.md).

A Hebrew-first job search application built with **Angular 22, TypeScript 6 and Tailwind CSS 4**. The hosted Worker uses verified Sites/ChatGPT identity and D1 for durable account data, with real employer listings, original application links and an approximate city map. The main flow opens source jobs and account features; the legacy demo catalog is retained separately. Hosted sign-in supports Google and ChatGPT as separate accounts; use the original method to access existing records. Apple remains disabled at the user’s request, and hosted email delivery is inactive.

The [current capability and operational matrix](docs/current-status.md) is authoritative. Historical milestone guides do not establish current deployment status. See the [pilot walkthrough, architecture, source accuracy and verification](docs/pilot.md). The earlier [account guide](docs/accounts-map.md) documents local SMTP/OAuth configuration and the original implementation milestone.

![Niva desktop homepage](docs/screenshots/home-preview.png)

The [assistant repair and live checks](docs/assistant-repair-20261028.md) document the built-in guide, redesigned chat UI and the remaining free-form AI configuration requirement. [Assistant deployment receipt](docs/verification/publication-20261028-v48.json).

## Run locally

Use Node.js 24.15+ (24.x) and npm.

```sh
npm ci
npm run build
npm run preview
```

Open [127.0.0.1:4300](http://127.0.0.1:4300). The preview applies versioned migrations and serves Angular and the account API from one origin. To test email locally without sending real messages, set `NIVA_MAIL_MODE=local` before the preview command; see the [account guide](docs/accounts-map.md) for the local outbox and Angular development proxy setup.

```sh
npm run db:migrate
npm run api
```

The API command serves an existing build and database. Unconfigured Google, Apple and email methods remain visibly unavailable; there is no fake sign-in.

## Included

- Responsive Hebrew RTL pages, Light/Dark/System themes and account-owned preferences/saved jobs.
- Global discovery from selected official employer boards, Jobicy and configuration-gated LinkedIn/Indeed samples through JSearch; original application links, source health, cursor pagination and approximate multi-office maps.
- CV-first account setup followed by preferences. PDF/DOCX text extraction runs locally in the browser, with review before saving confirmed text/versions to the account.
- Extractive tailoring and terminology matching; server-side AI requires separate configuration and consent. No automatic employer applications.
- Separate Google and ChatGPT identities; Apple and hosted email delivery remain inactive. Legacy demonstration approvals/catalogue remain explicitly separate.
- Unit, disposable SQLite/D1-contract and desktop/mobile browser tests, automated axe checks and build provenance.

**Data boundaries:** the normal PDF/DOCX path keeps original files on the device and sends only reviewed text when saved. Private resume versions and conversations expire after 30 days; reads deny expiry immediately. Physical deletion targets 60 minutes after expiry but recurring private cleanup, accountable operation, alert delivery and backup restoration remain unverified. Server upload scanning/parsing, real AI and email require separate configuration; local parsing works without those services. No private account/CV data is sent to job providers. Request-driven source refresh uses cache/leases/backoff: core employer feeds are checked when due (15 minutes), Jobicy at most hourly with its publication delay, and JSearch daily across three sampled cities with a 180-request/31-day Niva cap. A visit does not guarantee new vacancies or complete market coverage.

## Checks

```sh
npm test
npm run test:server
npm run test:worker
npm run typecheck:tests
npm run typecheck:server
npm run typecheck:e2e
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

Browser tests run the production build at port 4300. Build first. They cover onboarding, filtering, saving, approval acknowledgement, deduplication, pause, file validation, reset, mobile overflow and automated accessibility. Automated checks do not replace manual screen-reader and production security testing.

## Project structure

```text
src/app/core/      Typed state, models, sample data, migrations and theme service
server/           Better Auth, session-owned account API and versioned SQLite migrations
src/app/shared/    Brand, icons, job cards, page headings and shared preference controls
src/app/pages/     Landing, setup, candidate workspace and information pages
public/assets/    Optimized original hero artwork
tests/            Desktop and mobile Playwright journeys
src/styles/       Shared theme tokens, base rules and contextual styles
scripts/          Production preview, build provenance and screenshot capture
docs/             Specification, design assets and implementation roadmap
```

## Documentation

- [Illustrated website specification](docs/website-specification.pdf)
- [Editable specification](docs/website-specification.md)
- [Implementation status and next milestones](docs/implementation.md)
- [Accounts, maps, database migrations and provider setup](docs/accounts-map.md)
- [Design tokens](docs/design/design-tokens.json)
- [Tailwind architecture and verification](docs/tailwind-refactor.md)

The production build is in `dist`. Public hosting uses a Worker/D1 adapter; Node/SQLite is the local alternative. Build metadata records checkout/reviewed-source identifiers, dirty state, build time and content digests. Historical release receipts remain preserved; see [current operational truth and release gates](docs/current-status.md).

## Dependency note

The Vite override selects a patched 8.3.x release for the Angular development toolchain. The lockfile makes installs reproducible. Recheck the override when upgrading Angular. Third-party dependencies retain their own licenses; no open-source license for this repository is asserted.

## Reliability and accessibility repairs

See [implementation evidence](docs/repair-verification.md) for F01–F13 status, cross-tab consistency guarantees, reset failure semantics, screenshots and browser coverage. Persisted edits require Web Locks and available localStorage; unsupported environments fail closed for edits and approvals. To run Firefox and WebKit alongside Chromium, set CROSS_BROWSER=1 before the browser command.

## Historical milestones and career workflows

The original fictional catalogue, local approvals and device migrations are historical demonstration features. They do not establish current source coverage or employer application status. See [preferences and themes](docs/preferences-and-themes.md).

Current career workflows include candidate-confirmed text versions, local PDF/DOCX extraction, extractive tailoring, terminology matching and configuration-gated AI. See [career workflows](docs/career-assistant.md), [publisher limits](docs/job-discovery/jsearch.md), [global coverage](docs/job-discovery/global-coverage.md) and [staging verification](docs/staging-verification.md). The enabled hourly public-source schedule does not prove recurring private retention cleanup.
