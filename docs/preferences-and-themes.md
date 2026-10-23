# Districts, work styles, professional fields and appearance

Implemented 23 October 2026, on top of the repaired Niva local demo.

## Search preferences

All UI remains Hebrew and RTL. `src/app/core/preferences.ts` defines literal category, district and work-style identifiers separately from display labels. The shared preference form is used by onboarding and the preferences page; the same checkbox component is reused for temporary job-list filters.

- Districts: Northern (`north`), Haifa (`haifa`), Central (`central`), Tel Aviv (`tel-aviv`), Jerusalem (`jerusalem`) and Southern (`south`). `all` means all districts. City choices and remote-as-location have been removed.
- Work styles: on-site (`onsite`), hybrid (`hybrid`) and remote (`remote`). Any subset may be selected. No selections means all styles; selecting all three produces the same matching behavior. The fieldset explicitly describes this in Hebrew and supports native checkbox keyboard operation.
- Professional fields: Software Development (`engineering`), Design/UX (`design`), Product Management (`product`), Manual QA (`qa-manual`), QA Automation (`qa-automation`), Workflow Automation and Integrations (`workflow-automation`), DevOps/Cloud (`devops-cloud`), Data and Analytics (`data-analytics`), IT/Technical Support (`it-support`). QA Automation covers software testing; workflow automation covers business processes and integrations.
- Eleven sample jobs cover every district and category. The original five job IDs remain stable so saved jobs and approval history continue to resolve. District describes the sample employer/team's base; a remote role has a district and must satisfy a selected district too. Remote is never a geographic district or an automatic bypass of district filtering.

Matching is **category AND district AND (any selected work style) AND employer exclusions**. Empty style selection imposes no style constraint. Permanent preferences establish the normal eligible collection. Screen filters narrow it further, while the saved collection retains the earlier behavior of showing out-of-preference jobs with a label and enforcing exclusions and approval eligibility. Counts derive from the actual collections, not a fixed fixture count.

The input/output form owns an immediate linked draft so rapid changes across controls cannot overwrite one another before Angular re-renders. Onboarding commits its draft only on completion. Its summary displays the selected professional field, district and work styles.

## Migration and export

The existing `niva.demo.v1` browser key is retained, with a canonical `version: 2` payload. Restoration migrates in memory without an uncoordinated write; the next successful mutation writes the canonical shape under the existing Web Lock. Existing saved IDs, approval timestamps, pause, exclusions, cookie preference and reset-generation behavior remain intact. Invalid values are validated and normalized; candidate names and CV filenames remain in memory only.

| Old preference                      | New preference                              |
| ----------------------------------- | ------------------------------------------- |
| `location: 'תל אביב'` or `'הרצליה'` | `district: 'tel-aviv'`                      |
| `location: 'חיפה'`                  | `district: 'haifa'`                         |
| `location: 'all'` or unsupported    | `district: 'all'`                           |
| `location: 'מרחוק'`                 | `district: 'all'`, `workStyles: ['remote']` |
| `model: 'במשרד'`                    | `workStyles: ['onsite']`                    |
| `model: 'היברידי'`                  | `workStyles: ['hybrid']`                    |
| `model: 'מרחוק'`                    | `workStyles: ['remote']`                    |
| `model: 'all'`                      | `workStyles: []`                            |

A legacy remote location takes precedence over a conflicting legacy style, since remote was previously expressed as a geographic restriction. Existing valid role IDs are retained. The v2 style list is deduplicated and validated; unknown identifiers do not become arbitrary category, district or style values. Newly introduced categories have their own stable identifiers.

Exports now use version 2 and include canonical preferences plus `appearance.theme` (`light`, `dark` or `system`), saved IDs, demo approvals and pause state. They exclude names, filenames and CV content. Export is a download, not a server transfer or a new import feature.

Temporary filters use `q`, `saved`, `district`, `category` and comma-separated `styles` query parameters. A previous Hebrew `model` URL is read and replaced with canonical `styles` using history replacement. Text search replaces the current entry; deliberate filter changes create entries. Back/Forward and reload restore controls and results. Clear removes the relevant screen parameters and retains permanent preferences.

## Appearance

An icon-only button beside the Niva logo cycles System → Light → Dark → System. Its monitor, sun and moon icon identifies the selected mode; a Hebrew accessible name and tooltip describe the current mode and next action. The workspace mobile header also shows the logo and control. There is no separate appearance bar or dropdown. System is the default, follows OS changes live, and explicit selections are saved under the separate `niva.theme` key. Storage events synchronize theme selection across tabs. Demo reset preserves appearance and cookie choices. If persistence fails, the selected appearance still applies for the visit and a status message explains the limitation.

The small same-origin blocking `public/theme-init.js` runs in the document head before CSS/Angular. It resolves the saved/system preference and sets theme attributes, native `color-scheme` and a matching initial canvas color before the application starts. Angular takes over with the same rules. Theme foundations in `src/styles.scss` pair text and surfaces across marketing, setup, workspace, forms, cards, menus, dialogs, disclosures and status notices. Action-button colors remain distinct from link/focus colors so both themes retain contrast. Native form controls and visible focus indicators follow the active theme. `docs/design/design-tokens.json` records the foundation palettes.

## Verification and limits

- 34 passing unit tests, including district/city migration, single-style migration, invalid/duplicate values, all category/district fixtures, OR/AND matching, distinction between QA and workflow automation, preservation of existing data, and theme persistence/system changes/storage failure.
- 88 passing browser cases across desktop Chromium, mobile Chromium emulation, Firefox and WebKit, including the existing journeys and focused preference/theme regressions. Both themes are checked at 320, 390 and 1440px; existing responsive checks additionally cover 768 and 1024px. Open modal navigation is checked at 390×568.
- Axe contrast/accessibility checks cover both themes on marketing, setup, preferences, jobs and the open drawer, alongside the existing route audits. Keyboard tests cover multi-selection, setup steps, skip navigation, drawer focus and Escape restoration.
- A browser regression blocks the Angular bundle and verifies saved dark initialization still occurs, rather than relying solely on a post-load screenshot. System changes, explicit override/reload, cross-tab theme changes and preservation through demo reset are covered.
- Type checking, formatting, production build and development-console verification pass. Application console errors/warnings remain clean in the production-route assertions. Runner color-environment warnings are terminal tooling messages.

Run the default browser suite with `npm run test:e2e -- --workers=2`. Set `CROSS_BROWSER=1` to include Firefox/WebKit. Run `npm test`, `npm run typecheck:tests`, `npm run format:check` and `npm run build` as before. The existing dependencies were reused without upgrades. Theme bootstrap formatting is also checked with Prettier directly.

Screenshots: `docs/screenshots/preferences-light.png`, `preferences-dark.png`, `preferences-dark-mobile.png` and `drawer-dark.png`.

This remains a browser-local demo with fictional jobs: no authentication backend, live feed, CV processing, AI matching or employer submissions were added. Hosted access retains the private Site's existing audience. Older open tabs should be refreshed after updating to load the new schema/UI; cross-tab guarantees apply to cooperating tabs running this version. Automated accessibility checks and browser emulation do not replace manual Hebrew screen-reader or physical-device testing. The first-paint test verifies the early initialization mechanism, not every possible slow-network/rendering condition.
