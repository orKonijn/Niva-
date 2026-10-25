# Public launch — 25 October 2026

## Domain and costs

`getnivajobs.com` was approved for one year at Porkbun, capped at US$11.08 with no paid add-ons. The registrar account shows registration through **2027-10-25**. Automatic renewal was initially enabled; it was disabled and the account now explicitly shows **Auto renew is off**. The quoted renewal price was US$11.08/year, not a guaranteed future price. No domain renewal or new recurring service was approved. Manual renewal requires a later decision before expiration. The final payment receipt remains in the owner's registrar account; registration is verified, the charged amount is not independently audited.

Hosting reuses the existing Sites project, Worker API, and D1 database. No new hosting plan, AI plan, storage subscription, email provider or scanner was purchased. Existing hosting/account limits and billing still apply; a zero lifetime hosting cost is not promised.

Targeted DNS changes preserve nameservers, MX forwarding, SPF, ACME challenges and unrelated wildcard records. Root A records point to `162.159.143.30` and `172.66.3.26`; `www` CNAME points to `custom-domains.chatgpt.site`. Both hostnames have Sites ownership TXT challenges. Sites reports both hostname and SSL status active. Certificates are managed by the hosting provider; certificate renewal is separate from domain registration renewal.

Canonical configuration uses `https://getnivajobs.com`; only the explicitly configured `www.getnivajobs.com` alias redirects. API requests, authentication callbacks and writes do not redirect across origins. The previous Sites URL remains available for compatibility. Production readback is recorded separately after publication.

## Changes

- Add a read-only `/healthz` database/schema/configuration probe. Return minimal availability information, never credentials or private data.
- Serve assets and the application shell even when the database/API configuration fails, allowing the existing recovery UI to load.
- Add explicit HTTPS canonical configuration, public-page canonical/robots metadata, a four-page sitemap, private-route indexing controls, HSTS and cache policies. Unconfigured deployments default to no indexing. Indexing never grants access to private data.
- Add protected `POST /api/ingestion/refresh`, which refreshes public job sources without running retention cleanup. It reports source failures rather than claiming unconditional success. Keep cleanup and combined maintenance separate.
- Store a new ingestion bearer secret in the hosting secret manager, preserving the existing import secret. No secret belongs in Git, screenshots, browser bundles or schedule prompts.

## Live verification and feature status

Published as **Sites version20** on 25 October 2026. GitHub source: `4a089edbb994750966d3ef46a61d0bd236cf9b0d`; Sites source: `057bd6a2d5eba554edf234c26e464104073a4045`. [Deployment receipt](verification/publication-20261025-v20.json). The later release-record commit changes documentation only.

The public URL is [https://getnivajobs.com](https://getnivajobs.com). DNS resolves, certificate validation succeeds (Google Trust Services, observed certificate expires 23 January 2027), and the provider manages TLS renewal. HTTP upgrades to HTTPS; HTTPS www redirects with 308 to the apex, retaining path/query. Initial requests immediately after the access change returned the former platform sign-in gate; the final readback passes anonymous application access. No security bypass is used.

| Feature                                    | Status                                  | Evidence / remaining limitation                                                                                                                                                                                                      |
| ------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public hosting, backend and database       | Live and verified                       | Public pages, direct nested routes, database/schema health, correct clean build mapping, gzip, cache/security headers, robots and four-page sitemap.                                                                                 |
| Public employer jobs                       | Live and verified                       | Both Greenhouse/Lever sources refreshed successfully without private cleanup; 27 combined jobs. Public pagination, district/category and OR work-style filters and original listing links checked. Coverage is two employers only.   |
| Maps and themes                            | Live and verified within observed scope | Actual public map renders an approximate-area marker and accessible list; dark selection survives reload. Broader desktop/mobile/Firefox/WebKit and light/dark checks are local browser evidence, not physical devices.              |
| Anonymous private-data boundary            | Live and verified                       | Account state/career snapshot reject anonymous reads; spoofed caller identity stays anonymous. This is not proof of cross-user isolation between two completed sessions.                                                             |
| ChatGPT/Sites authentication               | Unverified completed session            | Correct HTTPS custom-domain callback reaches OpenAI account chooser. Interactive dedicated test-account sign-in is pending. Email/password, verification/reset delivery, Google and Apple are blocked until configured and approved. |
| Profiles, preferences, saves, cross-device | Unverified live account journeys        | Owner-scoped D1 implementation and local regressions pass; independent dedicated authenticated accounts are still required.                                                                                                          |
| Sample catalog/approval history            | Demo-only                               | Explicitly separate from the normal source flow; no employer submission occurs.                                                                                                                                                      |
| AI chat, resume analysis                   | Blocked                                 | No OpenAI key/model or approved AI budget. Enable OpenAI Developers for secure provider setup; never send API keys in chat. Deterministic terminology matching is not an AI hiring assessment.                                       |
| Uploads/private files                      | Blocked upload/scanning                 | Small document persistence exists; scanner/upload gate is off, R2 is not attached. Do not upload sensitive resumes while operational gates remain unverified.                                                                        |
| Export/deletion                            | Unverified live destructive journey     | Owner guards and synthetic local tests pass. No real user's data was deleted for verification.                                                                                                                                       |
| Scheduled ingestion/retention              | Blocked                                 | No provider cron or securely authenticated unattended writer is connected. Worker handler code is not proof of an active schedule. No secret is embedded in a scheduled prompt.                                                      |
| Backups, restore and alerting              | Unverified / not configured             | Read-only health and platform logs work. Backup entitlement, retention, isolated restore and external alert routing are not verified.                                                                                                |
| Automated applications                     | Unavailable                             | No employer application is sent.                                                                                                                                                                                                     |

Verification: **59 frontend, 90 server, 1 provenance, 280 browser checks** passed; server/test/e2e type checks, formatting and Angular/Worker production build passed. The initial formatting check flagged the new changelog entry, which was formatted and rechecked. Local account/email/provider fixtures are not evidence of hosted OAuth, SMTP, AI or scanner operation.

Evidence: [HTTP/TLS, identity boundary and metadata](verification/public-launch-live-20261025.json), [source-only refresh](verification/public-launch-source-refresh-20261025.json), [live filters/pagination/listing](verification/public-launch-feed-20261025.json), [public job screen](screenshots/changes/public-launch-policy/live-public-jobs.png), [live dark map](screenshots/changes/public-launch-policy/live-dark-map.png). No real employer applications or private cleanup were performed.

## Trying the site

Open the public URL, browse real jobs, use filters/map and inspect original employer links. To save jobs and preferences, use the offered ChatGPT sign-in, return to Niva, save a job, then refresh and revisit saved jobs. Hosted Google/Apple/email registration is not connected. Do not provide a resume until the upload/scanning capability is available. AI controls must explain their unavailable state.

## Maintenance and rollback

1. Use Sites environment-variable tools for secrets. Preserve existing entries; rotate the ingestion secret only with the operator/client updated securely. Never commit `.env` or put bearer tokens in scheduled prompts.
2. Check `GET /healthz`, public feed timestamps, source health, platform logs and deployment metadata after releases. A healthy schema probe is not proof of every external integration.
3. Refresh only public job sources through `/api/ingestion/refresh` using the operator secret. A failure is actionable; do not conceal it with sample data. Cleanup endpoints may delete expired private records and need an approved maintenance process.
4. Set up provider-native scheduling and alerts once the provider offers an authenticated unattended writer and its cost is known. Verify execution and readback. Do not mark a cron active based on handler code alone.
5. Before schema/destructive changes, verify provider-native D1 backups and restore into an isolated database. Record the recovery point, encrypted access, retention and restore result. Do not test restore over production.
6. Roll back by deploying the previous known-good saved Sites version. Keep schema changes backward compatible; code rollback does not undo data migrations. Preserve the custom domain and runtime secrets. For accidental public data exposure, restore the previous owner-only audience immediately and investigate.
7. Review registrar expiration before October 2027. Auto-renew is intentionally **off**. Future domain renewal requires approval; managed TLS renewal does not renew the domain.

Genuine non-UI source evidence: [before](screenshots/changes/public-launch-policy/before.png), [after](screenshots/changes/public-launch-policy/after.png). The application design is unchanged. These images show actual source/configuration, not proof of live integrations. Registrar and production evidence is separate.
