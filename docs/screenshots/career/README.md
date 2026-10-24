# Career extension screenshot evidence

These desktop, mobile, Firefox and WebKit screenshots come from the reproducible browser tests in `tests/career.spec.ts`. Listings, resumes, account identity and AI responses are **explicit test fixtures**, not verified model outputs or real candidate records. Job-card titles and chat answers identify this in Hebrew. The feed view also intentionally includes a partial source failure.

`feed-*.png` shows refresh, pagination, counts, filters, shared list/map controls and job cards with match explanations. `chat-*.png` shows Hebrew/English content, consent and database-built listing references. `comparison-*.png` shows immutable source paragraphs next to an editable tailored draft, with separate fact confirmation and activation.

Actual external source verification is recorded separately in `../../verification/career-sources.json`. AI and scanning integrations remain unconfigured/unverified; see `../../career-assistant.md`.
