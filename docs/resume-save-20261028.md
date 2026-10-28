# Résumé Save validation repair — 28 October 2026

## Confirmed behavior

The old Save button was disabled whenever trimmed résumé text contained fewer than20 characters. The screenshot’s `dddd` input has four. The page supplied no minimum-length hint, counter or actionable explanation, so the form appeared permanently broken. Server résumé creation already enforces20–30,000 characters; that contract remains unchanged.

## Repair

- Keep Save actionable when idle. On submission, reject empty/short text, blank version names, over-limit imported text and unsupported null characters locally; focus the first invalid field and associate its message with the input. Invalid content makes no save request.
- Show the20–30,000 range, clarify edge whitespace and display the current trimmed character count. Existing native maximum-length and required constraints remain.
- Disable only while the operation is busy and show progress. Gateway/network failures retain the complete draft and expose a friendly inline retry message.
- Keep the creation disclosure open after successful saving so its confirmation and review link remain visible. Reviewing or activating a résumé keeps its separate confirmation flow. No auto-approval, activation, employer submission or AI transmission is added.

## Actual UI captures

These screenshots use the same synthetic four-character input, dark theme and project viewport. The before images were captured from the previous running build before rebuilding. All images show the actual application, not generated mockups.

| View    | Before                                                       | After                                                      | Validation after clicking Save                                        |
| ------- | ------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Desktop | [Before](screenshots/changes/resume-save/desktop-before.png) | [After](screenshots/changes/resume-save/desktop-after.png) | [Explanation](screenshots/changes/resume-save/desktop-validation.png) |
| Mobile  | [Before](screenshots/changes/resume-save/mobile-before.png)  | [After](screenshots/changes/resume-save/mobile-after.png)  | [Explanation](screenshots/changes/resume-save/mobile-validation.png)  |

## Validation and release status

The initial focused desktop/mobile checks passed: four characters and19 characters plus edge whitespace were rejected without API calls; a blank name received focus; a20-character draft survived a simulated HTML503, saved after retry and reopened after reload. Both-theme automated accessibility and overflow checks passed. The real local authenticated résumé workflow is included in the final relevant checks recorded below. Browser fixtures use synthetic data; no existing production résumé needs to be edited to validate this repair.

Current published baseline:0.4.3 / Sites51; the concurrent homepage repair is preserved. This compatible fix targets0.4.4; publication is pending until a native receipt is recorded. No schema migration, new provider or configuration change is required. Previous job relevance/eligibility, assistant and layout improvements are preserved.

Final checks passed59 frontend tests,22 career API tests, three type checks, Worker/provenance checks, formatting and production build. All92 relevant browser cases passed across Chromium desktop/mobile, Firefox and WebKit. A final disclosure-state refinement was verified with20 additional passing cases, including continued typing after saving and the real local save → review → activate → reload flow. The unchanged assistant stylesheet still emits its existing5.58kB soft-budget warning; no new build warning was introduced. No whole-product/security certification is claimed.

The concurrently published homepage release0.4.3 / Sites51 was merged before publication. The combined build and28 targeted homepage/save browser cases passed across all four browser projects. No homepage changes were reverted.
