import type { Job } from './models/job';
export function payLabel(job: Job): string {
  const salary = job.facts?.salary?.value;
  if (!salary)
    return job.facts?.salaryText
      ? `שכר מופיע בתיאור: ${job.facts.salaryText.value} · המטבע או התקופה לא חולצו בוודאות`
      : 'לא נמסר במקור';
  const range =
    salary.min == null
      ? `עד ${salary.max}`
      : salary.max == null
        ? `מ־${salary.min}`
        : `${salary.min}–${salary.max}`;
  const period = { hour: 'שעה', month: 'חודש', year: 'שנה' }[salary.period];
  return `${range} ${salary.currency} / ${period} · ${salary.origin === 'estimated' ? 'אומדן שפרסם המקור, לא שכר מובטח' : salary.origin === 'employer' ? 'טווח שפרסם המעסיק' : 'מקור השכר אינו מאומת כמעסיק'}`;
}
