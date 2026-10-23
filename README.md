# Niva

A Hebrew-first job search assistant built with **Angular 22, TypeScript 6 and Tailwind CSS 4**. The initial release is a working frontend demo based on the illustrated Niva website specification.

![Niva desktop homepage](docs/screenshots/home-preview.png)

## Run locally

Use Node.js 24.15+ (24.x) and npm.

```sh
npm ci
npm start
```

Open [localhost:4200](http://localhost:4200). For an optimized production preview:

```sh
npm run build
npm run preview
```

The preview runs at [localhost:4300](http://localhost:4300).

## Included

- Responsive Hebrew RTL landing page, original mascot, FAQ and local cookie preference controls.
- Three-step setup with optional local CV selection, preference selection and demo acknowledgement.
- Candidate dashboard, sample jobs, search, work-model filters and saved jobs.
- Job details and explicit demo approval, with duplicate, exclusion and pause checks.
- Local approval history, editable preferences, temporary profile details, JSON export and reset.
- Lazy-loaded standalone components, Angular signals, strict templates and self-hosted fonts.
- Unit and browser journey tests, automated axe accessibility checks, desktop/mobile screenshots and GitHub Actions validation.

**Demo boundary:** no authentication, CV upload/parsing, AI service, live job feed, employer communication or payment processing is connected. Approving a sample job only records a local demonstration entry. The UI labels this throughout. CV content is never read or uploaded. Personal names and filenames are not persisted across a refresh.

## Checks

```sh
npm test
npm run typecheck:tests
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

Browser tests run the production build at port 4300. Build first. They cover onboarding, filtering, saving, approval acknowledgement, deduplication, pause, file validation, reset, mobile overflow and automated accessibility. Automated checks do not replace manual screen-reader and production security testing.

## Project structure

```text
src/app/core/      Typed state, models, sample data, migrations and theme service
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
- [Design tokens](docs/design/design-tokens.json)
- [Tailwind architecture and verification](docs/tailwind-refactor.md)

The production build is in `dist`. Hosting must rewrite application routes to `index.html`; see the implementation guide. The interactive demo is configured for private Sites hosting; the original GitHub repository is not a deployment target. The next milestone is server authentication, private CV processing and the first approved job-destination integration.

## Dependency note

The Vite override selects a patched 8.3.x release for the Angular development toolchain. The lockfile makes installs reproducible. Recheck the override when upgrading Angular. Third-party dependencies retain their own licenses; no open-source license for this repository is asserted.

## Reliability and accessibility repairs

See [implementation evidence](docs/repair-verification.md) for F01–F13 status, cross-tab consistency guarantees, reset failure semantics, screenshots and browser coverage. Persisted edits require Web Locks and available localStorage; unsupported environments fail closed for edits and approvals. To run Firefox and WebKit alongside Chromium, set CROSS_BROWSER=1 before the browser command.

## District preferences and appearance

Niva now includes 11 fictional jobs across nine professional fields and all six Israeli districts, shared multi-style checkboxes, and a persistent Light/Dark/System theme control. Older city and single-style preferences migrate without clearing demo records. See [behavior, migration and verification](docs/preferences-and-themes.md).
