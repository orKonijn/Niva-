# Changelog

## Unreleased — Modern UI polish and restrained motion

- Refine the landing-page navigation, hero framing, section labels, step cards, FAQ controls and closing invitation. Carry the same surface depth, selected navigation, button feedback and focus treatment into the app. Reuse transparent mascot artwork in the hero and dashboard for consistent light/dark presentation.
- Add short one-time section entrances, a slight step stagger and fine-pointer card lifts. Keep text opaque and content visible from the start. Honor reduced motion, avoid new animation loops, and disconnect observers after use and on navigation away.
- Verification: 59 frontend tests, both test type checks, 16 relevant desktop/mobile browser checks, WCAG axe scans, theme/image regressions, navigation, overflow and reduced motion. Production build validates the final source. [Design and complete paired evidence](docs/ui-polish.md).
- Home desktop dark [before](docs/screenshots/changes/ui-polish-home-desktop-dark/before.png) · [after](docs/screenshots/changes/ui-polish-home-desktop-dark/after.png); mobile light [before](docs/screenshots/changes/ui-polish-home-mobile-light/before.png) · [after](docs/screenshots/changes/ui-polish-home-mobile-light/after.png). The evidence index includes all four routes in both themes and viewports.

## Unreleased — Theme-aware mascot artwork

- Replace the baked pale-blue backgrounds in the three step illustrations and closing wave with transparent cutouts. Use the theme canvas color and a subtle shared blue glow for a continuous frame in light and dark modes. Remove the mismatched vertical side bands while preserving the full character and props.
- Preserve the original artwork files. New optimized assets and the background-removal prompt are documented in [artwork notes](docs/mascot-artwork.md). Existing motion and reduced-motion behavior remain intact.
- Verification: desktop/mobile image loading, overflow, theme-color regression, reduced-motion checks and WCAG axe scans; frontend unit tests and production build. Screenshots use matching route, viewport, theme and synthetic demo content, captured before editing and after verification.
- Desktop [dark before](docs/screenshots/changes/niva-artwork-desktop-dark/before.png) · [after](docs/screenshots/changes/niva-artwork-desktop-dark/after.png), [light before](docs/screenshots/changes/niva-artwork-desktop-light/before.png) · [after](docs/screenshots/changes/niva-artwork-desktop-light/after.png); mobile [dark before](docs/screenshots/changes/niva-artwork-mobile-dark/before.png) · [after](docs/screenshots/changes/niva-artwork-mobile-dark/after.png), [light before](docs/screenshots/changes/niva-artwork-mobile-light/before.png) · [after](docs/screenshots/changes/niva-artwork-mobile-light/after.png).

## Unreleased — Niva mascot pictures and motion

- Add two original Niva poses, waving and exploring an opportunity, in optimized WebP. Add mascot pictures to the three steps and closing invitation. Preserve the original hero illustration and Hebrew content. [Artwork briefs](docs/mascot-artwork.md).
- Add a gentle four-second greeting, short entrance movement and a brief sparkle animation. Motion settles automatically and follows reduced-motion preferences. Hover effects are subtle; text remains fully opaque during entrance. Mobile artwork uses contain sizing so the whole character remains visible.
- Verification: 59 frontend tests, test and browser type checks, eight desktop/mobile homepage and mascot browser checks including both themes, image loading, overflow, WCAG axe scans and reduced motion. Production build is checked during packaging. No account, authentication or backend behavior changes.
- Genuine baseline/current-source images use matching viewport, theme, route and synthetic demo content. Baseline is served from the unchanged original checkout; current source from the isolated Sites checkout. Desktop [light before](docs/screenshots/changes/niva-mascot-desktop-light/before.png) · [after](docs/screenshots/changes/niva-mascot-desktop-light/after.png), [dark before](docs/screenshots/changes/niva-mascot-desktop-dark/before.png) · [after](docs/screenshots/changes/niva-mascot-desktop-dark/after.png); mobile [light before](docs/screenshots/changes/niva-mascot-mobile-light/before.png) · [after](docs/screenshots/changes/niva-mascot-mobile-light/after.png), [dark before](docs/screenshots/changes/niva-mascot-mobile-dark/before.png) · [after](docs/screenshots/changes/niva-mascot-mobile-dark/after.png). Motion is disabled for comparable stills.
- This update is authored directly in the Sites source repository. Remove the previous release's GitHub content mapping because it no longer matches the changed source; retain native Sites commit provenance without claiming this update was pushed to GitHub. Figma artwork was not linked in the project; the existing original mascot is the visual reference.

<a id="version-29"></a>

## Version 29 — CV import and required account setup

Published 25 October 2026. [Publication receipt](docs/verification/publication-20261025-v29.json). Live source and setup configuration verified. Reloading the existing signed-in Chrome workspace route now opens the CV setup step with an enabled file picker. No real CV or preferences were written during validation; all write-path checks use disposable synthetic accounts.

- Integrated the separately published mascot work from Sites commits `9db5decebeef9acbefb1c3362ffeaee771b28d1d` and `b195043dcf5205e9508722f19c39da75bccf58ca` without overwriting its assets or behavior; synchronize the combined reviewed source to GitHub and restore an accurate content mapping for this release.
- Require signed-in production users to finish account setup before the personal workspace, including direct workspace links and OAuth returns. First enter a CV or choose a PDF/DOCX, review the extracted text and explicitly save/activate it; then confirm job preferences before entering the requested workspace route. Resume setup after a reload, retain choices after failed saves, and return to CV entry when the active CV expires or is removed. Existing valid CVs advance to preferences. The account/sign-out and public information pages remain reachable.
- Persist setup completion with the preferences using the existing account revision controls. Both local SQLite and hosted D1 reject completion without a current confirmed active CV. Account erasure resets setup. Production advertises the required flow; existing browser-test demo accounts retain their explicit test mode.
- Replace the disabled scanner-dependent file picker with browser-local text extraction using PDF.js and fflate. PDF/DOCX files up to 10MB can be selected; PDFs are limited to 20 pages and text to 30,000 characters. Review precedes server writes. Raw files stay in the browser; the confirmed text is stored for 30 days. Scanned, encrypted or unreadable documents need pasted text; OCR and original-file storage are not provided by this import path. Bound DOCX expansion, reject XML entities/invalid structures and serve parser workers/fonts/maps from the same origin. Preserve the existing separately configured server scanner API.
- Force a fresh resume snapshot after draft creation so an older pending read cannot hide a newly saved CV. Update the FAQ/privacy text and the old scanner-disabled browser assertions. Correct two pre-existing screenshot-test indentation issues required by the formatting check.
- Verification passed: 59 frontend tests, 105 server tests, Worker/provenance checks, all three type checks, formatting and production build. After preserving the concurrent mascot source update, all 184 desktop/mobile browser tests passed in one full run. After also preserving the subsequent UI-polish update, all 38 affected CV/setup, homepage, mascot and polish cases passed again, including both-theme accessibility and anonymous-entry checks. Real PDF/DOCX fixtures verify browser extraction under production CSP with no CV POST before review; malformed, oversized and compressed oversized inputs recover. The complete setup flow checks reload, failed preference saves, active-CV loss, deep links and persistence. Both setup steps pass axe in both themes and viewports.
- Genuine paired CV entry images (same synthetic account/route/viewport/theme): desktop [light before](docs/screenshots/changes/cv-import-desktop-light/before.png) · [after](docs/screenshots/changes/cv-import-desktop-light/after.png), [dark before](docs/screenshots/changes/cv-import-desktop-dark/before.png) · [after](docs/screenshots/changes/cv-import-desktop-dark/after.png); mobile [light before](docs/screenshots/changes/cv-import-mobile-light/before.png) · [after](docs/screenshots/changes/cv-import-mobile-light/after.png), [dark before](docs/screenshots/changes/cv-import-mobile-dark/before.png) · [after](docs/screenshots/changes/cv-import-mobile-dark/after.png). The new setup route has no prior screen: [desktop CV](docs/screenshots/changes/account-setup-desktop-dark/cv-step.png) · [preferences](docs/screenshots/changes/account-setup-desktop-dark/preferences-step.png), [mobile CV](docs/screenshots/changes/account-setup-mobile-dark/cv-step.png) · [preferences](docs/screenshots/changes/account-setup-mobile-dark/preferences-step.png); light-theme equivalents are alongside them. These new-route views are after-only evidence, not a fabricated comparison.

## Version 25 — Fresh employer checks on every visit

Published 25 October 2026. [Publication receipt](docs/verification/publication-20261025-v25.json). [Live evidence](docs/verification/visit-refresh-live-20261025.json): two consecutive fresh requests checked all 17 healthy sources; every source timestamp advanced on the second request. Both returned 188 current jobs without stale data, taking 5.7 and 4.8 seconds. No additional posting appeared in that interval. The existing Chrome dashboard loaded current jobs and retained the account name/photo.

- Every site entry or full page reload now checks the connected employer boards before returning current jobs. Explicit job refresh does the same. Filter changes and pagination reuse that checked snapshot. The 17 official Greenhouse/Lever employer boards remain the coverage boundary; this does not claim a search of the entire web or guarantee that employers have posted new jobs between visits.
- Fresh visit checks bypass healthy sources' normal 10–15 minute cadence. Four concurrent source workers fetch bounded responses, merge new/changed listings and close removed listings. Durable source leases let overlapping visits share in-progress checks across request/database adapters. Preserve provider Retry-After, failure backoff and last known listings; surface partial/stale data and actual source check times.
- Show a checking status while waiting and suppress misleading empty results during loading or errors. Keep account preferences, saved historical listings and existing cursor-change recovery. Source refresh performs no private-record cleanup. Correct the async D1 test double to serialize batches as D1 does.
- Verification: 59 frontend and 103 server tests; Worker and provenance regressions; all three type checks; formatting; production build. All 162 desktop/mobile browser cases passed, with one account/resume timing failure in the full run passing on isolated retry. The six visit/loading tests passed again after screenshot capture. Synthetic upstream tests prove added/removed listings, cadence bypass, concurrent visit sharing and Retry-After preservation.
- Genuine before/after views use the same synthetic account, route, viewport and theme: desktop [light before](docs/screenshots/changes/visit-refresh-desktop-light/before.png) · [after](docs/screenshots/changes/visit-refresh-desktop-light/after.png), [dark before](docs/screenshots/changes/visit-refresh-desktop-dark/before.png) · [after](docs/screenshots/changes/visit-refresh-desktop-dark/after.png); mobile [light before](docs/screenshots/changes/visit-refresh-mobile-light/before.png) · [after](docs/screenshots/changes/visit-refresh-mobile-light/after.png), [dark before](docs/screenshots/changes/visit-refresh-mobile-dark/before.png) · [after](docs/screenshots/changes/visit-refresh-mobile-dark/after.png).

## Version 24 — Account name and Google profile photo

Published 25 October 2026. Verified in the existing live Chrome session: the account name appears in the greeting and the Google photo loads successfully. [Publication receipt](docs/verification/publication-20261025-v24.json).

- Personalize the dashboard greeting with the signed-in name when the editable profile name is blank. Preserve the chosen profile name when set. Show the Google sign-in profile photo in the header, with a name initial when the image is absent, untrusted or fails to load. Keep the editable profile independent from provider details.
- Carry the existing authentication image through local and hosted session responses. Permit only HTTPS Google-hosted profile images in the avatar and allow those hosts in the image CSP; send no referrer. No Gmail mailbox permission or new OAuth scope is required. ChatGPT sessions without a photo keep the initial.
- Verification: 59 frontend tests, 100 server tests, Worker concurrency and provenance checks, all three type checks, formatting, production build and 28 relevant desktop/mobile browser checks. Synthetic name/photo fixtures cover both themes, profile-name precedence, absent/untrusted photos and failed image loading. Live Google photo availability remains dependent on the provider account.
- Genuine paired images, same route, viewport, theme and synthetic account: desktop [light before](docs/screenshots/changes/account-identity-desktop-light/before.png) · [after](docs/screenshots/changes/account-identity-desktop-light/after.png), [dark before](docs/screenshots/changes/account-identity-desktop-dark/before.png) · [after](docs/screenshots/changes/account-identity-desktop-dark/after.png); mobile [light before](docs/screenshots/changes/account-identity-mobile-light/before.png) · [after](docs/screenshots/changes/account-identity-mobile-light/after.png), [dark before](docs/screenshots/changes/account-identity-mobile-dark/before.png) · [after](docs/screenshots/changes/account-identity-mobile-dark/after.png).

<a id="version-23"></a>

## Version 23 — Explain signed-in login and account switching

Published 25 October 2026. [Receipt](docs/verification/publication-20261025-v23.json). Live readback on the exact affected Chrome tab confirms the new signed-in message and explicit switch action. The original session remains signed in. Google is active; Apple remains disabled. This post-publication Git record creates no additional hosted version.

- The Google button was hidden because the user was already signed in, not because the production deployment was missing. Show an explicit signed-in heading, explain how to reveal login methods, and add an intentional sign-out-and-choose action. Preserve existing account data and separate provider identities; do not sign out automatically. Remove the misleading ChatGPT-only description for already authenticated social users.
- Reuse the existing sign-out flow, retain the session after a failed request, report the failure, guard duplicate actions and focus Google after successful social sign-out. Browser regressions cover both provider branches, failure recovery, keyboard activation and accessibility.
- Verification passed: 59 frontend unit tests, all three type checks, formatting, production build and 84 relevant browser checks across desktop/mobile Chromium, Firefox and WebKit, including both themes and axe scans. Server/auth configuration is unchanged. Actual affected Chrome page [Before](docs/screenshots/changes/chrome-login-refresh/before.png) · [After](docs/screenshots/changes/chrome-login-refresh/after.png). Live publication readback passed; the real Chrome session was not signed out during verification.

<a id="version-22"></a>

## Version 22 — Worker request-context repair

Published 25 October 2026. GitHub source `62a02c8771891a0a6ec20dd8b2f9d25bb5d6ca29`; Sites source `18402c958defc9d562d5b17910dd696ae7871916`. [Publication receipt](docs/verification/publication-20261025-v22.json). Live catalog: **188 real jobs, 17 healthy sources**. Google login, save/reload/two-tab persistence, sign-out and a second sign-in passed. Temporary save removed and original System theme restored. [Live evidence](docs/verification/google-live-20261025.json). Apple remains disabled at the user’s request; no paid enrollment was purchased. Google and ChatGPT retain separate accounts.

This Git-only release record creates no additional hosted version. Document [Before](docs/screenshots/changes/publication-source-expansion-record/before.png) · [After](docs/screenshots/changes/publication-source-expansion-record/after.png).

- Live Google login completed, but account refresh exposed a Worker-only concurrency error: the server bundle selected Better Auth's browser AsyncLocalStorage fallback. Resolve package exports with the `workerd` condition so the native server request context is used. Preserve the provider, signing secret, cookies and account records.
- Add `npm run test:worker` to CI. It bundles the actual hosted auth entry with the production options, checks the selected dependency implementation and verifies 40 overlapping session reads for two synthetic identities. The regression and production build pass. The client artifact digest is unchanged from version21, so the passing 292-case browser suite is retained rather than rerun for this server-build-only correction.
- Non-UI evidence from the previous published and corrected build configurations: [Before](docs/screenshots/changes/worker-runtime-context/before.png) · [After](docs/screenshots/changes/worker-runtime-context/after.png). Final live session/save/sign-out readback passed on version22; [authenticated dashboard](docs/screenshots/changes/google-signin/live-google-account.png) and [temporary saved job](docs/screenshots/changes/google-signin/live-saved-job.png) exclude account details. One live Google identity in one browser was checked; independent live identities and physical cross-device checks remain unverified.

<a id="version-21"></a>

## Version 21 — Expanded employer coverage and hosted Google sign-in

Published 25 October 2026. GitHub source `0326a6b0157381e5e5542c4d1cd66d6fa0a16000`; Sites source `e1c39829129bdbb5103c526637a1b43ea3dc601a`. Deployment succeeded. Live readback found 188 jobs across 17 healthy sources and completed Google OAuth, then exposed the Worker concurrency defect described above. Publication is not a claim that the defect was absent.

- Expand the source registry from two to 17 official employer ATS boards. A real provider check returned 188 Israeli listings; this is a point-in-time local ingestion result, not a claim about the deployed catalog before publication. Preserve employer attribution, original links, existing IDs/saves, bounded snapshots and failure/backoff behavior. Match multi-office listings against either explicit office district. Never infer worldwide remote eligibility.
- Refresh due sources during site traffic with durable leases, without running private-record cleanup. No unattended cron is claimed. Show the actual source names/times in a compact disclosure, clarify pagination/map coverage and remove the obsolete two-employer descriptions.
- Prepare hosted Google/Apple provider support using the existing Better Auth implementation with D1. Keep ChatGPT sign-in and existing owner IDs; use separate OAuth owner IDs, no implicit merging/linking, exact-origin checks, PKCE/state and secure cookies. Clear optional social sessions on sign-out. Append the generated additive auth migration and typed schema.
- With explicit user approval, create the Niva Production Google project/client, accept Google's user-data policy, add live public branding URLs and publish the OAuth audience. Store credentials only in the hosting secret manager. The real Google round trip completed; the later Worker reliability correction and final checks are recorded in version22. Apple remains unavailable pending an eligible developer account/app and Services ID; no Apple membership, paid plan or recurring cost was purchased.
- [Implementation and verification report](docs/source-expansion-20261025.md). Genuine catalog [Before](docs/screenshots/changes/source-expansion/before.png) · [After](docs/screenshots/changes/source-expansion/after.png), login [Before](docs/screenshots/changes/google-signin/before.png) · [After](docs/screenshots/changes/google-signin/after.png). Images show the actual published before/after views.
- Final local verification passed: 59 frontend, 100 server, 1 provenance and all 292 browser tests across desktop/mobile Chromium, Firefox and WebKit. All three type checks, formatting and the Angular/Worker production build passed. Focused D1/PKCE/session tests use controlled synthetic data; real Google OAuth readback is recorded in version22.

## 25 October 2026 — Live account verification follow-up

- Observed a failed completed sign-in returning to the Angular not-found screen at `/callback`. Refreshed hosting by redeploying the existing version20 through the supported public operation, retaining source, audience and secrets. The retry completed successfully and returned to `/app`; the exact initial failure cause is not established. No new application version was created.
- Verified an authenticated save of Application Security Engineer, persistence after reload and visibility in a second same-browser tab. Removed only the temporary save and verified the original zero-save state after reload in both tabs. Profile/preferences and existing records were not edited; no resume or employer submission was involved.
- [Live evidence](docs/verification/live-account-20261025.json). Genuine callback journey [Before](docs/screenshots/changes/custom-domain-signin/before.png) · [After](docs/screenshots/changes/custom-domain-signin/after.png); saved-list [Before](docs/screenshots/changes/live-saved-job/before.png) · [After](docs/screenshots/changes/live-saved-job/after.png). Callback images show the failed and completed journey on different destination routes; saved-list images use the same route/theme/viewport. Account details and callback parameters are excluded.
- [Documentation before](docs/screenshots/changes/live-account-verification-record/before.png) · [After](docs/screenshots/changes/live-account-verification-record/after.png). Focused live checks and documentation formatting verified; no full application suite rerun because application code is unchanged. Independent live identities, physical cross-device access and inactive providers remain unverified.

<a id="version-20"></a>

## Version 20 — Custom domain and public launch

Published **25 October 2026** at [getnivajobs.com](https://getnivajobs.com). Public audience is enabled as requested. Reviewed GitHub source: `4a089edbb994750966d3ef46a61d0bd236cf9b0d`; Sites source: `057bd6a2d5eba554edf234c26e464104073a4045`. Deployment succeeded; live build metadata confirms the clean reviewed-source mapping. [Publication receipt](docs/verification/publication-20261025-v20.json), [live HTTP/TLS evidence](docs/verification/public-launch-live-20261025.json) and [source-only refresh](docs/verification/public-launch-source-refresh-20261025.json). This subsequent Git-only record update creates no additional hosted version. Actual document record: [Before](docs/screenshots/changes/publication-public-launch-record/before.png) · [After](docs/screenshots/changes/publication-public-launch-record/after.png).

- Connect the approved one-year `getnivajobs.com` registration to the existing Sites project with apex/www DNS and managed HTTPS. Disable registrar auto-renew as requested; preserve nameservers, email DNS and unrelated records. No new paid subscription or renewal is authorized.
- Add read-only database/schema health checks, explicit canonical-host configuration, public sitemap/robots metadata, private-route indexing controls, HSTS and cache policies. Let assets and the recovery shell load when API configuration is unavailable.
- Add a protected source-only ingestion refresh that does not run private retention cleanup. Preserve existing account data and secret entries; add the operator secret through the provider secret manager.
- [Launch status and maintenance instructions](docs/public-launch.md) distinguish implemented/live features from disabled AI, scanner, OAuth/email, unattended scheduling and unverified provider backup/restore and independent live account gates.
- Genuine non-UI source evidence: [Before](docs/screenshots/changes/public-launch-policy/before.png) · [After](docs/screenshots/changes/public-launch-policy/after.png). The application design is unchanged; source images are not proof of live services. Registrar before evidence was not captured before the user's purchase; verified [renewal](docs/screenshots/changes/public-launch-policy/registrar-autorenew-off.png) and [DNS](docs/screenshots/changes/public-launch-policy/registrar-dns.png) after evidence is recorded separately.
- Verification: 59 frontend, 90 server, 1 provenance and all 280 browser checks passed (desktop/mobile Chromium, Firefox, WebKit); all three type checks, formatting and the Angular/Worker production build passed. The initial formatting check flagged this new changelog entry; it was formatted and the check passed. Live verification passed public pages, nested routes, assets/compression/cache, database/schema health, robots/sitemap, HTTPS and canonical redirect. Anonymous private reads return 401; spoofed identity remains anonymous. Both sources refreshed successfully without private cleanup; the combined catalog contains 27 jobs. The subsequent live-account follow-up verifies completed custom-domain sign-in and a reversible save across reload/two same-browser tabs. Independent identities, physical cross-device access, scheduling, backup restoration and inactive providers are not claimed verified.

<a id="version-19"></a>

## Version 19 — UI/UX review repairs

Published **25 October 2026** after authorization. Deployment succeeded. Reviewed GitHub source: `8aa5de3730724caaaa964fd32bf6aa133523c819`; Sites source: `e94033e05a20b767b3537ed28503c3972be375ce`. Live build metadata verifies the clean mapping. [Publication receipt](docs/verification/publication-20261025-v19.json). Existing owner-only access and inactive providers/scheduler are preserved. No new schema migration or live deletion operation.

This subsequent Git-only release-record update does not change application code or create another hosted version. Genuine document record: [Before](docs/screenshots/changes/publication-ui-review-record/before.png) · [After](docs/screenshots/changes/publication-ui-review-record/after.png).

### UI/UX repair scope and original verification

- **UI-01:** wrap full job titles/employers without truncation in cards, dashboard, saved/feed/map lists, detail and career context. Keep RTL/bidi isolation and action sizing.
- **UI-02:** react to URL query changes and removal in assistant/resumes; invalidate stale chat completion and tailoring selection while preserving unrelated drafts and matching request context.
- **UI-03:** track individual listing loading, missing, authentication, rate-limit, server, timeout, invalid-response and network states; retry that listing without reloading the app or retrying the feed.
- **UI-04:** associate the actual password validation error with its field and focus the first invalid input after validation renders. Preserve field values on server failure.
- **UI-05:** replace the off-screen inline resume-delete confirmation with a labeled native modal dialog. Focus cancel, support Escape/focus restoration and guard duplicate deletion while busy.
- **UI-06:** retain the existing onboarding artwork with normal blending, original proportions and a soft elliptical edge mask in both themes.
- **UI-07:** show saved versions/current review before secondary creation/privacy sections. Keep concise retention/delayed-cleanup notices visible, processing consent explicit and full maintenance details discoverable.
- **UI-08:** increase important metadata to 13px and remove duplicate source text from the employer subtitle. Preserve version18 action spacing and theme tokens.
- Clarified stale capability/staging documentation without claiming hosted operations passed. All original review evidence remains intact. Final verification, scorecard and image links are recorded in the [implementation report](docs/ui-review-repairs-20261025.md) and [genuine before/after gallery](docs/screenshots/changes/ui-review-images.md).
- Verification:59 frontend,79 server and1 provenance check passed; all three type checks, formatting and production build passed. The initial276-case browser run had262 passes,13 failures and1 flaky case. After correcting disclosure-test flows, context-fixture timing and WebKit timeout handling,76 affected cases passed without retries; a final obsolete-tailoring-error guard passed8 focused cases, including4 new cases. Consolidated browser coverage:280 passing cases. The220-case route audit has no overflow and88 axe scans have no reported violations. See the report for exact scopes and initial failures.
- The original local repair pass performed no commit, push or deployment. The subsequent authorized publication commits/syncs and deploys that verified source as version19. No production access/data change, provider activation or scheduler activation was performed. Revised local UI judgments are8/10 in each overall category, with Medium overall confidence; actual browser zoom, spoken Hebrew screen-reader output, physical devices and hosted gates remain separate evidence requirements.

<a id="version-18"></a>

## Version 18 — Job-card action layout

Published **25 October 2026**. Reviewed GitHub source: `c5d8d1bc2b80c631a6a95a57236fe209378c5530`; Sites source: `6aca23298fa4d76a911e9ee0e328f5e6fe0bad17`. Deployment succeeded; [publication receipt](docs/verification/publication-20261025-v18.json). The post-publication record is a Git-only documentation update.

### Job-card action spacing — 25 October 2026

- Separated the conversation/resume action row from the footer divider by 20px, with 16px above it. Equal-width buttons form a balanced two-column row; cards with 360px or less of content width stack them at full width. Scoped styles preserve the shared buttons, Hebrew RTL, theme tokens, keyboard focus and existing destinations.
- Genuine synthetic-data comparisons: desktop [Light before](docs/screenshots/changes/job-card-actions-desktop-light/before.png) · [Light after](docs/screenshots/changes/job-card-actions-desktop-light/after.png) · [Dark before](docs/screenshots/changes/job-card-actions-desktop-dark/before.png) · [Dark after](docs/screenshots/changes/job-card-actions-desktop-dark/after.png); mobile [Light before](docs/screenshots/changes/job-card-actions-mobile-light/before.png) · [Light after](docs/screenshots/changes/job-card-actions-mobile-light/after.png) · [Dark before](docs/screenshots/changes/job-card-actions-mobile-dark/before.png) · [Dark after](docs/screenshots/changes/job-card-actions-mobile-dark/after.png).
- Verification: 59 frontend, 79 server, 1 provenance and 208 browser checks passed; all three type checks, formatting and production build passed. The four layout/focus probes show the footer gap improved from 0px to 20px, all buttons retain at least 44px height, no horizontal overflow, and links retain their selected-job query. [Verification record](docs/verification/job-card-actions-20261025.json). Published as version 18 after these checks. Existing provider/scheduler limitations are unchanged.

<a id="version-17"></a>

## Version 17 — Independent-review repairs

Published on **25 October 2026** after the user authorized publication. Sites reports deployment success. Reviewed GitHub source: `a9d4001cb9d71c2010903b994a8142af5a5ac54d`; Sites source: `d9db15d1a0d61104768bf1e419af64a8ad6eeec1`. Live build metadata verifies that mapping with a clean source state; the authenticated jobs page loads correctly. [Publication receipt](docs/verification/publication-20261025-v17.json). Existing owner-only access is preserved. AI/scanning/scheduling remain inactive and the hosted staging gates below remain unresolved.

The release includes the repairs and genuine image pairs below. A subsequent Git-only record update confirms publication without changing application code or creating another hosted release. Actual publication-record document captures: [Before](docs/screenshots/changes/publication-v17-record/before.png) · [After](docs/screenshots/changes/publication-v17-record/after.png).

### 25 October 2026 — standing progress and verification rules

- Updated [AGENTS.md](AGENTS.md) to require step-by-step progress updates in every task and one complete relevant verification run before final handoff, with focused intermediate checks only for specific issues. Documentation-only changes use appropriate checks. Application code/UI is unchanged. Genuine instruction-file captures: [Before](docs/screenshots/changes/workflow-progress-and-final-checks-20261025/before.png) · [After](docs/screenshots/changes/workflow-progress-and-final-checks-20261025/after.png). The rule update is included in the reviewed source published as version 17.

### 25 October 2026 — independent-review repair evidence

The original local repair pass performed no commit, push or deployment. The subsequent authorized publication now deploys that verified source as version 17. No live access change, provider activation, real-resume transmission or existing-live-data deletion was performed. See the [implementation/reassessment report](docs/review-repairs-20261025.md) and [complete genuine before/after gallery](docs/screenshots/changes/review25-images.md).

- **N01 — Maintenance/operations:** added bearer-protected operational health, an independent watchdog with named-operator delivery, cooldown/retry and a local loopback transport test, optional private-Sites service authorization, and concise candidate guidance with collapsed operator diagnostics. Hosted scheduler, actual operator delivery and retention target remain unverified; no service was activated. [Before](docs/screenshots/changes/review25-maintenance-desktop-light/before.png) · [After](docs/screenshots/changes/review25-maintenance-desktop-light/after.png). Mobile/dark pairs are in the gallery.
- **N02 — Scoped deletion:** separated whole-account erasure from item invalidation, pruned deleted/dependent state and preserved unrelated A/new-text drafts across local and cross-tab B deletion. Added a constant-default erasure token through appended Node005/D1-0003 migrations; retained lifecycle/write guards and whole-account clearing. [Before](docs/screenshots/changes/review25-draft-desktop/before.png) · [After](docs/screenshots/changes/review25-draft-desktop/after.png). The mobile pair and test evidence cover the same loss path.
- **N03 — Stored capacity:** enforced the twenty-version limit inside the shared conditional insert for create/edit/tailor/scanner completion; expiry/deletion/failure do not consume leaked capacity. Mixed concurrent operations return a recoverable VERSION_LIMIT409 on the losing requests. The actual executed probe output changed from21 records to20 on both local adapters; actual hosted D1 is still a staging gate. Product UI unchanged. [Before](docs/screenshots/changes/review25-capacity/before.png) · [After](docs/screenshots/changes/review25-capacity/after.png).
- **N04 — Hebrew terminology:** added Unicode-aware negation tokens, contrast/list scope, diacritic handling and not-only exceptions; retained positive snippets and conservative unknowns. Matching method is evidence-v3, still terminology coverage rather than hiring probability. [Before](docs/screenshots/changes/review25-hebrew-desktop-light/before.png) · [After](docs/screenshots/changes/review25-hebrew-desktop-light/after.png). Other viewports/themes are in the gallery.
- **N05 — Career synchronization:** added a coherent owner/active-pointer/resume snapshot with revision, focus/visibility refresh, thirty-second visible polling, expiry-aware active selection and owner-scoped tab events. Reconciliation preserves drafts and rejects stale responses; account erasure remains a separate privacy boundary. [Before](docs/screenshots/changes/review25-sync/before.png) · [After](docs/screenshots/changes/review25-sync/after.png).
- **N06 — Rejected model output:** withhold raw text while bounded provider output is collected; send content-free progress, validate citations/URLs, persist only accepted completion, then stream accepted text. Rejection clears any legacy provisional display with an explicit retryable explanation. Syntax checks do not establish factuality. [Before](docs/screenshots/changes/review25-rejected-answer-desktop-light/before.png) · [After](docs/screenshots/changes/review25-rejected-answer-desktop-light/after.png). Mobile/dark pairs are in the gallery.
- **N07 — Staging boundaries:** added a safe-default machine-readable gate plan, synthetic model corpus, a read-only disposable-staging identity/known-record/header checker that refuses production, and the recovery/D1/provider/retention/operator handoff. Script types are covered by server type checking. No real model, scanner, hosting isolation or restoration pass is claimed. Product UI unchanged. [Before](docs/screenshots/changes/review25-operations-handoff/before.png) · [After](docs/screenshots/changes/review25-operations-handoff/after.png).
- **Verification:**59 frontend tests,79 server tests,1 provenance test,208 full browser cases plus focused rechecks; type checks, formatting and production build. Real local backend/outbox journeys are distinct from browser fixtures, SQLite-backed D1 doubles, provider mocks and unverified hosted gates. Exact execution scope, source digests and limitations are recorded in the report.

- Recorded the user's standing workflow requirement in [AGENTS.md](AGENTS.md): every future change must update this changelog and include genuine before-and-after images linked from its entry and checked into Git. This records a development instruction; the instruction is included in version 17.

This log uses **Sites release numbers 1–23**, not semantic package versions (`package.json` remains `0.1.0`). Version 23 is the latest published release. This Git documentation update does not create a new hosted version.

Live site: [Niva](https://getnivajobs.com/). Public audience was authorized for version20 and remains public.

Entries were reconstructed from Sites saved-version/deployment records and source diffs. The version 1–16 deployment attempts returned `succeeded` when checked on 24 October 2026; versions 17–23 returned `succeeded` on 25 October 2026; that status means deployment completed, not that every feature worked correctly. Dates below are **source commit dates in Asia/Jerusalem**, not inferred exact first-publication timestamps. The [version evidence manifest](docs/verification/site-versions.json) records full source/deployment identifiers and archive hashes; record-update timestamps are labelled separately.

Sites and GitHub have separate Git histories. `Sites source` identifies the exact published checkout. Version 16 explicitly maps to reviewed GitHub commit [`8bb4dc1`](https://github.com/orKonijn/Niva-/commit/8bb4dc1371d352d79eb1eb05a2da480c396b6241), with `mappedSourceVerified: true` and `dirty: false` in the [live build metadata](https://niva-demo-ziv-20261023.ork77.chatgpt.site/build-info.json). Earlier entries do not invent an exact GitHub-to-Sites SHA mapping.

## Release index

| Version | Source date | Changes                                                                  |
| ------- | ----------- | ------------------------------------------------------------------------ |
| 23      | 2026-10-25  | [Explain signed-in login and account switching](#version-23)             |
| 22      | 2026-10-25  | [Worker request-context repair and verified Google sign-in](#version-22) |
| 21      | 2026-10-25  | [Expanded employer coverage and hosted Google sign-in](#version-21)      |
| 20      | 2026-10-25  | [Custom domain and public launch](#version-20)                           |
| 19      | 2026-10-25  | [UI/UX review repairs](#version-19)                                      |
| 18      | 2026-10-25  | [Job-card action layout](#version-18)                                    |
| 17      | 2026-10-25  | [Independent-review repairs](#version-17)                                |
| 16      | 2026-10-24  | [Reliability, privacy and evidence repairs](#version-16)                 |
| 15      | 2026-10-24  | [Worker-compatible source retrieval](#version-15)                        |
| 14      | 2026-10-24  | [Reliable feed bootstrap lifetime](#version-14)                          |
| 13      | 2026-10-24  | [Career workspace and two-source discovery](#version-13)                 |
| 12      | 2026-10-24  | [Homepage aligned with the real account workflow](#version-12)           |
| 11      | 2026-10-24  | [Real jobs and accounts become the normal experience](#version-11)       |
| 10      | 2026-10-24  | [RTL district/category filter layout repair](#version-10)                |
| 9       | 2026-10-24  | [Hosted stylesheet/CSP compatibility](#version-9)                        |
| 8       | 2026-10-24  | [Hosted accounts and first real employer feed](#version-8)               |
| 7       | 2026-10-24  | [Google and Apple brand icons](#version-7)                               |
| 6       | 2026-10-24  | [Account/map frontend and honest static-hosting limits](#version-6)      |
| 5       | 2026-10-23  | [Compact tablet filters and release checks](#version-5)                  |
| 4       | 2026-10-23  | [Tailwind and shared component refactor](#version-4)                     |
| 3       | 2026-10-23  | [Theme icon beside the logo](#version-3)                                 |
| 2       | 2026-10-23  | [District preferences, multiple work styles and themes](#version-2)      |
| 1       | 2026-10-23  | [Initial Hebrew RTL frontend demo](#version-1)                           |

<a id="version-16"></a>

## Version 16 — Reliability, privacy and evidence repairs

Source date: **2026-10-24**. Sites source: `caabf08d7bdbe94b1cfa47e2677df9fd606aa0e1`.

- Prevented in-flight resume creation, processing, editing, tailoring, scoring and chat writes from recreating deleted private data. Account/private deletion now shares an atomic lifecycle boundary; private client state and other tabs are invalidated.
- Made the active resume an owner-level selection, so reviewing another version cannot overwrite it. Preserved unsaved edits when switching or reselecting resume versions.
- Kept distinct job requisitions separate, grouped only canonical identities, and aligned saved totals, pagination, list and map datasets.
- Preserved exact resume text/order during tailoring and displayed relevant evidence separately. Added conservative Hebrew/English negation and uncertainty handling.
- Persisted verified conversation job IDs, source versions and check times; reopened references show changed, closed or unavailable listings.
- Added independent retention maintenance, scheduler/cleanup health, coverage-aware empty states and local-date formatting in resume/conversation/job-detail views. Hosted scheduling still requires configuration.
- Added reviewed GitHub-to-Sites source mapping, clean-build metadata and content/artifact digests. Added focused race, migration, evidence and synthetic provider-safety regressions.
- Verification: 53 frontend tests, 65 server tests, 1 provenance test, three type checks, formatting and production build; 192 browser cases plus a 56-case targeted recheck. Publishing checkout repeated 65 server tests and build. No real AI/scanner verification or automatic employer submission.

<a id="version-15"></a>

## Version 15 — Worker-compatible source retrieval

Source date: **2026-10-24**. Sites source: `91d50a1267d246d8c03e46d4e9dfe7bd03c22976`.

- Replaced the unsupported Worker redirect:error policy with manual redirect handling for official source requests.
- Recovered initial source configuration failures from the earlier redirect policy without overriding genuine rate-limit backoff.
- Kept previously successful snapshots and explicit stale-data warnings; this did not activate recurring hosted ingestion.

<a id="version-14"></a>

## Version 14 — Reliable feed bootstrap lifetime

Source date: **2026-10-24**. Sites source: `2d7f9763a902885f45cdc653f784dad81a06d820`.

- Kept feed initialization alive for the Worker execution lifetime when browser requests are cancelled.
- Retried partially initialized source tables and sources that had never completed a successful initial check.
- Preserved source leases and backoff. Recurring checks after successful bootstrap still required an external schedule.

<a id="version-13"></a>

## Version 13 — Career workspace and two-source discovery

Source date: **2026-10-24**. Sites source: `2dcec00a4797d979d144c33f1531e4da96c73256`.

- Added durable multi-source Israeli job discovery from AppsFlyer/Greenhouse and WalkMe/Lever, source health, explicit refresh and HMAC-bound cursor pagination.
- Added authenticated resume text drafts, immutable edited/tailored versions, fact review, explicit activation, TXT/JSON exports and owner-scoped deletion with 30-day retention.
- Added deterministic preference/terminology explanations and labelled sorting over loaded results.
- Added the optional consented streaming career assistant with bounded server-owned job context, quotas, cancellation/retry and private conversation history.
- Added gated PDF/DOCX processing with type/size checks and named-processor consent. AI/scanning remained unavailable without configured services; mocks were not production provider validation.
- Kept hosted migrations schema-only and imported historical listing snapshots through ingestion. Retained separate device demo workflows. Later versions 14–16 repaired bootstrap and review-discovered lifecycle/evidence defects.

<a id="version-12"></a>

## Version 12 — Homepage aligned with the real account workflow

Source date: **2026-10-24**. Sites source: `73e1db943277890a20d4e0d14fe6257a54ccc4d7`.

- Updated homepage descriptions to match source-job search, saved jobs, persistent account preferences, original employer links and approximate maps.
- Clarified that resume parsing and AI sending required separately configured services, and that viewing an employer listing was not an application submission.

<a id="version-11"></a>

## Version 11 — Real jobs and accounts become the normal experience

Source date: **2026-10-24**. Sites source: `2ba4aefa17952b05a58d3ed2045b2d4bc32dcd68`.

- Made source jobs the normal hosted workspace entry and moved the fictional catalog behind an explicit demo choice.
- Aligned landing, dashboard, navigation, profile and account flows with the authenticated job-search experience.
- Provided the top-level ChatGPT sign-in path and truthful provider-availability/failure states.
- Retained demo approvals/history/pause as separate demonstration behavior; original-source links remained the way to apply.

<a id="version-10"></a>

## Version 10 — RTL district/category filter layout repair

Source date: **2026-10-24**. Sites source: `52e0f50ad3c0ba3b500114359468f3a55057f043`.

- Moved district and professional-field labels above their controls and made selects use consistent full widths and readable sizing.
- Adjusted the filter grid/work-style row to avoid compressed or misaligned controls on narrow layouts.

<a id="version-9"></a>

## Version 9 — Hosted stylesheet/CSP compatibility

Source date: **2026-10-24**. Sites source: `4ca035b907bca74624a39633fe5ef5235b152738`.

- Loaded Angular production CSS directly rather than relying on inline stylesheet activation blocked by the hosted script policy.
- Added a production HTML check to catch the same CSP incompatibility before packaging.

<a id="version-8"></a>

## Version 8 — Hosted accounts and first real employer feed

Source date: **2026-10-24**. Sites source: `543af89f9a783631c16af1d0499046a67bfd1e52`.

- Introduced the Worker/D1 hosted adapter with Sites-verified ChatGPT identity, durable account profile/preferences/theme/saves and revision-checked account mutations.
- Added public Israeli AppsFlyer/Greenhouse job listings with original employer URLs, source attribution and conservative unknown work-style handling.
- Added shared local/hosted state validation, CSRF/body/rate limits, one-time reviewed demo import and account-data export/deletion.
- Added approximate source-job map locations and clearer loading, validation and retry states.
- Kept email/Google/Apple methods configuration-gated and approvals explicitly demo-only. The initial hosted CSS problem was repaired in version 9.

<a id="version-7"></a>

## Version 7 — Google and Apple brand icons

Source date: **2026-10-24**. Sites source: `324a1e42c1554788b7c9e8f9d196427f0bf7f57c`.

- Added Google and Apple logos to sign-in and account-linking controls, with shared accessible provider-logo rendering.
- Kept configuration gates intact; adding logos did not activate or verify OAuth providers.

<a id="version-6"></a>

## Version 6 — Account/map frontend and honest static-hosting limits

Source date: **2026-10-24**. Sites source: `508ae8c54da0618390ede8c1968eabd7eb68d6eb`.

- Added account/login/registration/reset/settings screens, profile/preferences/import/export flows and an accessible lazy-loaded job map.
- The repository included a Node/SQLite/Better Auth backend, but this hosted version remained a static frontend and clearly disabled account actions without that backend.
- Kept the guest demo usable and distinguished local CV filename selection from real document processing. Hosted persistence arrived in version 8.

<a id="version-5"></a>

## Version 5 — Compact tablet filters and release checks

Source date: **2026-10-23**. Sites source: `c0188e46432c4e146f67c9ccc793dc75e0f9d1d8`.

- Kept stacked tablet filter controls compact while retaining readable labels and usable work-style controls.
- Hardened release verification around expected work-style filter markup and added a compact-layout regression check.

<a id="version-4"></a>

## Version 4 — Tailwind and shared component refactor

Source date: **2026-10-23**. Sites source: `eed35ee575c91af03c5b0f35d763e24c05f9fea1`.

- Adopted Tailwind CSS 4 while preserving the existing Hebrew RTL design and theme tokens.
- Extracted templates, typed models/sample data, icons, branding and shared preference/theme controls into focused files.
- Split the large global stylesheet into tokens, base, component and marketing layers.
- Added build provenance, release checks and before/after visual regression evidence. Districts, multiple styles, expanded fields and theme behavior remained intact.

<a id="version-3"></a>

## Version 3 — Theme icon beside the logo

Source date: **2026-10-23**. Sites source: `1587213acb684831e5defd7111cb51f885787f57`.

- Replaced the separate theme selector/bar with a changing icon beside the Niva logo in landing and workspace navigation.
- Kept Light, Dark and System choices in the cycle, persistence and system-following behavior.
- Added accessible current/next-state labels and keyboard/assistive-technology feedback; adjusted small-screen branding.

<a id="version-2"></a>

## Version 2 — District preferences, multiple work styles and themes

Source date: **2026-10-23**. Sites source: `cea50be6906edd48491de3ff9572cd54691bce92`.

- Replaced city-based preferences with all six Israeli districts and an All districts option. Remote work became a work style, not a district.
- Added accessible multiple selections for On-site, Hybrid and Remote: OR within styles, AND across filter groups; no style selections means all styles.
- Expanded fields to nine typed categories, keeping QA automation distinct from workflow automation, and expanded sample jobs for meaningful testing.
- Added Light/Dark/System themes, shared contrast/focus tokens, persisted explicit choices and an early initialization script to avoid a wrong-theme flash.
- Migrated older city/single-style preferences while preserving saved jobs, demo approval history, pause state and employer exclusions.

<a id="version-1"></a>

## Version 1 — Initial Hebrew RTL frontend demo

Source date: **2026-10-23**. Sites source: `ea9c9c131c54f0c77ac417283153f4b81b7feb0c`.

- Published the Angular/TypeScript Niva landing page, mascot, FAQ, responsive navigation and local cookie preferences.
- Added a three-step onboarding flow, sample-job dashboard/search, job details, preferences, saved jobs, demo approvals/history and pause.
- Added device-local export/reset, temporary profile/filename selection, accessible form/focus behavior and automated checks.
- Explicitly remained a frontend demonstration: no connected authentication, real job feed, resume-content parsing, AI provider or employer submission.

## Current boundaries and remaining work

- Real listings cover two employer boards, not the whole Israeli job market. Unknown location/style data is not guessed.
- Hosted recurring ingestion/physical cleanup still needs a configured and observed schedule. Version 16 exposes overdue maintenance rather than claiming a running scheduler.
- Real AI, document scanning/parsing, Google/Apple OAuth and SMTP delivery are not established by synthetic tests or brand icons. Configuration gates remain visible.
- Demo approvals are not employer submissions; automatic applying, designed PDF/DOCX generation and OCR are not implemented.
- Version 16 is suitable for a controlled personal trial using non-sensitive data. Hosted isolation/recovery/maintenance and optional provider validation still gate a sensitive invited pilot or public release. See the [current operational matrix](docs/current-status.md) and [pre-publication review repair evidence](docs/review-repairs-20261024.md).

## Maintaining this log

For each subsequent saved release, add the actual Sites version number, a source-supported summary of changes and limits, the exact Sites SHA, a verified reviewed-source mapping when available, and observed deployment/check evidence. Keep fixes and disabled integrations explicit. Do not label a Git-only documentation update as a deployed release, infer activation from configuration code, or treat a successful deployment as a test result.
