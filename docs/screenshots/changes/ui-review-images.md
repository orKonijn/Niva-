# UI/UX review repairs — genuine before/after evidence

25 October 2026. Baseline `24d9d2e67168708bb9f82be2ea74ac4e1ad36815`; after images show the local uncommitted repair, not a new hosted release. Actual browser captures with synthetic data. Original review evidence under `output/niva-ui-review-20261025` is preserved. Focus outlines are intentional keyboard/route focus states. Screenshots are supporting evidence; the linked verification record distinguishes behavioral tests, viewport reflow, unavailable native zoom and unverified spoken screen-reader output.

Pairs retain route, viewport, theme and fixture data; natural content reflow changes page height. The delete pair preserves the short mobile viewport: before shows the trigger while its confirmation lies below the view, after shows the focused modal. The status pair renders actual repository documentation; it is not product UI.

- **assistant-context**: [Before](ui-review-assistant-context/before.png) · [After](ui-review-assistant-context/after.png)
- **auth-errors**: [Before](ui-review-auth-errors/before.png) · [After](ui-review-auth-errors/after.png)
- **delete-confirmation**: [Before](ui-review-delete-confirmation/before.png) · [After](ui-review-delete-confirmation/after.png)
- **detail-error**: [Before](ui-review-detail-error/before.png) · [After](ui-review-detail-error/after.png)
- **onboarding-dark**: [Before](ui-review-onboarding-dark/before.png) · [After](ui-review-onboarding-dark/after.png)
- **onboarding-light**: [Before](ui-review-onboarding-light/before.png) · [After](ui-review-onboarding-light/after.png)
- **overflow-1440-dark**: [Before](ui-review-overflow-1440-dark/before.png) · [After](ui-review-overflow-1440-dark/after.png)
- **overflow-1440-light**: [Before](ui-review-overflow-1440-light/before.png) · [After](ui-review-overflow-1440-light/after.png)
- **overflow-390-dark**: [Before](ui-review-overflow-390-dark/before.png) · [After](ui-review-overflow-390-dark/after.png)
- **overflow-390-light**: [Before](ui-review-overflow-390-light/before.png) · [After](ui-review-overflow-390-light/after.png)
- **resume-context**: [Before](ui-review-resume-context/before.png) · [After](ui-review-resume-context/after.png)
- **returning-desktop**: [Before](ui-review-returning-desktop/before.png) · [After](ui-review-returning-desktop/after.png)
- **returning-mobile**: [Before](ui-review-returning-mobile/before.png) · [After](ui-review-returning-mobile/after.png)
- **status**: [Before](ui-review-status/before.png) · [After](ui-review-status/after.png)

[Implementation report](../../ui-review-repairs-20261025.md) · [Verification record](../../verification/ui-review-fixes-20261025.json)
