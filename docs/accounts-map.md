# Accounts, persistence and maps

This branch adds a locally runnable account backend and map to the merged Angular application. **It has not been deployed.** The existing Sites URL continues to serve the previous guest demo. This work does not authorize employer submissions, CV upload/processing, AI, paid services or DNS changes.

## Architecture

- Angular 22 retains Hebrew RTL, Tailwind tokens, standalone lazy routes and the existing icon theme switch.
- Better Auth 1.7 handles password hashing, verified email/password accounts (Gmail addresses included), Google/Apple OAuth, state, applicable PKCE/nonce checks, reset tokens, database sessions and encrypted OAuth tokens. It runs exclusively in `server/auth.ts`; provider secrets never enter Angular.
- Hono on Node 24.15+ serves `/api` and the production Angular output from **one origin**. Authentication uses HTTP-only, SameSite=Lax cookies; HTTPS production enables Secure cookies. There is no custom bearer token stored in localStorage.
- Node's built-in SQLite driver provides durable SQL storage without an external database account. This driver is a release candidate in Node 24.15+. The implementation targets a single Node service with a persistent volume, not an ephemeral filesystem or several independent SQLite replicas.
- `AppStore` selects the account or guest store. The existing `DemoStore` and local migration/locking behavior remain separate. Signing out clears the account snapshot, restores guest appearance and prevents late responses from restoring another session's data. Session changes broadcast across tabs; visible accounts refresh on focus and every 30 seconds. Devices synchronize through the same database, not browser storage.
- Account writes carry a revision; SQLite `BEGIN IMMEDIATE` transactions reject stale saves with HTTP 409. Operations update specific fields rather than accepting arbitrary state replacement. Failures are shown explicitly; there is no silent retry that overwrites remote changes.

## Run locally

```sh
npm ci
npm run db:migrate
npm run build
npm run preview
```

Open `http://127.0.0.1:4300`. Without mail/provider configuration the guest mode and map work; unavailable sign-in methods are visibly disabled. A strong development-only secret is generated in ignored `.data/development-secret`; do not use it in production.

To exercise registration **without sending real email**, use PowerShell:

```powershell
$env:NIVA_MAIL_MODE = 'local'
npm run preview
```

Verification and reset messages are written to ignored `.data/outbox/*.json`, readable only by the local operator. Open the link from the relevant local message. There is deliberately no public outbox API or authentication bypass. Local outbox mode refuses production or non-loopback origins.

For real configuration, copy `.env.example` to ignored `.env` and replace placeholders locally. The scripts can load it using `node --env-file=.env --import tsx server/migrate.ts` and `node --env-file=.env --import tsx server/index.ts`. Never paste credentials into chat. Do not commit `.env`, `.data`, outbox files, databases, session cookies or private keys.

For Angular development, run the API at port 4300 with `BETTER_AUTH_URL=http://127.0.0.1:4200`, then run `npm start` in another shell. Angular proxies `/api` to 4300; use the printed `127.0.0.1:4200` origin consistently. Do not mix `localhost` and `127.0.0.1` cookies. The optimized same-origin preview above is the authoritative integration-test setup.

## Server variables

| Variable                                   | Meaning                                                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_URL`                          | Exact public origin, no path or trailing slash; HTTPS required in production                                                |
| `BETTER_AUTH_SECRET`                       | At least 32 random characters, kept in the server secret store; changing it affects sessions/encrypted provider credentials |
| `NIVA_DATA_DIR`                            | Durable private directory containing SQLite and its journal files; default `.data`                                          |
| `HOST`, `PORT`                             | Node listen address and port; default loopback:4300                                                                         |
| `NODE_ENV`                                 | `production` for deployment; never use local developer/test modes there                                                     |
| `SMTP_URL`, `MAIL_FROM`                    | SMTP transport credentials and a verified sender; both required for email/password availability                             |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google web OAuth application, server only                                                                                   |
| `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`   | Apple Services ID and signed client-secret JWT, server only                                                                 |
| `NIVA_MAIL_MODE=local`                     | Optional local-only filesystem outbox; prohibited in production                                                             |

`NIVA_BROWSER_TESTS=1` is a **test runner fixture**, not a production setting. It raises per-IP auth limits to allow parallel local accounts behind one loopback address. It requires `NODE_ENV=test`, the local outbox and a loopback origin; production refuses it. Separate server tests exercise the normal limits (8 sign-ins, 5 registrations and 3 reset/verification sends per minute).

## Google, Apple and email setup

1. **Email:** supply an SMTP transport and verified `MAIL_FROM`. Configure sender SPF/DKIM and appropriate delivery/bounce monitoring with the chosen mail service. No mail service was purchased or configured. Registration requires verification; resetting a password uses an expiring one-use link and revokes existing sessions. Passwords are independent Niva passwords, not Google/Apple passwords.
2. **Google:** use an existing Google Cloud OAuth web client. Configure the consent screen/test users and authorized redirect URI `<BETTER_AUTH_URL>/api/auth/callback/google`; set the client ID and secret server-side. Use a Google-supported local redirect only for development. Real consent, token exchange and delivery must be checked with authorized test accounts.
3. **Apple:** use an existing eligible Apple Developer setup; do not purchase membership for this task. Configure Sign in with Apple on a primary App ID and associated Services ID, verify the chosen HTTPS domain, and register `<BETTER_AUTH_URL>/api/auth/callback/apple` as a return URL. Generate the signed client-secret JWT using the Team ID, Key ID and private `.p8` key according to Apple's/Better Auth's instructions. The `.p8` key stays outside this repository. Rotate the JWT before expiry (Apple's maximum is six months). Apple web callbacks require an approved HTTPS domain rather than the plain loopback preview. Configure the sender domains with Apple's private email relay if sending mail to relay addresses.
4. **Linking:** implicit same-email linking is disabled. A signed-in, verified user explicitly starts the provider's linking flow from settings; the server also requires a session created within the last ten minutes. Different verified provider email addresses are permitted for Apple relay accounts. Linking an external account already owned by another user is constrained by `(providerId, accountId)` uniqueness.

Official references: [Better Auth SQLite](https://better-auth.com/docs/adapters/sqlite), [Hono integration](https://better-auth.com/docs/integrations/hono), [account linking](https://better-auth.com/docs/concepts/users-accounts), [Apple setup](https://better-auth.com/docs/authentication/apple), [rate limiting](https://better-auth.com/docs/concepts/rate-limit).

## Schema, ownership and import

Run `npm run db:migrate` explicitly before serving a new/updated database. `npm run preview` runs that command before starting the local service. No HTTP handler creates or alters tables. Applied migration IDs are recorded in `niva_migrations`; append new migrations for future changes.

- `000_auth.sql`: the checked-in Better Auth user, session, account, verification and rate-limit schema. Users have unique email addresses and sessions have unique tokens; auth tables reference user IDs with cascading deletion.
- `001_account_data.sql`: one state row per authenticated user, with a foreign key, monotonic revision, valid-JSON/array checks, update timestamp and a separate one-time import timestamp. The document contains preferences/exclusions, known saved-job IDs, demo approvals, pause, durable name/headline and theme. Atomic document mutations avoid partial saves.
- `002_auth_constraints.sql`: unique provider/subject ownership and supporting ownership/verification indexes.

Every account operation obtains its owner from Better Auth's server-validated session and requires verified email. No path or request body can select another owner. Caller-supplied ownership is rejected on writes; all reads and SQL predicates use the session's owner. CSRF checks require the exact origin, JSON and a custom header for account writes; Better Auth handles CSRF for its own routes. Body size is bounded. Auth and account operations have database-backed limits. The Node entry point overwrites the internal client-IP header from the actual socket; caller-forwarded identity/IP headers are not trusted.

Before deploying behind a reverse proxy, confirm the chosen network topology and IP policy. The current direct-socket policy safely groups proxied clients together rather than trusting spoofable forwarding headers; production operators must supply a reviewed trusted-proxy adapter or suitable edge limits for correct per-client throttling. Do not casually trust arbitrary `X-Forwarded-For` values.

The explicit import preview normalizes legacy preferences, validates catalog IDs/timestamps, deduplicates jobs/approvals and excludes names, filenames and CV contents. A server HMAC binds the normalized preview to the authenticated user and revision. Confirmation is one-time and transactional; it replaces preferences and merges lists, preserving approval kind `local-demo`. The local copy is retained. Clearing data on the device and deleting saved account data are separate actions. Deleting saved data retains the login identity/methods and the one-time-import marker; this is not full account deletion or a legal erasure claim.

## Map accuracy and provider behavior

Leaflet 1.9 loads lazily only when Map is selected. The list remains available underneath and when tiles/module loading fail. Filters use the same job result set in both views; all known offices of matching jobs are represented. District remains the job's primary district, preserving the existing filtering contract. Grouped city markers prevent stacks of identical coordinates. With four city groups, a separate clustering dependency is unnecessary. The viewport fits initially; later filter changes preserve user position until the explicit Fit action.

All employer/city associations are fictional demonstration data. Every supplied coordinate identifies an approximate city, never employer premises. There are no invented street addresses. The northern sample without a verified city has no coordinates. Fully remote jobs have no fabricated office. The multi-office sample has two clearly labeled city locations. Directions links identify the approximate area and open an external service in a new tab.

City coordinate sources (GeoNames, CC BY 4.0), verified 24 October 2026:

- [Tel Aviv](https://www.geonames.org/293397/tel-aviv.html): 32.08088, 34.78057.
- [Haifa](https://www.geonames.org/294801/haifa.html): 32.81303, 34.99928.
- [Jerusalem](https://www.geonames.org/281184/jerusalem.html): 31.76904, 35.21633.
- [Beersheba](https://www.geonames.org/295530/beersheba.html): 31.25181, 34.79130.

The small local preview uses standard OpenStreetMap raster tiles with visible attribution, standard browser caching/referrer behavior, no prefetch, offline downloads or repeated geocoding. [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/) provides best-effort availability; production requires an operator contact and a tile-service capacity/terms review or an approved alternate provider. No paid map service/key was enabled. Geolocation is never requested or stored.

## Verification and limitations

```sh
npm test
npm run test:server
npm run typecheck:tests
npm run typecheck:server
npm run typecheck:e2e
npm run format:check
npm run build
npm run test:e2e
```

Use `CROSS_BROWSER=1` to add Firefox and WebKit. The Playwright fixture starts a loopback test backend with an ignored local database/outbox; no real emails are sent. Use a fresh `NIVA_DATA_DIR` when a completely empty test database is required. Normal and test schemas are identical.

Server integration tests use real Better Auth hashing, verification/reset handlers, session cookies, SQL authorization, import and revision transactions. Signed Google/Apple JWT and JWKS fixtures exercise real signature/audience/nonce validation, successful account creation, private relay and explicit linking while replacing the provider key-fetch boundary. These are **not live Google/Apple OAuth verification**. Real consent, Apple HTTPS form-post callbacks, provider token exchange and real SMTP delivery remain unverified until authorized credentials/test accounts are configured.

Browser tests cover account creation, local email verification/reset, separate browser sessions, persistence, sign-out isolation, safe protected returns, import preview/confirmation/deletion, theme metadata before Angular, map grouping/filtering, multiple offices, remote/missing locations, tile failure, keyboard access and automated axe checks. Automated map tests serve fixture tiles or simulate failure to avoid bulk traffic against OSM; those map screenshots are UI evidence, not proof of live tile delivery. Manual screen-reader, real-device, production proxy/TLS and backup/restore audits remain outstanding.

## Deployment requirements

### Recorded local verification — 24 October 2026

- Frontend unit tests: **38 passed**; server integration tests: **13 passed**.
- Full browser suite: **128 passed** across desktop/mobile Chromium, Firefox and WebKit. After the final popup sizing, theme and linking-error refinements, the **32 account/map cases passed again** across all four configurations, including popup bounds on mobile.
- Test, server and browser TypeScript checks, formatting check, production build and `git diff --check`: passed. Initial production bundle is approximately 379 kB raw / 96 kB estimated transfer; Leaflet is a separate lazy chunk.
- Manual in-app browser check confirmed live OSM tile delivery, marker selection and dark popup rendering on the local preview. This verifies local map rendering only, not production availability, provider OAuth or SMTP.

Screenshots use disposable test accounts. Automated map screenshots use fixture tiles, as explained above:

| View                      | Desktop                                                    | Mobile                                                    |
| ------------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| Sign-in                   | [Screenshot](screenshots/accounts-map/sign-in-desktop.png) | [Screenshot](screenshots/accounts-map/sign-in-mobile.png) |
| Account settings          | [Screenshot](screenshots/accounts-map/account-desktop.png) | [Screenshot](screenshots/accounts-map/account-mobile.png) |
| Map UI with fixture tiles | [Screenshot](screenshots/accounts-map/map-desktop.png)     | [Screenshot](screenshots/accounts-map/map-mobile.png)     |

[Manual dark-mode map with live OSM tiles](screenshots/accounts-map/map-live-desktop.png).

### Hosting and external configuration

**No deployment, DNS change or paid provisioning was performed.** The tracked `.openai/hosting.json` still describes the existing static Sites demo and cannot run this Node/SQLite backend. Deploying this branch through that static manifest alone would leave account methods unavailable.

To publish accounts, first authorize a host/runtime choice: either a same-origin Node 24 service with a persistent private volume, TLS, secret management, encrypted backups and tested restoration; or a separately implemented/reviewed Cloudflare D1 adapter and Worker entry point for the existing Sites host. The latter is not claimed to be implemented. Supply verified SMTP and OAuth configurations only through the chosen server secret store. Set the exact HTTPS origin/callbacks, apply migrations, verify proxy/rate-limit behavior, test secure cookies and CSRF under HTTPS, verify real Google/Apple/email flows with test accounts, establish retention/deletion policy and approve deployment as the final step. No backend, credentials or database should be exposed publicly during that setup.
