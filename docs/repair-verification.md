# Niva repair implementation — 23 October 2026

Historical repair report; see [the current district and theme update](preferences-and-themes.md) for subsequent behavior and verification.

Baseline: `e1ff28ff25710e13d0c782d4beed0c274ccb9793`. The checkout was clean before work. No applicable AGENTS.md was found. Existing dependencies and lockfile were retained; `npm ci` was unnecessary because dependencies were already installed. No push was made to the original GitHub repository. The user's current request authorizes publishing a private interactive demo through Sites.

## Finding status

| Finding | Status              | Implementation and evidence                                                                                                                                                                                                                                                                                                  |
| ------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01     | Fixed               | `app.ts` prevents default skip navigation and focuses the current main. All routed main elements are programmatically focusable. Keyboard regression checks public, onboarding and nested workspace paths without changing pathname.                                                                                         |
| F02     | Fixed               | `demo-store.ts` serializes mutations with Web Locks, reads validated authoritative state inside the lock, and uses a reset generation. Unit and two-page browser tests cover pause, independent saves, same-job toggles, duplicate approvals and reset.                                                                      |
| F03     | Fixed               | Reset removes the payload with `removeItem`. The profile distinguishes confirmed deletion from session-only clearing after actual injected deletion failure. Cookies remain separate. Reload and cross-tab reset are tested.                                                                                                 |
| F04     | Fixed               | Native modal dialog supplies background inertness; explicit keyboard cycling, Escape/backdrop dismissal, trigger focus restoration and resize closure complement it. Scoped drawer styles scroll at 390×568. Chromium, Firefox and WebKit keyboard regressions cover this state.                                             |
| F05     | Fixed               | Onboarding starts from committed in-memory name/CV selection and preferences. File changes stay in its draft until completion. Explicit removal exists in setup and profile; summary and review use the committed selection. Browser regression revisits setup through Angular navigation and checks removal through review. |
| F06     | Fixed               | Saved jobs use a separate collection independent of matching. Exclusions still suppress employers. Out-of-preference cards explain approval restrictions; generic suppressed counts reveal no employer identity. Dashboard and saved-tab counts use the visible collection.                                                  |
| F07     | Fixed               | Reactive query parameters own saved/all, text and work-model filters. Text changes replace the current history entry; view/model changes create entries. Clear removes screen parameters. Reload, Back and Forward have regression coverage.                                                                                 |
| F08     | Fixed               | Each forward/backward step focuses its heading, described by the step count. Stepper marks the current step. Path changes focus the route heading without scrolling; query-only changes preserve focus. Explicit skip and open dialogs take precedence. Workspace links have aria-current.                                   |
| F09     | Fixed               | Child preference controls explicitly use standalone ngModel. The parent consumes a typed input/output draft and explicitly indicates save state. The store validates controlled values. Development-console verification visits the form and setup steps without NG01354 warnings.                                           |
| F10     | Fixed               | Added behavioral unit/browser regressions, actual storage-failure injection, export verification, console assertions, additional axe states, all requested viewport widths, Firefox/WebKit opt-in projects, screenshots and retained failure traces.                                                                         |
| F11     | Fixed               | TypeScript strict and Angular strictTemplates are enabled in the shared configuration. Controlled preference values use literal unions. Build and test type checking pass.                                                                                                                                                   |
| F12     | Fixed incrementally | Essential disclosures, metadata and mobile stat captions use 13px; mobile stats reflow. Drawer rules are scoped to workspace. Token references now agree with runtime foundation colors/fonts and distinguish design guidance from enforced values. Existing global stylesheet remains for incremental future extraction.    |
| F13     | Fixed               | Sample-job/no-CV-processing/no-submission disclosure is immediately below the hero actions, with a direct sample-jobs link. Existing detailed privacy explanations remain.                                                                                                                                                   |

## Local consistency contract

All participating tabs on the same origin use the exclusive `niva.demo.mutation` Web Lock. Within the lock, each command rereads `niva.demo.v1`, validates it, performs one mutation, and synchronously writes the resulting payload before reporting success. A storage-event listener and window-focus refresh keep the UI current; they are not the atomicity mechanism.

- Independent saved-job changes merge against the latest payload. Same-ID toggles apply in lock acquisition order (two toggles cancel). Duplicate concurrent approvals produce one record. Approvals recheck authoritative pause, current preferences, exclusions and prior approval while holding the lock.
- A pause command captures the intended target state shown by its control, so two stale pause commands cannot accidentally resume activity. An explicit resume is a separate subsequent user action.
- Preference saves intentionally replace the preference object in serialization order: the last completed explicit save wins for that domain. They cannot overwrite saved jobs, approvals or pause. This is a local demo conflict policy, not field-level collaborative editing.
- Reset writes a fresh opaque `niva.demo.generation` barrier before removing `niva.demo.v1`. Old pending commands and old onboarding/preference drafts are rejected across that barrier. Pending edits that precede reset are removed from both memory and storage. Storage synchronization clears in-memory names/filenames on generation change.
- The barrier contains no candidate data and remains after deletion, as does the separate `niva.cookie-choice`. Successful reset means removal of the demo payload, not removal of every browser key.
- If deletion or coordination fails, only this session is cleared. The UI explicitly says persisted data may return on reload and directs the user to browser site-data controls. This is tested with `Storage.prototype.removeItem` throwing, followed by reload. A failed deletion must never be reported as durable success.
- Without Web Locks, with denied lock access, or with unreadable/unwritable storage, persisted mutations and approvals fail closed with an explanation. Browsing and in-memory profile interactions remain possible. There is no unsafe localStorage spinlock or silent full-state fallback.
- Existing v1 data is accepted after validation; unsupported values, unknown jobs, duplicate saved IDs and duplicate approvals are filtered. Names and filenames are never added to the payload or export. File contents are never read, uploaded, parsed or persisted.

Guarantees apply to tabs running this implementation and cooperating through the lock on the same browser origin. Old deployed code, arbitrary scripts, devtools, external clearing of all site data, different browser profiles and different devices are outside this coordination contract. A client-side lock is not production authorization or tamper resistance. A crash during reset can leave either a removed payload or a new barrier with old payload; success is shown only after deletion actually returns.

## Verification

Reproduce checks with:

```sh
npm test
npm run typecheck:tests
npm run format:check
npm run build
npm run test:e2e -- --workers=2
```

For the complete browser matrix, set `CROSS_BROWSER=1` in the environment, then run the same browser command. Install matching binaries with `npx playwright install chromium firefox webkit`. Default projects are Chromium desktop and Chromium mobile; the mobile project is emulation, not iOS Safari. The WebKit project is a separate engine check.

The development-console companion is `node scripts/verify-development.mjs`, with `npm start -- --host 127.0.0.1 --port 4301` already running. It inspects public/workspace forms and all setup steps. Production-console assertions run in each browser project.

Results for this implementation: 21 unit tests; 60 browser cases across four projects. Strict build, test type checking and formatting pass. Browser coverage includes widths 320, 390, 768, 1024 and 1440; short drawer height 568; keyboard skip and steps; two tabs sharing a browser context; saved-job matching/exclusions; screen filters/history; CV metadata/removal; pause; export; successful reset and actual deletion failure/reload. Axe covers public pages, setup, workspace/review, preferences, profile, history and the open drawer. Application browser-console error/warning assertions are clean in production; development form warnings are clean. Test runner NO_COLOR/FORCE_COLOR messages are terminal tooling warnings, not browser warnings.

Initial production bundle: **327.31 kB raw**, versus **322.01 kB** in the assessment (+5.30 kB, approximately 1.65%). Estimated initial transfer is approximately 82.8 kB. Focus/routing support and readable style additions account for the small initial increase; state and workspace changes remain in lazy chunks. No new application dependency was introduced.

Screenshots are in `docs/screenshots/repair-*.png`. Browser failures automatically retain screenshot and trace artifacts under ignored `test-results/`; no failing case is intentionally accepted.

Limitations: automated axe is not a complete accessibility compliance assessment. Manual Hebrew screen-reader testing, physical devices, browser/system enlarged-text settings, network throttling and production Web Vitals are not certified by these tests. No backend or real employer integration exists to test. No claim is made about current npm audit results; dependencies were not upgraded.

## Next production milestone

Build one authenticated, tenant-isolated workflow with a supported job source/destination, private versioned profile/CV handling, immutable explicit approvals, transactional idempotency, server-side pause checks, and verified submission evidence. Keep AI, live matching and employer submissions unadvertised until their real services and safeguards exist.
