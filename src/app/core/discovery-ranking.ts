import type { Job } from './models/job';
import type { CandidateCriteria } from './models/discovery';
import type { Preferences } from './preferences';
import { normalizeSearch } from './preferences';
export const RANKING_VERSION = 'discovery-evidence-v1';
export const qaTitle = (title: string) =>
  /\bqa\b|\bsdet\b|quality assurance|test automation|automation.*test|software (?:development )?engineer.*in test|software test(?:ing)? engineer|testing software engineer/i.test(
    title,
  );
export function relatedQaQuery(query: string) {
  return /^(?:qa|sdet|qa automation|test automation|software engineer in test|quality assurance|engineer)$/i.test(
    normalizeSearch(query),
  );
}
/** Alias expansion is explicit. Literal search remains literal when related is off. */
export function matchesDiscoverySearch(job: Job, query: string, related = false) {
  const q = normalizeSearch(query);
  return (
    !q ||
    (related && relatedQaQuery(q)
      ? qaTitle(job.title)
      : normalizeSearch(`${job.title} ${job.company}`).includes(q))
  );
}
/** Ordering evidence, not a probability or candidate eligibility decision. Applied before pagination. */
export function discoveryRank(
  job: Job,
  query: string,
  preferences: Preferences,
  candidate?: CandidateCriteria,
) {
  const reasons: string[] = [];
  let rank = 0;
  const qa =
    ['qa-manual', 'qa-automation'].includes(preferences.role) ||
    (relatedQaQuery(query) && normalizeSearch(query) !== 'engineer');
  if (qa) {
    if (qaTitle(job.title)) {
      rank += 60;
      reasons.push('כותרת ממשפחת בדיקות תוכנה');
    }
    if (job.category === preferences.role) {
      rank += 15;
      reasons.push('תחום לפי ההעדפה השמורה');
    }
    if (
      /sales|presales|solutions? engineer|solution engineer|customer|manufactur|hardware|mechanical|electrical/i.test(
        job.title,
      )
    ) {
      rank -= 70;
      reasons.push('תחום אחר בכותרת');
    }
    if (/\b(?:director|vice president|principal|staff|manager|lead)\b/i.test(job.title)) {
      rank -= 18;
      reasons.push('נדרשת בדיקת בכירות או ניהול');
    }
    if (
      /\b(?:junior|intern)\b/i.test(job.title) &&
      candidate?.confirmed &&
      (candidate.yearsExperience ?? 0) >= 4
    ) {
      rank -= 30;
      reasons.push('בכירות נמוכה מהניסיון שאושר');
    }
  } else if (preferences.role !== 'all' && job.category === preferences.role) rank += 60;
  if (
    preferences.district !== 'all' &&
    (job.district === preferences.district ||
      job.offices.some((o) => o.district === preferences.district))
  ) {
    rank += 12;
    reasons.push('מיקום לפי ההעדפה השמורה');
  }
  if (
    candidate?.confirmed &&
    candidate.yearsExperience != null &&
    job.facts?.minimumYears &&
    job.facts.minimumYears.value > candidate.yearsExperience
  ) {
    rank -= Math.min(35, (job.facts.minimumYears.value - candidate.yearsExperience) * 7);
    reasons.push('מינימום שנות ניסיון מעל הפרופיל');
  }
  return { rank, reasons, version: RANKING_VERSION };
}
