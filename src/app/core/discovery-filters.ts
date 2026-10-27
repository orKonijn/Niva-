import type { Job } from './models/job';
import type { CandidateCriteria } from './models/discovery';
import type { Preferences } from './preferences';
import { assessJob } from './job-assessment';
import { applicantLocationMatch, hasApplicantLocationRestriction } from './applicant-location';
export interface DiscoveryFilters {
  eligibility?: string;
  country?: string;
  remoteScope?: string;
  salaryMin?: string;
  currency?: string;
  period?: string;
  seniority?: string;
  employment?: string;
  since?: string;
  provider?: string;
  missing?: string;
}
/** Same filter runs before server pagination and in the browser. Never imply unknown equals eligible. */
export function passesDiscovery(
  job: Job,
  query: DiscoveryFilters,
  preferences: Preferences,
  candidate?: CandidateCriteria,
  now = Date.now(),
) {
  const f = job.facts;
  const eligibility = assessJob(job, preferences, '', false, candidate, now).eligibility;
  if (query.eligibility !== 'all' && query.eligibility !== 'blocked' && eligibility === 'blocked')
    return false;
  if (query.eligibility === 'clear' && eligibility !== 'clear') return false;
  if (query.eligibility === 'confirmation' && eligibility !== 'confirmation') return false;
  if (query.eligibility === 'blocked' && eligibility !== 'blocked') return false;
  // Explicit inspect mode is an exception to the default blocker exclusion.
  const unknown = query.missing !== 'hide';
  if (
    query.provider &&
    (query.provider === 'jsearch'
      ? !job.source?.sourceId?.startsWith('jsearch-')
      : job.source?.sourceId !== query.provider)
  )
    return false;
  const location = applicantLocationMatch(f, query.country);
  if (query.country && (location === false || (location === null && !unknown))) return false;
  if (query.remoteScope === 'known' && !hasApplicantLocationRestriction(f)) return false;
  if (query.remoteScope === 'unknown' && hasApplicantLocationRestriction(f)) return false;
  if (query.seniority && (f?.seniority ? f.seniority.value !== query.seniority : !unknown))
    return false;
  if (
    query.employment &&
    (f?.employmentType ? f.employmentType.value !== query.employment : !unknown)
  )
    return false;
  if (
    query.since &&
    (job.source?.publishedAt ? job.source.publishedAt.slice(0, 10) < query.since : !unknown)
  )
    return false;
  if (query.salaryMin && Number(query.salaryMin) > 0) {
    const s = f?.salary?.value;
    const comparable =
      s &&
      (s.origin === 'employer' || s.origin === 'estimated') &&
      s.currency === query.currency &&
      s.period === query.period &&
      (s.max ?? s.min) != null;
    if (comparable ? (s.max ?? s.min ?? 0) < Number(query.salaryMin) : !unknown) return false;
  }
  return true;
}
