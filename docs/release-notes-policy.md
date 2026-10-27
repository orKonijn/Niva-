# Changelog and release-note policy

Adopted 2026-10-26. Applies to meaningful development changes and release preparation. `CHANGELOG.md` remains the release-note source of truth.

## Project baseline and versioning

- The application package and lockfile currently identify **0.3.2**, the compatible discovery/eligibility repair candidate prepared for authorized deployment. Publication is recorded separately below. The package is private; no automated semantic-version release workflow is defined.
- The latest recorded application release is **0.3.1 / Sites43**; [publication/live receipt](verification/publication-20261026-v43.json). Earlier0.2.1 / Sites41 and0.3.0 / Sites42 receipts remain historical. The prior documentation-only publication was **Sites version 36**, published **2026-10-26**, synchronizing this policy and related documentation. Its [publication receipt](verification/publication-20261026-v36.json) identifies the deployment, reviewed source, verification scope and limitations. At that documentation-only publication, behavior and version `0.1.0` were unchanged. Version35 was its preceding feature release; its [receipt](verification/publication-20261025-v35.json) retains the original feature observations.
- Sites saved-version numbers are hosting identifiers, not semantic application versions or product-major milestones. Preserve the existing `Version N` history and publication receipts. Do not rename version 35 to `35.0.0`, infer `0.35.0`, or reserve version 36 for an unpublished documentation update.
- For a future actual application release, record the semantic version separately from its Sites identifier, for example `1.2.0 — YYYY-MM-DD` with a verified hosting-release reference. Do not invent a retroactive semantic mapping for historical Sites releases.
- This policy was initially committed under `Unreleased`, then published as **Sites version 36** after the user's separate publication instruction. At that documentation-only publication the package stayed **0.1.0**; no next semantic version was assigned then because application behavior and supported interfaces were unchanged. The subsequent compatible repair releases advanced through0.1.1/0.1.2 to0.1.3; the audit capability release0.2.0 and navigation patch0.2.1 followed. Receipt and status reconciliation after publication is a Git-only record, not another deployment.

Choose the next semantic version from the highest-impact change in the entire release, once per release:

| Impact                                                   | Increment                | Example            |
| -------------------------------------------------------- | ------------------------ | ------------------ |
| Incompatible supported interface or documented contract  | Major; reset minor/patch | `1.4.2` to `2.0.0` |
| Compatible capability, integration or public deprecation | Minor; reset patch       | `1.4.2` to `1.5.0` |
| Compatible fix to existing behavior                      | Patch                    | `1.4.2` to `1.4.3` |

Components are integers: `1.9.0` advances to `1.10.0`. Visual size, code volume, time spent and commit count do not determine compatibility. A redesign can be a compatible minor release. Incompatible removal needs a major release and migration guidance; deprecation needs a minor release and a supported alternative.

For Niva, assess compatibility of documented account/authentication behavior, provider and environment configuration, public API parameters/responses, import/export formats, persisted state and supported user workflows. While the application is below `1.0.0`, explicitly identify breaking changes and migration steps. There is no established pre-1.0 exception to the defaults above; do not silently invent one to avoid a compatibility decision.

## Before writing

1. Read `AGENTS.md`, the existing changelog, `package.json`, the lockfile, CI and relevant release/publication records.
2. Identify the latest recorded released version and inspect the changes since its reviewed source. Confirm implementation and relevant test results; use commit messages as clues, not proof.
3. Separate completed development changes from published behavior, feature flags, configured providers, staged rollout and planned work. Use point-in-time counts and availability only with their observation date and evidence.

The current CI validates formatting, type checks, unit/server/Worker/provenance checks, build and browser tests; it is not an automatic release publisher. `scripts/write-build-info.mjs` records source identity. Reviewed-source packaging and publication receipts establish source/deployment relationships. A build, changelog edit or passing test does not establish publication. Inspect the scope of any live verification script before use; `scripts/verify-release.mjs` includes state-changing demonstration journeys and is not a read-only status probe.

## Development and actual releases

- Keep an `Unreleased` section above numbered releases. Add completed changes that matter to users, integrators, compatibility, security or operation. Omit routine formatting, renaming, test maintenance and refactoring with no relevant external effect.
- When preparing an actual release, include only its changes; choose its semantic version, update package/lock versions together through the existing approved process, move the entries into a numbered release with its actual `YYYY-MM-DD` release date, and leave a fresh `Unreleased` section.
- Keep release drafts explicitly labeled until published. Record the actual Sites number only after it exists; preserve the verified source mapping and publication receipt. Do not use today's date to replace an earlier publication date.
- Preserve historical release entries, dates, evidence links and assets. Make factual corrections transparently instead of silently rewriting past evidence into stronger claims.

## Entry content and structure

Explain **what changed**, **why it matters**, and **what action or limitation applies** in short, specific sentences using product terminology. Group related implementation work into one meaningful change. Include internal work only when it affects users, integrators, compatibility, security or operation.

Use applicable **Added**, **Changed**, **Deprecated**, **Removed**, **Fixed** and **Security** headings; omit empty categories. For substantial releases, add a descriptive title, one-sentence summary and at most three highlights. Small patches can go directly to their fixes.

Put **Breaking changes and migration** near the beginning when relevant: identify affected users/integrations, previous and new behavior, required steps and a real migration/documentation link. Include **Known issues** for confirmed material limitations. Keep plans out of shipped notes. Describe measured performance only with the measurement context; test counts alone are not performance evidence. Distinguish broad availability, beta access, flags and configured services.

## Visual evidence

Use a few informative visuals for new screens, significant layouts/workflows and visible fixes. Capture the actual running implementation; use representative synthetic data and exclude credentials, private profiles and resumes.

- New feature: an in-use screenshot. A new screen does not need an invented before image.
- Redesign or visible fix: comparable genuine previous/current screenshots.
- Multi-step workflow: a short recording or a small screenshot sequence.
- Backend/API change: a useful request/response example or concise diagram when it clarifies the change; no obligatory UI screenshot.

Follow the existing `docs/screenshots/changes/<change-name>/` asset convention; leave historical assets in place. If no convention applies, use `docs/changelog/assets/unreleased/` while drafting, then `docs/changelog/assets/<semantic-version>/` at finalization and update links. Keep viewport, theme, zoom, scroll position and sample data comparable. Include mobile for materially affected mobile flows; keep text readable, crop to relevant content and offer larger views where supported.

Use descriptive alt text and a short caption explaining what to notice. Repository Markdown uses relative links; externally published notes need durable asset URLs supported by their destination. Never present generated mockups or retouched substitutes as observed screenshots. If a genuine before image or capture capability is missing, complete the text and disclose exactly what is unavailable without broken placeholder links. Documentation-only changes do not require product screenshots.

## Consistency and verification

Update existing release summaries, a What's New page or release-note component from the established source of truth when applicable. Keep versions, dates, descriptions, availability and visuals consistent; use the existing design system. Niva currently links release history from the README and capability documentation; no in-app What's New route was found when adopting this policy.

Before handoff, check:

1. Every entry matches the included implementation and available verification evidence.
2. The semantic-version decision matches compatibility impact; package and lockfile agree.
3. Dates, publication status, provider availability, performance and fix claims are supported and scoped.
4. Links/images resolve and are readable in the intended destination; historical releases/assets are preserved.
5. Breaking changes include actionable migration steps and confirmed material known issues are disclosed.
6. Run checks appropriate to the change. Documentation-only work needs formatting, link/evidence and consistency checks, not an unrelated application suite.

In the final handoff state the **current and proposed next versions with the reason**, **Unreleased/draft/published status**, **files updated**, **visuals actually added**, and **verification results or gaps**. Do not imply a deployment or publication that did not occur.
