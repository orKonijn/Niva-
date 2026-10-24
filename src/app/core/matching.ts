import type { Job } from './models/job';
import { matchesPreferences, type Preferences } from './preferences';
export const MATCH_VERSION = 'evidence-v1';
export const SKILLS: Record<string, RegExp> = {
  JavaScript: /\bjavascript\b|ג׳אווהסקריפט/i,
  TypeScript: /\btypescript\b|טייפסקריפט/i,
  Angular: /\bangular\b|אנגולר/i,
  React: /\breact\b|ריאקט/i,
  Python: /\bpython\b|פייתון/i,
  SQL: /\bsql\b|שאילתות/i,
  Docker: /\bdocker\b|דוקר/i,
  Kubernetes: /\bkubernetes\b|\bk8s\b|קוברנטיס/i,
  AWS: /\baws\b|amazon web services/i,
  Azure: /\bazure\b/i,
  'Manual QA': /manual (?:qa|testing)|בדיקות ידניות|\bqa\b(?! automation)/i,
  'QA Automation': /test automation|qa automation|selenium|playwright|cypress|אוטומציית בדיקות/i,
  'Workflow Automation': /workflow automation|\bn8n\b|zapier|אוטומציית תהליכים/i,
  Figma: /\bfigma\b|פיגמה/i,
  'Product Management': /product management|product manager|ניהול מוצר/i,
};
export function skillEvidence(text: string): string[] {
  const positive = text
    .split(/\n|[.;]/)
    .filter(
      (line) =>
        !/(?:\bno\b|\bwithout\b|\bnever\b|ללא|אין לי)\s.{0,50}(?:experience|knowledge|ניסיון|ידע)|^\s*(?:no|without|ללא|אין לי)\b/i.test(
          line,
        ),
    )
    .join('\n');
  return Object.entries(SKILLS)
    .filter(([, pattern]) => pattern.test(positive))
    .map(([skill]) => skill);
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
      : factors.some((f) => f.status === 'conflict' || f.status === 'unknown')
        ? 'מחוץ לדרישות הסינון'
        : factors.every((f) => f.status === 'unspecified')
          ? 'העדפות: אין מספיק מידע'
          : 'תואם לדרישות הסינון שהוגדרו',
  };
}
export function resumeMatch(job: Job, text: string, confirmed: boolean) {
  const requirements = skillEvidence(`${job.title}\n${job.description}\n${job.skills.join(' ')}`);
  const evidence = confirmed ? skillEvidence(text) : [];
  const strengths = requirements.filter((s) => evidence.includes(s));
  const missing = requirements.filter((s) => !evidence.includes(s));
  // This is a terminology coverage count, never a probability or an inferred qualification.
  return {
    method: MATCH_VERSION,
    comparable: confirmed && requirements.length >= 2,
    strengths,
    missing,
    label:
      !confirmed || requirements.length < 2
        ? 'קורות חיים: אין מספיק מידע'
        : `עדות למונחים: ${strengths.length} מתוך ${requirements.length}`,
    coverage: confirmed && requirements.length >= 2 ? strengths.length / requirements.length : null,
  };
}
/** Extractive tailoring: move complete paragraphs; never detach dates from an employer. */
export function tailorExtractive(text: string, job: Job) {
  const lines = text.split(/\n\s*\n/);
  const requirements = skillEvidence(`${job.title}\n${job.description}`);
  // Preserve the header and complete paragraph blocks, including original internal ordering.
  const head = lines.shift() ?? '';
  const ordered = lines
    .map((line, index) => ({
      line,
      index,
      weight: skillEvidence(line).filter((s) => requirements.includes(s)).length,
    }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return {
    text: [head, ...ordered.map((l) => l.line)].join('\n\n'),
    explanation:
      'מיון פסקאות שלמות לפי מונחים במשרה. התוכן וסדר השורות בכל פסקה נשמרו ללא שינוי; יש לבדוק רצף ותאריכים לפני אישור. ללא פסקאות נפרדות ייתכן שלא יהיה שינוי.',
    missing: resumeMatch(job, text, true).missing,
  };
}
