# Development status

## Current scope — 26 October 2026

Latest observed publication: **version 35**, not the earlier milestones described below. Selected global discovery includes 24 core employer/Jobicy sources plus two configuration-gated JSearch publisher feeds. JSearch provides partial daily LinkedIn/Indeed samples, not exhaustive live searches. PDF/DOCX text extraction works in the browser; original files stay on device on this path. Reviewed text is saved privately for 30 days. Server upload scanning, AI and email remain configuration-gated/inactive; they are distinct from local parsing. The enabled hourly public-source refresh is not evidence of private retention cleanup. Two recurring private cleanup cycles, an accountable operator, approved alert delivery, independent hosted identity isolation and backup restoration remain unverified. See [current status](current-status.md) and the [unpublished local repair report and staging procedure](review-repairs-20261026.md).

## Historical implementation and prepared procedures

The milestone-specific counts, publication numbers and observations below retain their original dates and scope. Current status above supersedes conflicting capability/deployment summaries; prepared procedures do not establish successful hosted execution.

> Current scope and deployment truth: [current-status.md](current-status.md). This guide includes historical milestone evidence. The 24 October review repairs are local only and have not been pushed or deployed.

> Historical baseline/deployed behavior. The career extension was subsequently published; the review repairs remain local only; see [career-assistant.md](career-assistant.md) for feed, resume, matching, chat, configuration and retention changes.

This document records the original frontend milestone. For the current account backend, real sign-in routes, persistent data, map, setup and verification status, see [Accounts and map implementation](accounts-map.md). The original no-auth description below applies to the earlier guest-only milestone.

## First milestone

This repository implements the initial Angular and TypeScript frontend from the Niva specification. It contains a responsive Hebrew RTL marketing website, three-step setup, dashboard, sample jobs, local review approvals, saved jobs, search and filters, preferences, local data export/reset, and supporting information pages.

All routes are lazy loaded. Shared UI uses standalone components and state uses Angular signals. Application state and static sample jobs are isolated in `DemoStore` so a later API integration does not need to be embedded into templates. The local demo does not provide authentication or authorization. `/login` deliberately points to the clearly labelled demonstration flow, not a fake login form.

## Boundaries

- No account creation, email verification, password handling, backend, AI inference or job-platform requests.
- CV selection validates extension, browser MIME metadata and size. It does not read, scan, extract, persist or upload the file content. This client validation is not a security control for a future upload API.
- The candidate name and selected filename are held in memory only. Preferences, exclusions, saved sample job IDs, approval timestamps and pause state are stored locally. Cookie preference is a separate local entry. No analytics SDK is included.
- Approval creates a `local-demo` record, never a submitted status. Duplicate, unknown, excluded and paused approvals are blocked by the store as well as the interface. Real authorization, idempotency and audit requirements must be implemented on the server.
- Resume setup does not resume across a browser refresh; only preferences and demonstration history persist. Production resumable onboarding is a later server feature.
- The public documents describe this demonstration only. Production legal notices, contact owner, privacy retention and provider disclosures require approval before a real service is enabled.

## Next milestones

1. Select hosting, identity provider, storage region, processors and first approved job integration. Confirm ownership, budget and data retention.
2. Implement server authentication and tenant authorization; private uploads with malware scanning; candidate-confirmed CV parsing; versioned profile and preference APIs.
3. Replace the static job repository with a destination adapter and source freshness metadata. Review permissions and supported capabilities before advertising coverage.
4. Implement immutable approved payloads, server-side idempotency, queueing, pause checks, submission confirmation evidence, reconciliation and human-action states.
5. Add provider-backed notifications, operational support, data-rights controls, security review, manual accessibility testing and pilot monitoring.

The specification remains the product direction; this milestone is an executable frontend foundation rather than the full P0 service. No billing is connected. A private Sites deployment is configured for this interactive demo.

## Hosting

`npm run build` outputs `dist`. Deploy its contents to a static host with SPA fallback to `index.html`, HTTPS and an appropriate security-header policy. The preview script binds to loopback and is for local review only. GitHub upload does not automatically publish the site. For GitHub Pages under `/Niva-/`, use `npm run build -- --base-href /Niva-/` and configure route fallback; a host with native SPA rewrites is preferable for this route structure. Do not expose the development server publicly.

## Design assets

The hero is an original generated image from the planning phase, optimized to WebP. The final prompt is in `docs/design/image-generation-prompt.txt`. Fonts are self-hosted Heebo via Fontsource; its upstream license is included by the package. The wordmark and icons are code-native SVG. Final brand and trademark clearance is a product task. The PDF includes the original planning boards; current implementation screenshots are separate.

## Reliability repairs

See [repair implementation and verification](repair-verification.md) for finding-by-finding status, Web Locks coordination, reset outcomes, browser coverage, screenshots and remaining limitations.

## Districts and themes

See [districts, work styles, fields and appearance](preferences-and-themes.md) for the canonical v2 preference schema, legacy mappings, URL filters, theme tokens, first-paint initialization and current test evidence. The separate theme preference survives demo reset.
