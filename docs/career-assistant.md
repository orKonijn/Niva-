# Career assistant extension — local implementation and handoff

## Current scope — 26 October 2026

Latest publication: **application0.1.3 / Sites39**. [Publication/live receipt](verification/publication-20261026-v39.json). The earlier milestones below remain historical. Selected global discovery includes 24 core employer/Jobicy sources plus two configuration-gated JSearch publisher feeds. JSearch provides partial daily LinkedIn/Indeed samples, not exhaustive live searches. PDF/DOCX text extraction works in the browser; original files stay on device on this path. Reviewed text is saved privately for 30 days. Server upload scanning, AI and email remain configuration-gated/inactive; they are distinct from local parsing. The enabled hourly public-source refresh is not evidence of private retention cleanup. Two recurring private cleanup cycles, an accountable operator, approved alert delivery, independent hosted identity isolation and backup restoration remain unverified. See [current status](current-status.md) and the [local repair report and staging procedure](review-repairs-20261026.md).

## Historical implementation and prepared procedures

The milestone-specific counts, publication numbers and observations below retain their original dates and scope. Current status above supersedes conflicting capability/deployment summaries; prepared procedures do not establish successful hosted execution.

> Current scope and deployment truth: [current-status.md](current-status.md). This guide includes historical milestone evidence. The 24 October review repairs are local only and have not been pushed or deployed.

The implementation was verified locally and publication was subsequently authorized. Existing Sites identity, Site ID, audience, account preferences, saved jobs, approval history, employer exclusions, themes and maps are retained. No paid plan, provider key, scanner or scheduler was activated by publication.

## Try it

Use Node 24.15+, run `npm ci` only if dependencies are missing, then `npm run db:migrate`, `npm run build` and `npm run preview`. The local server serves Angular and authenticated APIs at `http://127.0.0.1:4300`. `.env.example` documents server configuration. Node/tsx does not automatically load `.env`; export variables in your shell or use your process manager's environment support. For a local test account set `NIVA_MAIL_MODE=local`; verification links are written to the private `.data/outbox` directory instead of being emailed. Production uses configured SMTP or the existing Sites identity adapter.

1. **Jobs** `/app/jobs`: refresh, load subsequent cursor pages, inspect source health, filter, switch list/map, and expand the match indicator. The map and list use the same loaded results. Totals count database matches; the current page count counts loaded records. Refresh retains the visible list until a successful response, requests up to the previously loaded count (bounded at 50), and replaces it with the current snapshot. Additional pages merge by ID. Filter changes cancel old requests and stale results are ignored. New/changed snapshots are checked every 60 seconds while the jobs page is mounted. The notice requests explicit refresh rather than moving the user's list unexpectedly.
2. **Resumes** `/app/resumes`: paste text, save a draft, correct it and confirm the facts. Then explicitly make a confirmed version active. Editing creates a new version. Choose “tailor” from a job card/detail, select a confirmed resume, and create a draft. Review the original and the unchanged text and relevant evidence side by side, edit, accept or delete the draft, and download text. Rejecting/deleting a draft does not replace the original or active version.
3. **Assistant** `/app/assistant`, or open it from a job card/detail: the built-in guide searches the real catalog and provides fixed, clearly labelled requirements, résumé-evidence and interview guidance. Select the task card and enter a role/company for search. It works without an AI provider and does not send data to OpenAI. Job-specific actions require opening the assistant from a listing. An active confirmed résumé is used only after a separate checkbox opt-in. Conversations can be reopened and deleted. Free-form Hebrew/English AI conversations remain available only with configured provider credentials and processing consent; the guide is not represented as generated AI. Switching modes starts a separate conversation. See [repair notes and current availability](assistant-repair-20261028.md).
4. **Account** `/account`: export career records as JSON or delete all account data, including resumes, conversations and cached scores. Resume-specific TXT/original-file downloads and individual deletions are available in the resume workspace. Legacy device-only CV selection stays separate from the authenticated resume workflow.

## Actual sources and freshness

| Source                                                   | Scope                      | Credentials         | Minimum interval | Capabilities                                                                                      |
| -------------------------------------------------------- | -------------------------- | ------------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| [AppsFlyer / Greenhouse](https://careers.appsflyer.com/) | Explicit Herzliya postings | None for public GET | 10 min           | Description, original employer URL, provider ID, updated time; style unknown                      |
| [WalkMe / Lever](https://jobs.lever.co/walkme)           | Explicit Israeli locations | None for public GET | 15 min           | Description, hosted original listing, provider ID, creation time and workplace type when supplied |

Adapters use the documented [Greenhouse Job Board API](https://docs.greenhouse.io/job-board) and [Lever public Postings API](https://github.com/lever/postings-api). No login bypass, scraping of restricted pages or application submission endpoint is used. API documentation is a public-access integration basis, not a blanket license for every board or future use. Recheck provider and employer terms before expanding redistribution or adding boards. Attribution and original links remain visible. Third-party sources have not entered a separate commercial agreement with Niva.

The bounded integration check on 2026-10-24 fetched **22 AppsFlyer + 6 WalkMe Israeli vacancies**, with both endpoints successful. Exact timestamp, category coverage and endpoint evidence: [verification/career-sources.json](verification/career-sources.json). This is a point-in-time result, not a guarantee of ongoing vacancy counts. Current boards do not guarantee QA, automation, every district, or Israel-eligible remote openings. Foreign remote listings are excluded; remote never implies worldwide eligibility. Unknown locations/styles are retained as unknown and do not satisfy a specific hard filter. Only existing verified AppsFlyer city coordinates are mapped; no coordinates are invented for WalkMe.

`niva_jobs` stores source IDs, canonical URL, normalized filter fields, availability, version and full normalized data. Composite/filter and source indexes support filtered SQL keyset pagination. Canonical URLs and conservative employer/title/district/style identity deduplicate listings, retaining attribution. Successful full snapshots reconcile edits/removals; failed or incomplete fetches retain the last successful data. Closed listings remain available to their existing savers. Saved-history view intentionally permits jobs outside current preferences, labels this, and still applies employer exclusions and screen filters. It never makes those listings eligible for recommendations.

Refresh reads Niva's database; it does not refetch upstream sources. Only first bootstrap of an empty source table may fetch due sources. Ingestion uses atomic source leases, per-source next-run timestamps, 12-second timeouts, a 4 MB response bound, max 1,000 Greenhouse rows and at most 99 Lever rows (a full 100-row page fails closed as incomplete), duplicate-ID merging, exponential backoff up to six hours, and bounded Retry-After handling. Failed sources expose health without hiding successful sources. Cursor HMACs bind the query, preferences and database snapshot; changed snapshots/filters return 409 and request refresh. Pagination uses a stable ID key, not provider offset pagination.

### Scheduling

The Node server runs a background timer every minute by default outside browser tests; only due sources are contacted. Set `NIVA_SCHEDULE_INGESTION=0` to disable. Multiple processes share durable leases. Worker code exports `scheduled()` for a configured Cloudflare trigger and exposes a protected `POST /api/ingestion/run` for an external scheduler. The hosting manifest/audience was not changed. **No hosted schedule is active for this local change**; do not describe it as continuously updating production until a supported scheduler is connected and observed. No provider webhook is configured; these public board APIs use snapshots.

For a Sites operator, connect an approved scheduler every five minutes to `POST https://YOUR-SITE/api/ingestion/run` with `Authorization: Bearer YOUR_SERVER_ONLY_INGEST_SECRET`, empty JSON body and no personal data. Store the same random secret (32+ characters) server-side as `NIVA_INGEST_SECRET`. Use the hosting platform's supported unattended execution/secret storage. Do not put the bearer in a URL, browser, checked-in workflow or log. An external scheduler need only trigger due checks; 10/15 minute source limits are enforced in the DB. Verify successive `checked_at` values after activation. No scheduler has been provisioned or purchased here.

## AI architecture and setup

The server uses [OpenAI Responses streaming](https://developers.openai.com/api/docs/guides/streaming-responses). No browser key or direct browser provider connection is used. Configuration is optional and server-only:

```dotenv
OPENAI_API_KEY=YOUR_EXISTING_SERVER_ONLY_API_KEY
NIVA_AI_MODEL=YOUR_ACCOUNT_ENABLED_RESPONSES_MODEL
NIVA_INGEST_SECRET=YOUR_RANDOM_32_PLUS_CHARACTER_SERVER_SECRET
NIVA_SCHEDULE_INGESTION=1
```

Select a model your account already supports and apply a provider project spending cap. No model, paid service or plan is silently activated. Provider requests are unverified without credentials; test responses use explicitly named mocks.

Read tools are server-controlled functions: current authenticated account state, filtered active job discovery, selected listing lookup, optional active confirmed resume, and deterministic evidence matching. They resolve owners from verified sessions/Sites headers. Client-supplied profile/job objects are ignored. Skill terms in the question rank a bounded eight-job context; a selected active job may also be included and is labeled if it conflicts with preferences. This is bounded database retrieval, not comprehensive semantic search or model-selected arbitrary SQL. The model has no mutation, application, file-upload or external HTTP tools. Preference/profile suggestions lead to existing review-and-save forms; a chat response cannot commit them.

Resume/job/profile data are untrusted JSON under separate assistant instructions. They cannot authorize changes or disclose other accounts. Transcript text is rendered as text (no HTML/Markdown execution or model-generated clickable URLs); listing links are constructed only from server-verified IDs. Actual model compliance, Hebrew quality and resistance to adversarial descriptions still require a configured-provider evaluation. Grounding reduces hallucination risk; it is not a formal guarantee about every sentence the model could produce.

SSE handles chunk boundaries, errors/incomplete responses, 45-second upstream cancellation, browser stop and retry. Only completed answers are saved. A per-owner lease prevents overlapping AI requests; deleting a conversation during a response cannot recreate it. Conversation context is bounded to ten exchanges. Limits: 20 conversations/user, 20 AI requests/user/day, 100 AI requests globally/day, max 2,000 input message characters and 1,200 generated tokens/request. Provider `store:false` is set. This does not override provider abuse-monitoring retention or contractual policies. No CV/chat content is logged by the application.

## Resume storage, safety and tailoring

Resumes, chat and match caches are owner-scoped rows in SQLite locally and D1 in the Worker. They are not static assets or public object URLs. Local database permissions remain 0600, with existing server authentication and CSRF enforcement. Every resume/chat/score read/write/export/delete resolves the authenticated owner; a guessed ID from another account returns 404. Candidate details are never used to rank by protected characteristics.

Text paste needs no file parser or external processor. Originals and each derived/edit version are distinct immutable-content records after confirmation. Confirmed resume text is the candidate-reviewed profile evidence; extracting structured employment history into the main account profile is not implemented. No automatic profile replacement occurs.

File upload is **disabled until a real scanning/parsing integration is configured**. Native PDF/DOCX parsing and a malware engine are not bundled. Configuration:

```dotenv
NIVA_RESUME_PROCESSOR_URL=https://YOUR_APPROVED_PRIVATE_PROCESSOR/scan-and-extract
NIVA_RESUME_PROCESSOR_KEY=YOUR_SERVER_ONLY_SERVICE_TOKEN
NIVA_RESUME_PROCESSOR_NAME=ACTUAL_PROVIDER_AND_SERVICE_NAME
```

The endpoint is operator-controlled HTTPS, with redirects disallowed. Browser input cannot select it. The UI names the recipient and requires explicit consent before transfer. Ensure its legal/data-processing terms and retention policy are acceptable; this integration has **not** been configured or exercised against a real processor.

Processor contract: accept POST JSON `{name,mime,base64,maxPages:20,maxCharacters:30000,maxExpandedBytes:5000000}` with bearer authentication. In a sandbox, verify the true type, reject encrypted/malformed files, embedded payloads and zip bombs, scan using an updated malware engine, and perform bounded extraction with no network/file execution. Return `{scan:"clean",text:"...",pages:1,truncated:false}` only after successful scanning and parsing. Any unsafe/unknown scan status, timeout, non-2xx response, >20 pages, truncation or invalid text is rejected. Do not log content, retain a provider copy, or treat a clean scan as permission to execute document content. A successful mock is not evidence that any deployed processor meets these obligations.

Niva validates extension, MIME, PDF/ZIP magic, base64 and a 750,000-byte limit server-side before processing. JSON bodies are bounded at 1.1 MB; other account APIs remain 32 KB. Parsing results are limited to 30,000 characters. Raw bytes are stored only after clean bounded processing and can be exported through a private attachment endpoint. No original file content is included in list responses. Limits: 10 resume creations/day, 20 stored versions/user, 10 tailoring operations/day. Expensive file parsing belongs to the isolated processor; the Worker does not decompress or execute documents.

Current tailoring preserves the exact source text and ordering because blank lines cannot reliably establish employment-section boundaries. It highlights inspectable positive snippets relevant to the selected job without moving achievements between employers or adding facts. It is not a generative resume rewrite. Optional consented AI wording assistance remains separately gated. A tailored draft never activates automatically; review and activation are separate confirmations. TXT UTF-8 exports are selectable text. Designed PDF/DOCX output, OCR and an ATS guarantee are not provided.

Each record expires after 30 days from creation; subsequent edits create new records with their own expiry. Expired records are inaccessible immediately and physically removed on the next ingestion cleanup. An inactive/disabled scheduler delays physical cleanup, so production operations must monitor it. Deleting a resume version removes that version, all owner match caches and conversations that could include its content; separately created derived versions remain until explicitly deleted. The UI explains this before deletion. Deleting all account data removes all career records. Normal hosting backups and external provider retention are outside application deletion; define production backup retention before processing sensitive documents.

## Match methodology

`evidence-v1` has two separate indicators:

- **Preferences:** role, district and OR-selected work styles are ANDed with employer exclusions and availability. Each specified factor is match/conflict/unknown; no selected factors means “not enough information.” Unknown work style cannot satisfy a specific work-style preference. Hard exclusion always blocks recommendations. Seniority, work authorization and education have no confirmed structured inputs yet and are explicitly described as unassessed.
- **Resume evidence:** a small published bilingual dictionary in `src/app/core/matching.ts` recognizes terminology in the job's title/description and the active confirmed resume. Manual QA, QA automation and workflow automation are separate. The result is a count of shared terms, not an AI number, expertise determination, qualification audit or hiring probability. Clear negative statements are suppressed conservatively. Fewer than two recognized job terms or no confirmed resume gives “not enough information.” Missing evidence is not confirmed lack of experience. The model does not infer demographics.

Example: a job mentions Python, SQL and QA Automation. A confirmed resume mentioning Python and SQL shows **2 of 3 terms**, strengths Python/SQL and missing evidence for QA Automation. Manual QA alone does not establish QA Automation. A workflow/n8n resume does not satisfy QA Automation. An excluded employer remains excluded regardless of shared terms.

No 0–100 hiring score is shown. Relevance sorting orders comparable **loaded results only** by shared/recognized-term ratio, with unknown results last; this is explicitly labeled. It is not a global relevance order of unrequested pages. Dates, negation, must-have/preferred distinctions, synonyms outside the dictionary, transferable skills and experience depth remain limitations. Existing exact/synonym terminology is inspectable; semantic equivalence is not assumed.

Server score cache keys bind methodology, current job version, current preferences and immutable resume ID/text. Relevant input changes create a different key. Scores identify the resume/job versions; no all-jobs-by-all-resumes AI matrix is computed. Card indicators use the same deterministic function locally on authorized current data. Match cache misses are capped at 300/user/day.

## Verification and operational handoff

New unit/server tests exercise multi-source normalization, cursor tampering/invalidation, OR/AND groups, refresh without upstream fetch, deduplication, backoff, closures, saved history, account isolation, CSRF, scanner refusal/unsafe/oversized/unparseable input, original-byte privacy, versioning, exports/deletion, factual paragraph preservation, missing evidence, hard exclusions, cache invalidation, provider consent, bounded grounded context and incomplete-stream failure recovery.

Browser tests cover feed controls, filters, list/map consistency, stale requests, comparison, explicit confirmation, missing integrations, mixed Hebrew/English chat, keyboard retry, stop and both themes with axe checks at desktop/mobile sizes. Existing account/map/theme/onboarding journeys remain in the suite. New screenshots use **labeled fixtures and mocked AI/scanning boundaries**; they do not claim a real model or scanner was verified:

- [Feed controls and job cards](screenshots/career/feed-desktop.png)
- [Chat](screenshots/career/chat-desktop.png)
- [Resume comparison](screenshots/career/comparison-desktop.png)
- [Mobile comparison](screenshots/career/comparison-mobile.png)

Run `npm test`, `npm run test:server`, all three `typecheck:*` commands, `npm run format:check`, `npm run build`, and `CROSS_BROWSER=1 npm run test:e2e` (set the environment appropriately in PowerShell). `npx tsx scripts/verify-career-sources.ts` performs an explicit bounded real-provider check and updates evidence without touching live account data.

Remaining activation work: supply an already authorized AI project/model with a spending cap; provision/audit the isolated scanner/parser and its retention contract; configure and observe the hosted scheduler; apply the additive D1 migration and deploy only when separately authorized. Then run real provider quality/injection/cancellation evaluations and test scanning with a controlled safety corpus. Broad employer coverage, semantic ranking, structured experience extraction, general-purpose generative tailoring and PDF/DOCX export are follow-up work, not claimed complete.

Operational costs are model token usage plus storage/Worker/ingestion and scanning-provider usage, depending on configured plans and volume. Current code sets request/character/token/source limits but no dollar estimate is valid without the chosen model/processor prices. No services were bought and no paid plans were changed.

### Recorded results

The final verification passed 42 frontend unit tests, 31 server tests, and the complete 184-case Chromium desktop/mobile, Firefox and WebKit browser suite. After the last avatar/theme-transition contrast repair, 48 affected feed/card/chat/resume/CSP browser checks passed again, including both-theme axe checks. Server/test/e2e type checking, formatting, whitespace checks and production build passed. The real local account browser journey verifies resume review, activation, reload persistence and account-data deletion through the actual Node/SQLite backend. D1 adapter tests exercise the same operations using the existing SQLite-backed D1 test harness. See [career-checks.json](verification/career-checks.json). Browser screenshots are fixtures as described above; real AI/scanning and a hosted schedule remain unverified.

Historical hosted snapshots are copied by a bounded, idempotent ingestion operation (up to 1,000 legacy records). Hosted schema migrations contain schema changes only.
