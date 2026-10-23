# Niva

A Hebrew-first job search assistant built with **Angular 22, TypeScript 6 and SCSS**. The initial release is a working frontend demo based on the illustrated Niva website specification.

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
src/app/core/      Typed demo state, privacy preference and file selection rules
src/app/shared/    Brand, SVG icons, job cards and preference fields
src/app/pages/     Landing, setup, candidate workspace and information pages
public/assets/    Optimized original hero artwork
tests/            Desktop and mobile Playwright journeys
scripts/          Loopback-only production preview server
docs/             Specification, design assets and implementation roadmap
```

## Documentation

- [Illustrated website specification](docs/website-specification.pdf)
- [Editable specification](docs/website-specification.md)
- [Implementation status and next milestones](docs/implementation.md)
- [Design tokens](docs/design/design-tokens.json)

The production build is in `dist/niva/browser`. Hosting must rewrite application routes to `index.html`; see the implementation guide. This repository upload does not enable a public deployment. The next milestone is server authentication, private CV processing and the first approved job-destination integration.

## Dependency note

The Vite override selects a patched 8.3.x release for the Angular development toolchain. The lockfile makes installs reproducible. Recheck the override when upgrading Angular. Third-party dependencies retain their own licenses; no open-source license for this repository is asserted.
