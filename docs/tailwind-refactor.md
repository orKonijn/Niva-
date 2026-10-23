# Tailwind refactor — 23 October 2026

## Organization

All components now reference adjacent HTML templates. Behavior, signals and persistence stay in TypeScript. `core/models` owns job and local-approval interfaces; `core/data/sample-jobs.ts` owns the eleven fictional fixtures. The store keeps compatibility exports and its existing migration, locking and reset behavior.

Shared page headings, preference fields, work-style checkboxes, job cards, icons and brand/theme controls avoid duplicated UI. Card-specific rules live beside the card; native navigation-dialog rules live beside the workspace.

## Styling contract

Tailwind CSS 4.3 integrates through Angular's PostCSS pipeline (`.postcssrc.json`). `src/styles.css` is the single global entry point. Its `@theme inline` maps Tailwind semantic color utilities to the CSS variables in `src/styles/tokens.css`; changing theme updates the same utilities throughout the application. The default spacing scale is Tailwind's 4px scale, with named card/control radii and a restrained shadow. Existing exact illustration dimensions remain arbitrary utilities where helpful.

Templates own layout, spacing, responsive behavior and interaction utilities. Custom CSS uses base/components layers for form foundations, contextual states and the marketing illustration. Utilities have final precedence; conditional states must not compete with an unconditional utility for the same property. Superseded SCSS, inline templates, the empty app stylesheet and the unused mobile-open sidebar rules were removed. There are no `!important` declarations.

Logical margins, padding and borders preserve Hebrew RTL. Mixed-language job titles and company names retain `bdi`. The visible theme control is one changing icon next to the logo, cycling System → Light → Dark, with an accessible current/next-state label. Early `theme-init.js` applies the saved theme before Angular loads.

The refinement increases form text to 14px, raises workspace metadata to 12px, adds shared 30/34px page headings, improves field borders, and keeps 44px save controls. It retains demo disclosures, self-hosted fonts, existing artwork and truthful content.

## Verification

- 34 unit tests pass: migration, filtering, persistence, pause, approvals, exclusions, reset and theme behavior.
- Strict TypeScript test checking, Angular strict-template production compilation, Prettier and `git diff --check` pass.
- All 96 Chromium desktop/mobile, Firefox and WebKit cases pass on the final production build. Eight added cases exercise direct navigation/refresh for every route, static asset responses, outline-action readability and mobile-only menu controls. An initial high-concurrency Firefox timeout disappeared with four workers; the new test's duplicate link locator was scoped to main before the successful full run.
- Automated axe checks cover both themes, landing/setup/preferences/jobs, review and modal navigation. Responsive checks span 320, 390, 768, 1024 and 1440px. Keyboard checks cover skip navigation, focus placement, modal trapping, Escape and resize.
- The development browser check passes with no console warnings/errors. Production route console checks also pass. Command-line color-environment warnings are test-runner output, not browser warnings.
- Manual browser inspection confirms the logo icon cycles themes, readable outline actions and desktop navigation. Captured desktop light/dark and mobile dark screenshots were visually reviewed; automation covers the broader route/viewport matrix.
- Production initial bundle: about 340.2 kB raw / 85.4 kB estimated transfer, versus about 334 kB before this refactor. Lazy routes remain split. No unexpected dependency upgrades were made; the lockfile adds Tailwind/PostCSS and their dependencies.

Before/after evidence: `docs/screenshots/refactor-{before,after}-{home,dashboard,jobs,preferences-mobile}.png`. Capture again with `NIVA_CAPTURE_BASE_URL` pointing at a production preview and `node scripts/capture-ui.mjs`.

## Publication and limits

The GitHub feature branch contains the latest previously hosted repairs/preferences as well as this refactor; GitHub main was still the initial release. The existing private Sites project remains the production target. Builds emit `dist/build-info.json` with the GitHub source SHA so the separately managed Sites source history can be checked against the intended repository build.

The app remains entirely a local demonstration. No authentication, CV processing, backend, AI, real job feeds or employer submissions were introduced. Automated accessibility checks do not establish full WCAG conformance; manual screen-reader, real-device and high-contrast-mode audits remain follow-up work. Existing hosting access stays owner-private.
