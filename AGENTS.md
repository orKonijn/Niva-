# Niva working instructions

## Progress updates and verification

- For every task, explain the intended work in the conversation before starting, then post concise updates as each meaningful step begins or completes. Say what you are doing, what you found and what comes next. Keep the user informed during longer work; do not wait until the final answer to describe the steps.
- Run the complete relevant verification suite once near the end, before the final handoff. Do not run the whole suite after every edit. During implementation, use focused checks only when needed to investigate a specific failure or unresolved risk.
- After final checks pass, repeat or broaden checks only when subsequent code changes, failures or unresolved concerns justify it. For documentation-only work, use appropriate formatting/link/evidence checks rather than unrelated application tests.
- Keep the changelog and genuine before-and-after image requirements below. These rules do not authorize committing, pushing or deploying when the current task prohibits those actions.

## Required change records and images

The user requires every future change to include a changelog entry and before-and-after images.

- Update `CHANGELOG.md` for every change, including fixes, refactors, documentation and configuration changes. Describe the behavior/content changed, verification and remaining limitations. Put unpublished changes under `Unreleased`; assign a Sites release number only after it actually exists.
- Capture the genuine before image before editing, and the after image after verification. Keep the route, viewport, theme, scroll position and test data comparable so the difference is assessable.
- Save paired images under `docs/screenshots/changes/<descriptive-change-name>/before.png` and `after.png`. Link both images from the associated changelog entry and include them in the Git update.
- For desktop/mobile or light/dark changes, capture the affected views. For changes without a visible product difference, capture the relevant actual documentation, configuration or verification view, and explicitly label that the application UI is unchanged.
- Use disposable synthetic data for screenshots. Do not expose resumes, account details, credentials or secrets.
- Never fabricate, retouch or substitute an after image as a before image. If a genuine before image is unavailable, disclose the missing evidence rather than claiming a complete comparison.
- Include a link to the changelog entry and the before-and-after images in the delivery summary. Keep publication and Git synchronization subject to the user's existing instructions; image capture does not authorize a deployment or a sharing change.
