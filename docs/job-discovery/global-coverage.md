# All jobs and locations · 25 October 2026

The user explicitly selected **all jobs and locations**. The default discovery view browses every role and published location in the connected catalogue. Saved role, district and work arrangement preferences remain available through the personal view; broader browsing does not rewrite them. Employer exclusions and explicit eligibility blockers still apply. A location text filter matches the employer's published location. Foreign offices have no invented Israel map point, and remote is not proof of worldwide eligibility.

## Connected coverage

The registry now has 24 sources: 21 Greenhouse boards, WalkMe and location-scoped Veeva Lever feeds, and Jobicy. Existing employer feeds already returned worldwide records; ingestion previously discarded locations outside Israel. The new ingestion retains them. An October 25 metadata observation counted 1,719 postings across the 19 previously connected Greenhouse boards, before deduplication, eligibility checks or subsequent closures. This is an observation, not a guaranteed live result count.

Three additions were verified against public provider records:

| Source                   | Public endpoint                                                                                        | Observation                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Transmit Security        | [Greenhouse](https://boards-api.greenhouse.io/v1/boards/transmitsecurity/jobs?content=true)            | 16 postings; QA & Automation Lead 8887486002, Tel Aviv-Yafo                   |
| Veeva, Israel/Kiryat Ono | [Lever](https://api.lever.co/v0/postings/veeva?mode=json&location=Israel%20-%20Kiryat%20Ono&limit=100) | 5 postings; QA Automation Engineer – CDH fdca1089-4737-4b89-8fa7-03c36262d3ab |
| WeDev                    | [Greenhouse](https://boards-api.greenhouse.io/v1/boards/wedev/jobs?content=true)                       | 3 postings; Junior QA Tester 4652209101, Holon, remains manual QA             |

Optional personal-view controls broaden the district or include related/manual QA without changing confirmed preferences. The all-jobs view loads 50 results per page and supports further pages.

Jobicy requests all roles and locations, retaining its legacy source ID for saved links. Its seven-day rolling feed is bounded to five sequential pages, at most 1,000 postings per hourly pass. If more pages exist, source health explicitly marks partial coverage. A research pass reached that cap with further pages available. The provider's three-hour delay, attribution and possible account requirement remain visible. At most 100 missing IDs receive explicit status checks per pass, rotating oldest checks first. Absence never proves closure; older unchecked records are withheld as unknown while history and descriptions remain intact. ATS refresh retains the 15-minute floor, durable leases, backoff and outage preservation. Visits/refreshes request due-source updates; provider cadence is shared across visitors.

Metadata-only feeds keep transport bounded. Opening a job can enrich its full description from verified provider JSON. Enrichment survives unchanged metadata snapshots and is invalidated when the provider's update changes. Global eligibility scanning reads stored evidence summaries and full bodies only for selected page rows, avoiding a full-catalogue description download into memory.

## Other websites and limits

LinkedIn and Indeed links open external searches using the entered text. They are **not connected import feeds**. Automated redistribution requires appropriate access; the available LinkedIn connector searches people rather than jobs. Comeet's [Job Board API](https://developers.comeet.com/reference/job-board-api-overview) requires partner approval; its careers API requires company-issued credentials. No credentials were harvested. The [source matrix](research.md) records primary access and rights documentation. Connected jobs retain original attribution and manual application links.

## Evidence

The regression fixture contains ten short, real public job samples and a synthetic account shell. Genuine before captures show the original two QA/Tel Aviv results; after captures show the same fixture in the all-jobs view. Ten fixture cards are not a live market count. Desktop/mobile and both themes are paired under `docs/screenshots/changes/qa-coverage-*`. No actual CV, name, email or private preferences are committed.

Tests cover global/personal scopes, location/related-role controls, unchanged preferences, cursor consistency, exclusions and blockers, trusted URLs, description enrichment/invalidation, bounded rolling pagination/status rotation and large-body memory behavior. Exact final check counts and production observations are recorded in the changelog and publication receipt after they occur.

This supersedes the earlier Israel-first implementation scope and Jobicy QA-only description. Connected global coverage does not imply every employer, universal work authorization, verified application submission or calibrated ranking.
