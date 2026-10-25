# Niva

See the [version-by-version changelog](CHANGELOG.md). The latest published Sites release is **version 22** at [getnivajobs.com](https://getnivajobs.com), with 17 employer sources (188 live Israeli jobs at verification), Google sign-in, managed HTTPS and deployment hardening. See the [source expansion and sign-in report](docs/source-expansion-20261025.md). See the [launch status and maintenance runbook](docs/public-launch.md) for live evidence and unavailable integrations. Git-only documentation updates do not create a new hosted version.

A Hebrew-first job search application built with **Angular 22, TypeScript 6 and Tailwind CSS 4**. The hosted Worker uses verified Sites/ChatGPT identity and D1 for durable account data, with real employer listings, original application links and an approximate city map. The main flow opens source jobs and account features; the legacy demo catalog is retained separately. Hosted sign-in supports Google and ChatGPT as separate accounts; use the original method to access existing records. Apple remains disabled at the user’s request, and hosted email delivery is inactive.

The [current capability and operational matrix](docs/current-status.md) is authoritative. Historical milestone guides do not establish current deployment status. See the [pilot walkthrough, architecture, source accuracy and verification](docs/pilot.md). The earlier [account guide](docs/accounts-map.md) documents local SMTP/OAuth configuration and the original implementation milestone.

![Niva desktop homepage](docs/screenshots/home-preview.png)

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

- Responsive Hebrew RTL landing page, original mascot, FAQ and local cookie preference controls.
- Three-step setup with optional local CV selection, preference selection and demo acknowledgement.
- Candidate dashboard, sample jobs, search, work-model filters and saved jobs.
- Job details and explicit demo approval, with duplicate, exclusion and pause checks.
- Local approval history, editable preferences, temporary profile details, JSON export and reset.
- Separate verified accounts with cookie sessions, durable account-owned preferences/profile/theme, explicit demo-data import and account-data deletion.
- Lazy Leaflet map with approximate demonstration cities, grouped markers, multiple offices, remote/missing-location sections and a usable list fallback.
- Lazy-loaded standalone components, Angular signals, strict templates and self-hosted fonts.
- Unit and browser journey tests, automated axe accessibility checks, desktop/mobile screenshots and GitHub Actions validation.

**Data boundaries:** fictional sample jobs, approvals and device CV selection are explicitly demonstrations. Real discovery reads 17 allowlisted public employer boards; it is limited coverage, with changing vacancy counts. Signed-in resume text/versions are private server records; PDF/DOCX processing and AI sending require separately configured services and consent and remain disabled without them. No employer submissions or payments are implemented. Device reset and account-data deletion are separate; deleting account data retains the sign-in identity.

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

The production build is in `dist`. The existing private Sites deployment uses a Worker/D1 adapter; Node/SQLite is the local alternative. The reviewed repairs were subsequently published as **Sites version 17**; [the changelog](CHANGELOG.md) records the source mapping and remaining operational limits. Build metadata records checkout and reviewed-source identifiers, dirty state, build time and content digests. See [current operational truth and release gates](docs/current-status.md).

## Dependency note

The Vite override selects a patched 8.3.x release for the Angular development toolchain. The lockfile makes installs reproducible. Recheck the override when upgrading Angular. Third-party dependencies retain their own licenses; no open-source license for this repository is asserted.

## Reliability and accessibility repairs

See [implementation evidence](docs/repair-verification.md) for F01–F13 status, cross-tab consistency guarantees, reset failure semantics, screenshots and browser coverage. Persisted edits require Web Locks and available localStorage; unsupported environments fail closed for edits and approvals. To run Firefox and WebKit alongside Chromium, set CROSS_BROWSER=1 before the browser command.

## District preferences and appearance

Niva now includes 11 fictional jobs across nine professional fields and all six Israeli districts, shared multi-style checkboxes, and a persistent Light/Dark/System theme control. Older city and single-style preferences migrate without clearing demo records. See [behavior, migration and verification](docs/preferences-and-themes.md).

## Career extension

The implementation includes two-source durable discovery with cursor pagination, explicit refresh and source health; versioned, candidate-confirmed resume text and extractive tailoring; explainable terminology matching; and an optional server-side streaming career assistant. PDF/DOCX uploads fail closed until a real scanning/parsing service is configured. AI sending remains unavailable without a server API key and explicit model. No new paid services or hosted schedule have been activated.

See [career-assistant.md](docs/career-assistant.md) for trying each workflow, configuration placeholders, source coverage/cadence, retention/deletion, scoring methodology, provider limitations and screenshots. The earlier career milestone was published before this repair pass. The latest review repair pass was subsequently published as version 17. Runtime AI/scanning credentials and hosted scheduling remain separate setup requirements.
