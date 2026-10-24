# Niva working instructions

## Required change records and images

The user requires every future change to include a changelog entry and before-and-after images.

- Update `CHANGELOG.md` for every change, including fixes, refactors, documentation and configuration changes. Describe the behavior/content changed, verification and remaining limitations. Put unpublished changes under `Unreleased`; assign a Sites release number only after it actually exists.
- Capture the genuine before image before editing, and the after image after verification. Keep the route, viewport, theme, scroll position and test data comparable so the difference is assessable.
- Save paired images under `docs/screenshots/changes/<descriptive-change-name>/before.png` and `after.png`. Link both images from the associated changelog entry and include them in the Git update.
- For desktop/mobile or light/dark changes, capture the affected views. For changes without a visible product difference, capture the relevant actual documentation, configuration or verification view, and explicitly label that the application UI is unchanged.
- Use disposable synthetic data for screenshots. Do not expose resumes, account details, credentials or secrets.
- Never fabricate, retouch or substitute an after image as a before image. If a genuine before image is unavailable, disclose the missing evidence rather than claiming a complete comparison.
- Include a link to the changelog entry and the before-and-after images in the delivery summary. Keep publication and Git synchronization subject to the user's existing instructions; image capture does not authorize a deployment or a sharing change.
