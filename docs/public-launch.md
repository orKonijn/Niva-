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

## Feature evidence and limits

| Area                                                              | Evidence / limitation before final live verification                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Angular, Hebrew RTL, themes, district/category/work-style filters | Existing production implementation; local browser regression suite covers these flows.                                                                                                                                                |
| Public employer jobs                                              | Greenhouse/Lever ingestion and original feed implemented; live provider freshness must be checked after publication. Sample jobs remain explicitly separate.                                                                          |
| Authentication                                                    | Hosted ChatGPT/Sites identity only. Local email/password infrastructure is not a hosted email service. Google, Apple, email verification and password-reset providers remain unavailable in hosted configuration.                     |
| Profiles, preferences, saved jobs                                 | D1 owner-scoped storage implemented. Independent authenticated test accounts are required for live cross-user/cross-device proof. Local mocked tests are not that proof.                                                              |
| AI and resume analysis                                            | Provider key/model not configured. No AI budget approved. Do not advertise simulated AI as live analysis.                                                                                                                             |
| Uploads/private files                                             | Small document persistence is implemented; upload/scanner gate remains off without a configured scanner. R2 is not attached.                                                                                                          |
| Maps                                                              | Leaflet/OpenStreetMap integration; public tile availability is an external dependency. Approximate district locations are not employer office addresses.                                                                              |
| Export/deletion                                                   | Implemented with owner guards; live destructive tests on real users are prohibited. Use independent synthetic accounts only.                                                                                                          |
| Automated submissions                                             | Disabled; no employer application is sent.                                                                                                                                                                                            |
| Scheduler                                                         | No verified unattended scheduler. Worker scheduled handler exists, but no provider cron is attached. A cloud task cannot securely retrieve masked bearer secrets; do not embed them in prompts or call cleanup to simulate a refresh. |
| Backups/monitoring                                                | Health endpoint and platform logs available. Provider backup entitlement, retention, alert routing and a successful isolated restore remain unverified.                                                                               |

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
