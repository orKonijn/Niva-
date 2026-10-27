import type { Job } from './models/job';
import type { CandidateCriteria } from './models/discovery';
import type { Preferences } from './preferences';
import { normalizeSearch } from './preferences';
import { requiredSkillGroups } from './matching';
import { applicantLocationMatch } from './applicant-location';
import { jobOpportunity } from './job-opportunity';
export const RANKING_VERSION = 'discovery-evidence-v2';
const nonSoftwareQa =
  /\b(?:manufacturing|food safety|food production|pharmaceutical|laboratory|construction|mechanical|electrical)\b/i;
export const qaTitle = (title: string) =>
  (!nonSoftwareQa.test(title) || /\bsoftware\b|\bsdet\b/i.test(title)) &&
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
    const otherOccupation =
      /\b(?:sales|presales|solutions?|customer success|customer support)\s+engineer\b/i.test(
        job.title,
      );
    const physicalDomain =
      /\b(?:manufactur\w*|hardware|mechanical|electrical|food safety)\b/i.test(job.title) &&
      !/\bsoftware\b|\bsdet\b/i.test(job.title);
    if (otherOccupation || physicalDomain) {
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
  if (jobOpportunity(job)) {
    rank -= 45;
    reasons.push('מאגר מועמדים או פנייה עתידית; לא משרה פתוחה מאומתת');
  }
  if (candidate?.confirmed) {
    const groups = requiredSkillGroups(job);
    const skills = new Set(candidate.skills.map((s) => s.toLowerCase()));
    const matched = groups.filter((g) => g.some((s) => skills.has(s.toLowerCase()))).length;
    if (groups.length && skills.size) {
      // Positive evidence orders leads; absence is not proof of ineligibility.
      rank += Math.round((24 * matched) / groups.length);
      reasons.push(`עדות בפרופיל המאושר ל־${matched} מתוך ${groups.length} דרישות כישורים שחולצו`);
    }
    if (applicantLocationMatch(job.facts, candidate.currentCountry) === true) {
      rank += 8;
      reasons.push('המדינה המאושרת תואמת למגבלת המגורים; אישור עבודה נבדק בנפרד');
    }
  }
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
