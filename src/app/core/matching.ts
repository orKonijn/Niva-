import type { Job } from './models/job';
import { matchesPreferences, type Preferences } from './preferences';
import { requirementClauses } from './requirements';
export const MATCH_VERSION = 'evidence-v6';
// Only recognized testing modifiers may connect “manual” to “testing”.
const manualTestingList =
  /\bmanual(?:\s*,\s*(?:and\s+)?(?:functional|regression|exploratory|integration|acceptance|smoke|sanity|UI\/UX)){1,6}\s+testing\b/i;
export const SKILLS: Record<string, RegExp> = {
  JavaScript: /\bjavascript\b|ג׳אווהסקריפט/i,
  TypeScript: /\btypescript\b|טייפסקריפט/i,
  Java: /\bjava\b|ג׳אווה(?!סקריפט)/i,
  Playwright: /\bplaywright\b/i,
  Selenium: /\bselenium\b/i,
  APIs: /\b(?:apis?|rest api)\b/i,
  'GitHub Actions': /\bgithub actions\b/i,
  Angular: /\bangular\b|אנגולר/i,
  React: /\breact\b|ריאקט/i,
  Python: /\bpython\b|פייתון/i,
  Go: /\bgolang\b|\bGo(?=\s*(?:development|programming|language|engineer|developer|SQL|$|[,/.]))|\b(?:Python\s*(?:or|\/)\s*Go)\b/,
  SQL: /\bsql\b|שאילתות/i,
  Docker: /\bdocker\b|דוקר/i,
  Kubernetes: /\bkubernetes\b|\bk8s\b|קוברנטיס/i,
  AWS: /\baws\b|amazon web services/i,
  Azure: /\bazure\b/i,
  'Manual QA': new RegExp(`manual (?:qa|testing)|בדיקות ידניות|${manualTestingList.source}`, 'i'),
  'QA Automation': /test automation|qa automation|selenium|playwright|cypress|אוטומציית בדיקות/i,
  'Workflow Automation': /workflow automation|\bn8n\b|zapier|אוטומציית תהליכים/i,
  Figma: /\bfigma\b|פיגמה/i,
  'Product Management': /product management|product manager|ניהול מוצר/i,
};
/** Conservative clause-level terminology evidence. Ambiguous/negative clauses stay unknown. */
export function positiveEvidence(text: string): { skill: string; text: string }[] {
  const found = new Map<string, string>();
  const tokenNegation =
    /(?:^|[^\p{L}\p{M}\p{N}_])(?:ו)?(?:לא|ללא|בלי|אין|מעולם|טרם|אולי|אינני|אינו|אינה)(?=$|[^\p{L}\p{M}\p{N}_])/u;
  const clauses = text
    .normalize('NFC')
    .replace(/[’‘]/g, "'")
    .split(/\n|[.;!?]|\bbut\b|\bhowever\b|(?<![\p{L}\p{M}])(?:אבל|אלא|עם זאת)(?![\p{L}\p{M}])/iu);
  const englishNegation =
    /\b(?:not|never|no|without|lack(?:ing)?|don't|doesn't|didn't|haven't|hasn't|cannot|can't|maybe|might|unsure)\b/i;
  for (const contrast of clauses.flatMap((c) =>
    c.split(/\bwhereas\b|(?<![\p{L}\p{M}])אך(?![\p{L}\p{M}])/iu),
  )) {
    let inheritedNegative = false;
    const list = manualTestingList.exec(contrast);
    // Keep a coordinated testing list together, including its preceding negation.
    const boundaries = [...contrast.matchAll(/[,،]/g)]
      .filter((m) => !list || m.index < list.index || m.index >= list.index + list[0].length)
      .map((m) => m.index);
    let start = 0;
    const parts = [...boundaries, contrast.length].map((end) => {
      const part = contrast.slice(start, end);
      start = end + 1;
      return part;
    });
    for (const clause of parts) {
      const scope = clause
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\bnot only\b|(?<![\p{L}\p{M}])(?:ו)?לא\s+רק(?![\p{L}\p{M}])/giu, '');
      const negative = tokenNegation.test(scope) || englishNegation.test(scope);
      if (negative) inheritedNegative = true;
      else if (
        /\b(?:I (?:built|used|know|developed|have)|experience with)\b|(?:^|[^\p{L}])(?:עבדתי|פיתחתי|בניתי|ניסיון)(?![\p{L}])/iu.test(
          scope,
        )
      )
        inheritedNegative = false;
      if (negative || inheritedNegative) continue;
      for (const [skill, pattern] of Object.entries(SKILLS))
        if (pattern.test(clause.normalize('NFD').replace(/\p{M}/gu, '')) && !found.has(skill))
          found.set(skill, clause.trim().slice(0, 300));
    }
  }
  return [...found].map(([skill, text]) => ({ skill, text }));
}
export function skillEvidence(text: string): string[] {
  return positiveEvidence(text).map((e) => e.skill);
}
export function preferenceMatch(job: Job, p: Preferences) {
  const factors = [
    {
      label: 'תחום',
      status:
        p.role === 'all'
          ? 'unspecified'
          : job.category === 'other'
            ? 'unknown'
            : job.category === p.role
              ? 'match'
              : 'conflict',
    },
    {
      label: 'מחוז',
      status:
        p.district === 'all'
          ? 'unspecified'
          : job.district === 'unknown'
            ? 'unknown'
            : job.district === p.district
              ? 'match'
              : 'conflict',
    },
    {
      label: 'סגנון עבודה',
      status: !p.workStyles.length
        ? 'unspecified'
        : job.workStyle === 'unknown'
          ? 'unknown'
          : p.workStyles.includes(job.workStyle)
            ? 'match'
            : 'conflict',
    },
  ];
  const excluded = p.exclusions
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .some((x) => job.company.toLowerCase().includes(x));
  return {
    eligible: matchesPreferences(job, p) && job.source?.active !== false,
    excluded,
    factors,
    label: excluded
      ? 'חברה מוחרגת'
      : factors.some((f) => f.status === 'conflict')
        ? 'מחוץ לדרישות הסינון'
        : factors.some((f) => f.status === 'unknown')
          ? 'העדפות: נדרש בירור לפרטים שלא נמסרו'
          : factors.every((f) => f.status === 'unspecified')
            ? 'העדפות: אין מספיק מידע'
            : 'תואם לדרישות הסינון שהוגדרו',
  };
}
export function requiredSkillGroups(job: Job): string[][] {
  const singles = [
    ...new Set(
      job.facts
        ? (job.facts.requiredSkills?.map((e) => e.value) ?? [])
        : job.source
          ? skillEvidence(requirementClauses(job.description).required.join('\n'))
          : skillEvidence(`${job.title}\n${job.description}\n${job.skills.join(' ')}`),
    ),
  ];
  return [
    ...singles.map((s) => [s]),
    ...(job.facts?.requiredSkillAlternatives?.map((e) => e.value) ?? []),
  ];
}
export function resumeMatch(job: Job, text: string, confirmed: boolean) {
  const groups = requiredSkillGroups(job);
  const requirements = groups.map((g) => g.join(' / '));
  const evidence = confirmed ? skillEvidence(text) : [];
  const matched = groups.filter((g) => g.some((s) => evidence.includes(s)));
  const strengths = matched.map((g) => g.join(' / '));
  const missing = groups.filter((g) => !matched.includes(g)).map((g) => g.join(' / '));
  // This is a terminology coverage count, never a probability or an inferred qualification.
  return {
    method: MATCH_VERSION,
    comparable: confirmed && requirements.length >= 2,
    strengths,
    evidence: positiveEvidence(text).filter(
      (e) => confirmed && matched.some((g) => g.includes(e.skill)),
    ),
    missing,
    label:
      !confirmed || requirements.length < 2
        ? 'קורות חיים: אין מספיק מידע'
        : `עדות למונחים: ${strengths.length} מתוך ${requirements.length}`,
    coverage: confirmed && requirements.length >= 2 ? strengths.length / requirements.length : null,
  };
}
/** Preserve exact fact associations; blank lines cannot establish employment boundaries. */
export function tailorExtractive(text: string, job: Job) {
  const match = resumeMatch(job, text, true);
  return {
    text,
    explanation:
      'סדר הטקסט והעובדות נשמר במלואו. גבולות סעיפי תעסוקה אינם ודאיים; מוצגות עדויות רלוונטיות לבדיקה, ללא העברת הישגים בין מעסיקים.',
    missing: match.missing,
    highlights: match.evidence,
  };
}
