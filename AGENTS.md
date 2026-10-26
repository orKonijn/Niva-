# Niva working instructions

## Progress updates and verification

- For every task, explain the intended work in the conversation before starting, then post concise updates as each meaningful step begins or completes. Say what you are doing, what you found and what comes next. Keep the user informed during longer work; do not wait until the final answer to describe the steps.
- Run the complete relevant verification suite once near the end, before the final handoff. Do not run the whole suite after every edit. During implementation, use focused checks only when needed to investigate a specific failure or unresolved risk.
- After final checks pass, repeat or broaden checks only when subsequent code changes, failures or unresolved concerns justify it. For documentation-only work, use appropriate formatting/link/evidence checks rather than unrelated application tests.
- Follow the changelog and release-note policy below. Documentation or image capture does not authorize committing, pushing, publishing or deploying.

## Changelog and release notes

- Read and follow [the project release-note policy](docs/release-notes-policy.md) before implementing meaningful changes or preparing a release. This policy replaces the earlier requirement to log every edit and capture documentation-only before/after images.
- Maintain `CHANGELOG.md` as the release-note source of truth. Put completed, relevant development changes under `Unreleased`; omit routine formatting, renaming, tests and refactoring without user, integration, compatibility, security or operational impact.
- Confirm the actual implementation and verification evidence. Explain what changed, why it matters, availability conditions and required user action; do not treat a commit message or planned work as proof of a shipped feature.
- Distinguish semantic application versions (`MAJOR.MINOR.PATCH`) from Sites saved-release numbers. Preserve historical Sites entries and dates; never invent a semantic mapping or allocate a hosted release number before publication. Do not bump version files for a documentation-only development update.
- For a real application release, select the highest-impact compatibility change once, update version files through the existing process, move only its completed changes into the dated release entry, and leave a new `Unreleased` section. Publication/deployment requires its own evidence and authorization.
- Use applicable Added, Changed, Deprecated, Removed, Fixed and Security headings. Put breaking changes and actionable migration guidance near the beginning; include material confirmed known issues. Keep related release summaries consistent with `CHANGELOG.md`.
- Capture actual running UI for significant interface changes. Use representative synthetic data and the existing `docs/screenshots/changes/<change-name>/` convention. Compare genuine previous/current implementations with matching viewport, theme, zoom and data; include mobile when affected. New screens may use after-only evidence. Do not fabricate a before state or substitute generated mockups.
- Use descriptive alt text/captions and repository-relative image links. Preserve historical assets. If capture is unavailable, finish the text and disclose the specific missing visual; documentation-only updates do not require product screenshots.
- Before finishing, verify version/date/availability claims, implementation evidence, links/images, migration steps and historical preservation. Report current/proposed version, release status, changed files, actual visuals and verification limits.
