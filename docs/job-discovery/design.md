# Trustworthy discovery: implementation specification

25 October 2026. Read [research and audit](research.md) first. The initial market is Israel-based work and explicitly labelled remote candidates; this is not comprehensive worldwide coverage. New markets and restricted provider access are phased work, not advertised as connected.

## Pipeline and normalized contract

Discover from a curated employer/provider registry → fetch only allowed/due sources → validate complete vs rolling snapshots → normalize with field evidence → deduplicate exact identities → verify source presence and application path separately → assess explicit eligibility → calculate versioned fit → filter/page/serve → recompute after profile/CV/job edits and revalidate on details/Apply.

`Job` retains stable IDs and legacy saved-job compatibility. Add nullable facts: employer/posting/requisition IDs; canonical and application URLs; source references; department; responsibilities; required/preferred skills; minimum experience and seniority; qualifications/licences/clearance/languages; employment type; office countries/locations and work arrangement; applicant-country/timezone restrictions; authorization and sponsorship statements; salary min/max/currency/period/origin; publication/update/first-seen/fetched/source-verified/application-checked/deadline timestamps; publication/closure and application-path states. Each supplied/extracted/inferred fact carries a source URL, observed timestamp and short evidence. Null is unknown; an empty requirement set is not a claim of no requirements.

Legacy records predate first-seen tracking: their original firstSeen remains unknown, not backfilled from latest fetch. New records retain immutable firstSeen. Publication/update/firstSeen are different fields. Source presence verifies publication; application reachability and semantic form evidence are separate. A200 alone is only transport reachability. Timeouts/403/redirect anomalies remain unknown. Only explicit closure/expired deadline or absence from a validated **complete** source snapshot establishes closure. Jobicy is rolling: absence is not closure; its status endpoint supplies active/closed/unknown. Unknown records are withheld from default source recommendations and remain inspectable in saved/history context.

Deduplication uses tracking-normalized canonical URLs or exact employer+requisition+location identity. Prefer authoritative employer data where an exact identity exists and preserve every source reference. Do not collapse similarly titled jobs, distinct requisitions, or meaningful location variants. Unresolved cross-site similarities remain separate pending an authoritative identifier; no fuzzy merge presented as fact.

## Confirmed candidate evidence

CV text must be explicitly reviewed/active. Add optional confirmed structured criteria: skills, years/seniority, target roles, current/preferred countries, country-specific work authorization, sponsorship need, languages, qualifications/licences/clearance, salary currency/period/minimum, timezone and employment types. Existing name/headline and preferences are preserved. New defaults are unknown, not inferred from a name, nationality or CV silence. Editing criteria requires confirmation; changing relevant profile/CV/job data recomputes assessments using the same pure method. Private profile evidence is not persisted in public job rows or exports.

## Eligibility is separate from fit

- **Explicit blocker:** a current, evidence-backed non-negotiable restriction conflicts with an explicit confirmed profile answer, or the job is explicitly closed/deadline expired.
- **Needs confirmation:** required information is absent, incomplete, contradictory, source availability is uncertain, or an application requires unverified provider steps. Missing language/licence/CV evidence is not proof of inability.
- **No known blocker:** no recorded conflict after checked facts; this is not a guarantee of legal eligibility or employer acceptance.

Applicant geography is separate from office location, citizenship, authorization and sponsorship. Remote does not mean worldwide. Description-specific physical-country requirements override a broader aggregator Anywhere/EMEA label. Unknown sponsorship remains unknown. Explicit blockers are excluded from default recommendations; an inspect filter exposes them with reasons. No automated submission or hiring decision is made.

## Fit method: proposed initial weights, versioned and inspectable

Initial `fit-v1` weights are a **hypothesis to validate**, not statistically calibrated hiring predictions: skills35, relevant experience/seniority25, role15, work preferences15, compensation10. Show each dimension's contribution, supporting profile/job evidence, strongest matches and meaningful gaps.

Unknown dimensions contribute no points and retain their original weight; **do not reweight the known dimensions upward**. A numerical0–100 score requires a confirmed active CV, at least two comparable job-skill terms and at least60/100 evidence-weight coverage. Otherwise show insufficient information. A partial-evidence score can therefore be capped below100; missing salary never boosts a score. Skill terminology is a bounded bilingual evidence feature, not proof of professional expertise. Explicit minimum years and declared experience are comparable; title-derived seniority is labelled inferred and lower-confidence. Compare compensation only when currency/pay period/origin are comparable; do not invent FX conversions or salary estimates.

Show data completeness separately (profile/job fields present), evidence confidence separately (provenance/contradiction heuristic, not probability), and freshness separately (dates/delays). Score output includes method, job version and profile/CV revision basis; it is transient per user. Recompute deterministically after edits. Validate monotonicity, missing-field behavior, contradictory geography, blockers and consistent client/server use before tuning weights.

## Filtering and presentation

Cards expose title/employer, actual location/work arrangement, disclosed compensation or unknown, fit or insufficient information, eligibility, source, successful-check time/delay and honestly labelled application action. Details expose requirements, evidence, questions, source history, deadline and original link. Filters cover eligibility, role, location/country, remote-country restriction, salary, seniority, employment type, publication date and source; missing-value behavior is visible. Include checking, partial-source outage, insufficient-profile, no-result and stale-cursor recovery states. All work styles selected should not silently hide182 unknown-style records: provide an explicit include-unknown control.

## Refresh and reconciliation schedule

| Event/source                | Proposed/implemented operating policy                                                                                                              | Evidence and limits                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Curated public employer ATS | Shared15-minute due-source checks during visits/refresh; no concurrent duplicate source fetch. Review cadence against provider headers/permission. | Upstream publication SLA and public GET quotas unknown;15min is Niva policy, not upstream guarantee. |
| Jobicy public               | Shared hourly maximum, sequential pagination; disclose3h upstream delay.                                                                           | 7-day rolling window; status batches<=100; explicit closed/unknown semantics.                        |
| Aggregator contract feeds   | Disabled until credentials/licence/quota established.                                                                                              | Do not consume500-lifetime Jooble quota with visitor polling.                                        |
| Remotive                    | Disabled under required signup.                                                                                                                    | If separately agreed later, max4 scheduled public passes/day and24h delay.                           |
| Employer pages              | Disabled broad crawl; permission-scoped adaptive15–60min or longer is proposed.                                                                    | Respect site rules/activity/change history.                                                          |
| Profile/CV edits            | Immediate deterministic local reassessment; no upstream request needed solely for scoring.                                                         | Score method and input versions exposed.                                                             |
| Detail / Apply              | Revalidate source and application evidence when older than15min, with bounded timeouts and truthful unknown states.                                | No HTTP200-only open assertion; no request credentials/profile forwarded to employers.               |
| Reconciliation              | Complete-board removals and exact dedupe on every successful sync; rolling-feed explicit status checks; daily application-path batches.            | Shared leases/backoff; no closure on failed/incomplete snapshots.                                    |
| UI                          | Display latest successfully processed results after source check; separately disclose provider lag, poll time and stale flags.                     | No unconditional live claim.                                                                         |

Retry uses bounded exponential backoff and respects Retry-After including dates; the retry deadline is not shortened by refresh. Preserve last-known records during outages and label them stale. Snapshot/cursor changes require restarting pagination. Processing budgets cap bodies, pages, concurrency, source checks and outbound verification time. No arbitrary user URL fetching.

Unattended cadence requires a supported hosted writer and verified scheduler, not merely an exported Worker scheduled handler. An hourly cloud schedule may invoke the same public due-source cache writer after readiness is verified; saved schedule and observed successful run must be reported separately. Do not claim unattended execution from a schedule configuration alone.

## Phases, dependencies and cost assumptions

1. **Ship trust foundation:** fix source validation/unknown filters, evidence schema, structured criteria, deterministic score/eligibility, accurate cards/detail/filter states, scoped relevant employer expansion and licensed Jobicy public discovery.
2. **Operational verification:** real-source probes, application-path evidence, source-aware schedules, click-only event recording, daily reconciliation and measured source/actionability metrics. Verify unattended writer/scheduler if provisioned; identify any execution gap explicitly.
3. **Broaden paid/partner coverage:** Ashby opt-in partner, SmartRecruiters employer permission, Adzuna country/contract/key, sustainable Jooble quota, USAJOBS key for eligible US federal users. LinkedIn/Indeed need the appropriate retrieval/redisplay partnership; no scraping workaround. Arbeitnow/RemoteOK need complete commercial terms review. Remotive requires signup-compatible agreement.
4. **Validate ranking:** evaluate real labelled profile/job pairs with user feedback; tune weights only after sufficient evidence. OCR, semantic extraction/LLM ranking and automated application submission are not bundled into the initial deterministic implementation.

No paid subscription, ATS application POST, funded wallet or commercial agreement is assumed. Public data GETs have no documented per-call fee here; hosting/D1/egress and cloud-task quota still cost resources. Initial request budget:20 employer boards×96 due checks/day=1,920 primary calls/day before pagination/detail checks; Jobicy<=24 passes/day with sequential pages/status batches. Visitor demand must share cache/leases. Cloud schedule execution/model costs and hosting plan unit prices are unknown until measured/account terms confirmed; report actual latency/request counts rather than invented dollar savings. Proposed alarms: usage exceeds budget by20%, source backoff grows, lag exceeds2×cadence, application-path unknown/broken rate rises.

## Measurable acceptance and validation

Targets are hypotheses, measured over a seven-day pilot unless otherwise stated:

| Metric                       | Initial acceptance / measurement                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Relevant actionable coverage | Current QA candidates must be nonzero, tied to live official/provider evidence; report unique relevant count and blockers/unknowns separately. Do not equate source count or active aggregator count with eligible matches. |
| Freshness                    | >=95% successful direct-ATS checks within30min when writer/scheduler available; Jobicy poll<=1h plus disclosed3h lag. Outage records visibly stale.                                                                         |
| Exact duplicates             | <1% duplicate exact-identity cards in sampled results; zero collapsed distinct-requisition/location fixtures. Fuzzy duplicates reported separately.                                                                         |
| Application paths            | >=95% source-supplied HTTPS paths reachable or semantically confirmed in a bounded daily sample; all unknown/blocked/closed cases labelled; no inference of completed submission.                                           |
| Eligibility                  | 100% of explicit geographic/authorization/deadline blocker regression fixtures excluded by default; zero remote=worldwide or missing-sponsorship=false assumptions. Human-review real ambiguous cases.                      |
| Score consistency            | Same inputs/version produce identical score; unknown fields never increase score; insufficient-evidence threshold enforced; score is never a hiring probability.                                                            |
| Latency                      | Cached feed p95<1.5s; due-source page p95<15s for initial scope; detail/Apply bounded timeouts with recovery. Measure production, not only local fixtures.                                                                  |
| Cost / sustainability        | Per-provider cadence/Retry-After respected; no duplicate concurrent fetches; report actual pages/calls/latency and hosting usage when available. Dollar ceiling pending account/budget facts.                               |

Validation must cover complete-source closure, rolling disappearance, duplicate attribution, distinct requisitions, Italy-only remote work, unknown sponsorship, language requirements vs missing evidence, incomplete CV/profile, source outages/429, expired deadlines, path soft404/403/timeouts, score monotonicity, profile edits, pagination consistency and click-vs-submission separation. Real sample/evidence files are dated snapshots; tests may use explicitly labelled synthetic fixtures to exercise edge cases without exposing personal records.
