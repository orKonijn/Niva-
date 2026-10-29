import type { Job } from '../src/app/core/models/job';
import type { Evidence, JobFacts } from '../src/app/core/models/discovery';
export const FACT_VERSION = 'source-sections-v7';
/** Keep excerpt edges at word boundaries; ellipses disclose omitted context. */
function contextExcerpt(text: string, start: number, end: number): string {
  let from = Math.max(0, start),
    to = Math.min(text.length, end);
  while (from > 0 && !/\s/.test(text[from - 1])) from--;
  while (to < text.length && !/\s/.test(text[to])) to++;
  return `${from ? '… ' : ''}${text.slice(from, to).trim()}${to < text.length ? ' …' : ''}`;
}
const countries: [RegExp, string][] = [
  [/\b(?:Israel|IL)\b/i, 'IL'],
  [/\b(?:United States|USA|U\.S\.|US)\b/i, 'US'],
  [/\b(?:United Kingdom|UK|Britain)\b/i, 'GB'],
  [/\bJapan\b/i, 'JP'],
  [/\bAustralia\b/i, 'AU'],
  [/\bCanada\b/i, 'CA'],
  [/\bGermany\b/i, 'DE'],
  [/\bItaly\b/i, 'IT'],
  [/\bBulgaria\b/i, 'BG'],
];
export function countryIn(text: string): string | null {
  const found = countries.filter(([re]) => re.test(text)).map(([, code]) => code);
  return found.length === 1 ? found[0] : null;
}
export function sourceEvidence<T>(
  job: Job,
  value: T,
  quote: string,
  provenance: Evidence<T>['provenance'] = 'extracted',
): Evidence<T> {
  return {
    value,
    quote: quote.trim().slice(0, 500),
    provenance,
    url: job.source!.applicationUrl,
    observedAt: job.source!.fetchedAt,
  };
}
export function descriptionSalary(job: Job): Pick<JobFacts, 'salary' | 'salaryText'> {
  const text = job.description;
  const ranges = [
    ...text.matchAll(
      /((?:USD|US\$|ILS|NIS|EUR|GBP|[$€£₪])\s*\d[\d,]*(?:\.\d{1,2})?\s*[kK]?)\s*(?:[-–—�]|to)\s*((?:USD|US\$|ILS|NIS|EUR|GBP|[$€£₪])?\s*\d[\d,]*(?:\.\d{1,2})?\s*[kK]?)(?:\s*(USD|ILS|NIS|EUR|GBP))?/g,
    ),
  ];
  if (!ranges.length) return { salary: null, salaryText: null };
  const m = ranges[0],
    context = text.slice(Math.max(0, m.index! - 160), m.index! + m[0].length + 160);
  const fallback = sourceEvidence(job, m[0], context);
  const amount = (s: string) => Number(s.replace(/[^\d.]/g, '')) * (/[kK]\s*$/.test(s) ? 1000 : 1);
  const min = amount(m[1]),
    max = amount(m[2]);
  const currency = /USD|US\$/i.test(context)
    ? 'USD'
    : /ILS|NIS|₪/i.test(context)
      ? 'ILS'
      : /EUR|€/i.test(context)
        ? 'EUR'
        : /GBP|£/i.test(context)
          ? 'GBP'
          : m[0].includes('$') && countryIn(job.source!.location) === 'US'
            ? 'USD'
            : null;
  const tail = text.slice(m.index! + m[0].length, m.index! + m[0].length + 80);
  const period =
    /(?:annual|yearly)\s+(?:base\s+)?(?:salary|pay|compensation)|(?:salary|pay|compensation)\s+(?:is\s+)?(?:annual|yearly)/i.test(
      context,
    ) || /^\s*(?:per year|a year|annually|yearly|\/year|לשנה)/i.test(tail)
      ? 'year'
      : /monthly\s+(?:base\s+)?(?:salary|pay|compensation)/i.test(context) ||
          /^\s*(?:per month|monthly|\/month|לחודש)/i.test(tail)
        ? 'month'
        : /hourly\s+(?:rate|pay|salary|compensation)/i.test(context) ||
            /^\s*(?:per hour|hourly|\/hour|לשעה)/i.test(tail)
          ? 'hour'
          : null;
  if (
    ranges.some((r) => amount(r[1]) !== min || amount(r[2]) !== max) ||
    !currency ||
    !period ||
    min > max ||
    max > 100_000_000
  )
    return { salary: null, salaryText: fallback };
  return {
    salary: sourceEvidence(
      job,
      {
        min,
        max,
        currency,
        period,
        origin: /^(?:greenhouse|lever)-/.test(job.source!.sourceId ?? '')
          ? /estimat|אומדן|הערכ/i.test(context)
            ? 'estimated'
            : 'employer'
          : 'unknown',
      },
      context,
    ),
    salaryText: fallback,
  };
}
export function arrangementEvidence(job: Job) {
  const rows: Evidence<'onsite' | 'hybrid' | 'remote'>[] = [...(job.facts?.workArrangements ?? [])];
  const add = (value: 'onsite' | 'hybrid' | 'remote', quote: string) => {
    if (!rows.some((r) => r.value === value && r.quote === quote))
      rows.push(sourceEvidence(job, value, quote));
  };
  if (job.workStyle !== 'unknown' && !rows.length) add(job.workStyle, job.source!.location);
  for (const [re, value] of [
    [/\bhybrid\b/i, 'hybrid'],
    [/\bon[ -]?site\b|in.office/i, 'onsite'],
    [/\bremote\b/i, 'remote'],
  ] as const)
    if (re.test(job.source!.location)) add(value, job.source!.location);
  for (const [re, value] of [
    [
      /#LI-Hybrid\b|hybrid (?:work|role|position|model|schedule|flexibility)|עבודה היברידית/i,
      'hybrid',
    ],
    [
      /\bon[ -]?site (?:role|position|work)|(?:role|position|work) (?:is )?on[ -]?site|#LI-Onsite\b|עבודה במשרד/i,
      'onsite',
    ],
    [
      /#LI-Remote\b|(?:fully|100%) remote|remote (?:role|position|opportunity)|עבודה מרחוק/i,
      'remote',
    ],
  ] as const) {
    const m = re.exec(job.description);
    if (m) {
      // Reindexing must replace the old cut excerpt, while retaining provider
      // metadata and conflicting evidence for other arrangements.
      for (let i = rows.length - 1; i >= 0; i--)
        if (
          rows[i].value === value &&
          rows[i].provenance === 'extracted' &&
          rows[i].quote !== job.source!.location &&
          job.description.includes(rows[i].quote)
        )
          rows.splice(i, 1);
      add(value, contextExcerpt(job.description, m.index - 40, m.index + 180));
    }
  }
  const styles = [...new Set(rows.map((r) => r.value))];
  job.workStyle = styles.length === 1 ? styles[0] : 'unknown';
  return { workArrangements: rows, workArrangementConflict: styles.length > 1 };
}
