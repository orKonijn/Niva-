# Niva 0.3.2 — live verification and reassessment

27 October 2026. **Deployed successfully as Sites44** to [getnivajobs.com](https://getnivajobs.com). [Publication receipt](verification/publication-20261027-v44.json), [live evidence](verification/live-20261027-v44.json), [independent source checks](verification/original-sources-20261027-v44.json).

## Assessment: 7.3/10 for the observed job-finding experience

Up from the prior live6.8/10. The earlier7.5/10 was provisional local assessment; live review supports a slightly more conservative data score. Niva now handles the tested regional restriction, required alternative and talent-pool cases more accurately. Search, filtering, saving and the employer handoff work in the observed journey. It still cannot establish that a high-coverage result is qualified, eligible or currently accepting applications without original-source checking.

| Area                                 |   Weight | Score /10 |
| ------------------------------------ | -------: | --------: |
| Result relevance                     |      25% |         6 |
| Eligibility handling                 |      15% |         8 |
| Data quality and presentation        |      20% |         7 |
| Application handoff                  |      15% |         8 |
| Search and filtering                 |      10% |         8 |
| Usability                            |      10% |         8 |
| Responsive/accessibility spot checks |       5% |         7 |
| **Overall**                          | **100%** |   **7.3** |

Weighted result7.25 rounds to7.3. Scores are judgments grounded in this sample, not certifications. The decrease from the local estimate reflects remaining source-evidence clipping and warning clarity, plus field freshness/eligibility uncertainty. No market-wide relevance gain, full conformance or operational readiness is established.

## Deployment and safeguards

Reviewed GitHub commit: `f1fd7292904df73bd46f1ffb5b9d0a07e8b2e0e9`. Sites source: `f83f5f064eaeef1be0299e435164390f6df35df9`. The custom-domain build metadata matches both, confirms mapped source and a clean build. [GitHub CI](https://github.com/orKonijn/Niva-/actions/runs/40524161837) passed formatting, three type checks,59 frontend,177 server,1 Worker,1 provenance, production build and226 browser tests.

Public access revision2, runtime environment revision7, D1 DB binding and the existing hourly refresh schedule were preserved. No new SQL/account migration, private cleanup command, receiver activation or access change occurred. Normal page checks refreshed public catalog evidence.

Only one temporary Canopy save and its removal were performed. Persistence was checked after full reloads; final saved count is0, matching the starting state. Existing profile, résumé and saved search preferences were not edited. No employer application was submitted and no file was uploaded by the agent.

The Canopy handoff reached the correct employer application form. After its top Apply control, MyGreenhouse displayed an autofill notice and four visible inputs were populated by that existing provider session. The agent did not click Autofill my application, enter values or press Submit application. Actual field values were not recorded; no file control contained a file, no submission confirmation appeared, and the test tab was closed. This is application accessibility evidence, not proof of a blank form or a completed application.

## Method and limits

Desktop1440×1000 and mobile390×844 were checked through the actual authorized Chrome session. Temporary viewport overrides were reset. Saved preferences observed: QA automation, Tel Aviv and all three work arrangements. The five-year QA seeker and technical skills used for independent comparison remain test assumptions, not verified facts about the real account. Confirmed criteria were not changed to manufacture match scores.

Five scenario families were exercised: close QA, alternate testing titles, Tel Aviv source location, remote country restriction and restrictive empty search. Additional checks covered unknown-value controls, hybrid filtering, ordering, pagination, source details, save/reload/unsave and employer handoff. Twenty paired live detail pages plus Canonical and Side were inspected. Independent source checks confirmed14 exact ATS publications;6 Jobicy current publication states remain unknown. Cached Niva published labels with older dates were not counted as current independent publication confirmation.

Live onboarding, uploads/parsing, profile editing and authorization-criteria persistence were **N/T**, to preserve the existing account. Earlier local/disposable tests retain their own scope. Employer application-form access was tested for **one** listing; the other19 paired application flows are N/T. CAPTCHA, purchases, messages, form submissions and network-failure injection were not attempted. Complete screen-reader, physical-device, field Web Vitals, hosted private retention, alert receipt and erasure-safe restore checks remain unverified.

## Search and journey observations

| Observed test                                       | Stable result             |
| --------------------------------------------------- | ------------------------- |
| QA literal search                                   | 8 מתוך 8 משרות מהמקור     |
| SDET quick-title literal search                     | 1 מתוך 1 משרות מהמקור     |
| SDET related titles across categories               | 10 מתוך 10 משרות מהמקור   |
| Related testing roles with source location Tel Aviv | 4 מתוך 4 משרות מהמקור     |
| Remote LQA with applicant country IL                | 0 מתוך 0 משרות מהמקור     |
| Remote LQA with applicant country PT                | 1 מתוך 1 משרות מהמקור     |
| Remote LQA PT with unknown values hidden            | 1 מתוך 1 משרות מהמקור     |
| Restrictive empty search                            | 0 מתוך 0 משרות מהמקור     |
| Clear-filter recovery                               | 50 מתוך 3037 משרות מהמקור |
| Hybrid QA including unknown arrangements            | 3 מתוך 3 משרות מהמקור     |
| Hybrid QA strict arrangements                       | 2 מתוך 2 משרות מהמקור     |
| Strict hybrid QA with source-order option           | 2 מתוך 2 משרות מהמקור     |
| Final QA search settled                             | 8 מתוך 8 משרות מהמקור     |

The SDET quick-title control initially performed a literal query with its category filter. Related expansion was then explicitly enabled and categories cleared before recording the10-title result. This avoids presenting different active filters as equivalent searches.

Strict hybrid QA produced Canopy and Transmit (2/2 arrangement-compliant). Including unknown styles added Unframe AI (3 total). Remote LQA with IL returned0; PT returned1, including when unknown values were hidden. This demonstrates Schengen country-level filtering, not Portuguese work authorization or language qualification. The Side result is labelled a talent pool rather than a verified open vacancy.

The empty query showed recovery guidance; clearing screen filters restored the catalog. Pagination increased50 to100 unique job URLs and retained all first-page URLs. That is **0/100 repeated identifiers**, not a semantic-duplicate rate for the catalog. Source ordering reset the page and changed its first titles; relevance ordering restored the QA-first view.

Canonical now shows Python-or-Go as one required alternative, keeps cloud tools optional and renders six actual source headings. Some cold detail visits required several seconds while source checks completed; no formal latency or field-performance threshold is claimed.

Of20 independent publication checks,14 were published,0 were confirmed absent and6 were unresolved. The observed confirmed-absence rate is0/14 among resolved provider checks, with6/20 unknown; it is not proof of zero stale listings. One tested application handoff worked (1/1); no catalog-wide broken-link/application-access rate is supported. Role-family, seniority, residence and qualification remain distinct in the table below.

## Paired result review

These are the same20 selected historical records, not a random sample or the current first20 search hits. Explanations assess the assumed QA target; personal qualification is not established. Each linked record retains timestamped Niva evidence and its original-source URL in the JSON receipts.

| Job                                                                                                                             | Independent relevance / unresolved conditions                                                                                                  | Original publication check  | Application flow            |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------- |
| [QA & Automation Engineer ](https://getnivajobs.com/app/jobs/greenhouse-canopycare-5285235008)                                  | Strong QA/automation lead to investigate; 2+ years; actual employer form reached. Qualification, compensation and work rights remain separate. | ATS published               | Form reached; no submission |
| [QA & Automation Lead ](https://getnivajobs.com/app/jobs/greenhouse-transmitsecurity-8887486002)                                | Related QA role; Lead scope and management responsibilities need confirmation.                                                                 | ATS published               | N/T                         |
| [QA Engineer ](https://getnivajobs.com/app/jobs/greenhouse-unframe-4904270101)                                                  | Relevant QA family; four-year minimum; work arrangement unresolved.                                                                            | ATS published               | N/T                         |
| [AI-First QA Automation Engineer ](https://getnivajobs.com/app/jobs/greenhouse-unframe-5003021101)                              | Relevant automation family; four-year minimum; AI/tool requirements and work arrangement need review.                                          | ATS published               | N/T                         |
| [Junior QA Tester ](https://getnivajobs.com/app/jobs/greenhouse-wedev-4652209101)                                               | QA family but Junior scope is a mismatch risk for the assumed five-year seeker.                                                                | ATS published               | N/T                         |
| [Manual QA Engineer (Game Client) ](https://getnivajobs.com/app/jobs/jobicy-israel-qa-156544)                                   | Manual/game-client testing is an adjacent specialty; Europe/remote does not establish Israel eligibility.                                      | Unknown current publication | N/T                         |
| [QA Automation Engineer - CDH ](https://getnivajobs.com/app/jobs/lever-veeva-israel-fdca1089-4737-4b89-8fa7-03c36262d3ab)       | Relevant automation family; onsite Kiryat Ono and seniority need confirmation.                                                                 | ATS published               | N/T                         |
| [Enterprise Sales Engineer - UK/Ireland ](https://getnivajobs.com/app/jobs/greenhouse-datadog-7487353)                          | Sales engineering, outside the QA target; UK/Ireland geography.                                                                                | ATS published               | N/T                         |
| [Senior Sales Engineer - Key Accounts ](https://getnivajobs.com/app/jobs/greenhouse-datadog-7516279)                            | Sales engineering, outside target; seven-year minimum and US geography.                                                                        | ATS published               | N/T                         |
| [Senior Product Security Engineer - AI Agents ](https://getnivajobs.com/app/jobs/greenhouse-datadog-7993198)                    | Product security rather than QA; US locations and arrangement conflict/unknown require review.                                                 | ATS published               | N/T                         |
| [Senior Solution Engineer, Presales - Public Sector (US Remote) ](https://getnivajobs.com/app/jobs/greenhouse-jfrog-8185306)    | Presales/public-sector solutions rather than QA; US citizenship/work-rights conditions require verification.                                   | ATS published               | N/T                         |
| [Regional Vice President, Strategic Solution Engineering (Central) ](https://getnivajobs.com/app/jobs/greenhouse-jfrog-8255562) | Executive solutions role rather than QA; ten-year minimum and US geography.                                                                    | ATS published               | N/T                         |
| [Solutions Engineer ](https://getnivajobs.com/app/jobs/greenhouse-wizinc-4665302006)                                            | Solutions engineering rather than QA; Japan hiring location.                                                                                   | ATS published               | N/T                         |
| [Security Engineer - Product ](https://getnivajobs.com/app/jobs/greenhouse-wizinc-4704730006)                                   | Product security rather than QA; UK hiring location.                                                                                           | ATS published               | N/T                         |
| [Principal Solutions Engineer ](https://getnivajobs.com/app/jobs/greenhouse-wizinc-4712609006)                                  | Principal solutions role rather than QA; Australia hiring location.                                                                            | ATS published               | N/T                         |
| [Staff Software Engineer, App Platform ](https://getnivajobs.com/app/jobs/jobicy-israel-qa-144040)                              | Staff platform engineering rather than QA; ten-year minimum; current publication unknown.                                                      | Unknown current publication | N/T                         |
| [Senior AI Engineer ](https://getnivajobs.com/app/jobs/jobicy-israel-qa-144139)                                                 | Senior AI engineering rather than QA; seven-year minimum; Bulgaria; current publication unknown.                                               | Unknown current publication | N/T                         |
| [Junior Linux Kernel Engineer - Ubuntu ](https://getnivajobs.com/app/jobs/jobicy-israel-qa-149520)                              | Kernel engineering and Junior scope differ from target; Anywhere is not worldwide eligibility.                                                 | Unknown current publication | N/T                         |
| [Senior/Staff/Principal Engineer ](https://getnivajobs.com/app/jobs/jobicy-israel-qa-149522)                                    | Broad senior/staff/principal engineering; specialization and residence unresolved.                                                             | Unknown current publication | N/T                         |
| [Cloud Field Engineer ](https://getnivajobs.com/app/jobs/jobicy-israel-qa-149523)                                               | Cloud field engineering rather than QA; residence, authorization and current publication unresolved.                                           | Unknown current publication | N/T                         |

Additional live checks: [Canonical151013](https://getnivajobs.com/app/jobs/jobicy-israel-qa-151013) for alternatives/structure; [Side144408](https://getnivajobs.com/app/jobs/jobicy-israel-qa-144408) for the Schengen restriction and explicit future talent pool. No numerical increase in suitable, actionable market opportunities is claimed.

## Remaining confirmed presentation defects

**L44-01 — Low, confirmed: work-arrangement excerpts still cut words.** Open [Canopy](https://getnivajobs.com/app/jobs/greenhouse-canopycare-5285235008), inspect the source/work-arrangement evidence, and reload. A quote begins “ss teams”; Transmit showed “ategies.” Expected: intact word boundaries with omission markers. Actual: fixed character-window fragments. Reproduced after source refresh; duplicate fragments were seen initially but did not persist, so duplication is not a separate confirmed bug. Likely source: `server/source-evidence.ts:126`; the prior B05 repair covered required-skill/experience quotes, not this helper. Fix by sharing bounded, anchor-preserving excerpt logic and testing all evidence types. Acceptance: intact bilingual/Unicode words, retained work-style evidence, explicit ellipses, no changed arrangement decision.

**L44-02 — Low, confirmed: an unresolved-requirement warning gives the wrong explanation.** Open Canopy and compare its visible source headings with the facts warning that section boundaries were not preserved. Expected: say some requirements could not be interpreted reliably when the uncertainty concerns a complex alternative. Actual: the warning specifically blames missing boundaries. `server/job-facts.ts:131` combines unresolved section and alternative cases; `src/app/pages/job-detail.html:147` and `src/app/core/job-assessment.ts:46` use the narrow boundary message. Fix with reason-specific flags or accurate general wording. Acceptance: both ambiguity types remain conservative and understandable, without hiding unknowns or upgrading skill coverage.

Rapid automated filter changes required a retry once while navigation was updating; isolated controls and resulting filters then worked. This is not classified as a confirmed product bug. Broader typing/click concurrency deserves a regression check.

## Priorities and next evidence

1. Correct the two presentation defects with focused source fixtures; preserve required alternatives and unknown eligibility.
2. Improve explicit employer eligibility coverage and distinguish confirmed current publication from older retained status. Never fill gaps by inferring work rights from office location.
3. Run a fresh controlled, same-persona first-page usefulness benchmark after an authorized profile/test-account setup, with independently verified application paths and skill/seniority/eligibility labels.
4. Complete approved hosted maintenance, alert, identity and restore gates; then field-performance and human accessibility checks. These are not implied by a green CI run or this public deployment.

Raw live screenshots can include the account avatar; they were visually inspected locally and are omitted from the public repository. Existing [synthetic implementation visuals](relevance-improvements-20261027.md) remain available. No personal account identifiers, résumé text, employer autofill values or personalized match scores are published here.

This report and receipt reconciliation are Git-only follow-up documentation. They do not create another Sites release or change the deployed source mapping.
