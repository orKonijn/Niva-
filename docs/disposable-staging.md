# Disposable staging and operations preparation

Prepared26 October2026. Local Node/SQLite only. No separate hosted staging origin, D1 database, verified hosted test identities, accountable operator or approved alert receiver is available. At preparation, the existing Sites project had production0.2.1 / Sites41 and no preview URL. Later publication of0.3.1 / Sites43 does not provide a separate staging origin. All Sites deployment tools target production. None was called during local staging preparation; later application publication was separately authorized. A local test cannot close the hosted gates.

## Prepare and access the local environment

From the repository with Node24 and installed dependencies:

```sh
npm run build
npx tsx scripts/prepare-disposable-staging.mts --prepare
npx tsx scripts/local-staging.mts --serve
```

In a second terminal on first preparation only:

```sh
npx tsx scripts/invite-disposable-staging.mts --local-only
npx playwright test --config=playwright.staging.config.ts
npx tsx scripts/staging-retention-drill.mts --local-only
```

Open `http://127.0.0.1:4310/login`. Two disposable accounts are prepared: `alice.staging42@example.test` and `bob.staging42@example.test`. Credentials are random, never printed and stored only in the ignored local `.test-data/staging42/private-test-access.json`. Do not publish that file or the local mail outbox. For password-free handoff, use **Forgot password** with either synthetic address and open its one-time reset link from the local-only `.test-data/staging42/outbox/` on this device. Links expire according to the authentication provider. No email is sent externally. Reset links and passwords must not be pasted into chat or reports. The standalone local environment is not exposed to the network.

Preparation seeds pinned public vacancy fixtures; it does not claim a new employer check or live provider integration. JSearch, AI, remote scanning, SMTP, external alerts and automatic source ingestion are disabled by `local-staging.mts`. Sign-up, email verification, sessions, profile state, reviewed résumé text and saves use the actual local authentication and persistence code, without mocked account routes. File bytes are parsed on-device; reviewed text alone is persisted. The journey resets **only these explicitly disposable local accounts** on reruns.

The retention drill uses a distinct synthetic probe owner, two actual timer deliveries at an accelerated1.1-second cadence, expired-read denial, physical deletion, active-pointer clearing and a separate SQLite backup target. It never restores into the running database. This proves local behavior, not Cloudflare scheduled delivery, D1 or the60-minute hosted bound. Failure detection is exercised with an injected disabled receiver; no real alert is sent.

## Hosted staging dependency

Before hosted write validation, provision a separately identified non-production origin and database with production host/database excluded, approved test-only identity registrations, an inventory of direct/alternate origins, and secret configuration through the hosting/provider UI. Use two independent invitations or separate sign-ins into that **staging origin**, never production accounts. The current hosting connector exposes production deployment operations, not a staging slot. No new Site or production deployment was created as a workaround. Supply the approved staging platform/account and separate URL before these checks can run there.

Repeat the first-time journey, separate-session preference/saved-state tests, cross-owner résumé export denial and303 vacancy handoff against hosted staging. Confirm the exact source commit and actual D1 binding. The local password/outbox setup must not be enabled on a public host. Real OAuth/provider redirect and hosting identity stripping remain unverified by local sessions.

## Operator responsibilities

**Unassigned.** The owner must appoint and obtain acceptance from an accountable operator and backup. Responsibilities: maintain independent five-minute health checks; review failed sources separately from cleanup; monitor the60-minute cleanup bound; acknowledge alerts and investigate failures; protect/rotate runtime secrets; verify erasure replay during restores; document backup expiry, recovery objectives and incident ownership. Suggested acknowledgement targets require owner approval and are not commitments established by this task.

## Proposed alert receiver

An organization-owned HTTPS webhook relay feeding a **self-hosted ntfy server with a private topic and deny-by-default access** is suitable for the existing metadata-only watchdog. It is a proposal, not an installed service or approved destination. Official setup references: [ntfy publishing](https://docs.ntfy.sh/publish/), [access control configuration](https://docs.ntfy.sh/config/#access-control) and [installation](https://docs.ntfy.sh/install/). Self-hosting requires approved infrastructure; no service purchase or deployment was made.

The relay must authenticate the watchdog's bearer secret, validate the small JSON payload (`service`, operator alias, reason codes, observation timestamp and action), reject résumé/profile data, and convert it to ntfy's `topic`, `title` and `message` JSON at the ntfy root endpoint. Configure TLS, private topic read/write ACLs, independent uptime monitoring, bounded metadata retention, retry/deduplication and an operator who verifies actual notification receipt. A direct ntfy URL is **not** a drop-in receiver for the watchdog's current JSON shape; the adapter is required. Do not use an anonymous public topic.

Keep `NIVA_ALERT_DELIVERY_ENABLED=0` and leave `NIVA_ALERT_URL`, `NIVA_ALERT_SECRET` and `NIVA_OPERATOR_ID` unset until approval. `maintenance-watchdog.mts --plan` sends nothing. `--run` now refuses delivery unless `NIVA_ALERT_DELIVERY_ENABLED=1`; operator, health authentication and approved HTTPS receiver configuration are additionally required. After approval, observe two real staging scheduled cleanup cycles and a deliberately controlled failure, record receiver acknowledgement, recover cleanup and restore a disposable hosted backup with ownership/erasure checks. Production operational evidence still requires a separately authorized production procedure.
