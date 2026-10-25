import { enrichJob } from './job-facts';
import type { Job } from '../src/app/core/models/job';
import { trustedJobUrl } from './job-sources';
import { classify, plainText } from './job-feed';
export function normalizeJobicy(payload: unknown, at: string): Job[] {
  const data = payload as {
    jobs?: Record<string, unknown>[];
    hasMore?: boolean;
    nextCursor?: unknown;
  };
  if (
    !data ||
    !Array.isArray(data.jobs) ||
    data.jobs.length > 1000 ||
    data.hasMore ||
    data.nextCursor
  )
    throw Error('INCOMPLETE_SOURCE');
  return data.jobs.flatMap((row) => {
    const id = `jobicy-israel-qa-${row['id']}`;
    if (
      typeof row['url'] !== 'string' ||
      !trustedJobUrl(id, row['url']) ||
      typeof row['jobTitle'] !== 'string' ||
      typeof row['companyName'] !== 'string'
    )
      return [];
    const published =
      typeof row['pubDate'] === 'string' && Number.isFinite(Date.parse(row['pubDate']))
        ? new Date(row['pubDate']).toISOString()
        : undefined;
    const job: Job = {
      id,
      title: plainText(row['jobTitle']).slice(0, 200),
      company: plainText(row['companyName']).slice(0, 150),
      initials: plainText(row['companyName']).slice(0, 2).toUpperCase(),
      color: '#e4f1fa',
      category: classify(row['jobTitle']),
      district: 'unknown',
      workStyle: 'remote',
      description: plainText(row['jobDescription']),
      skills: [],
      offices: [],
      posted: published ? `פורסם: ${published.slice(0, 10)}` : 'מועד הפרסום לא נמסר',
      reason:
        'Jobicy · עבודה מרחוק. סינון אזורי אינו הוכחת זכאות; עיכוב מקור של 3 שעות. ייתכן שנדרש חשבון אצל המקור.',
      source: {
        kind: 'real',
        sourceId: 'jobicy-israel-qa',
        name: 'Jobicy',
        url: row['url'],
        applicationUrl: row['url'],
        updatedAt: '',
        publishedAt: published,
        fetchedAt: at,
        location: typeof row['jobGeo'] === 'string' ? row['jobGeo'] : 'לא נמסר',
        classification: 'קטגוריה לפי כותרת; remote אינו worldwide. מקור מתגלגל של 7 ימים.',
        active: true,
      },
    };
    enrichJob(job);
    const supplied = <T>(value: T) => ({
      value,
      provenance: 'supplied' as const,
      url: row['url'] as string,
      observedAt: at,
      quote: 'Jobicy API field',
    });
    const type = Array.isArray(row['jobType']) ? row['jobType'][0] : null;
    if (typeof type === 'string') job.facts!.employmentType = supplied(type.toLowerCase());
    const period = ({ yearly: 'year', monthly: 'month', hourly: 'hour' } as const)[
      String(row['salaryPeriod']) as 'yearly' | 'monthly' | 'hourly'
    ];
    if (
      typeof row['salaryCurrency'] === 'string' &&
      period &&
      (typeof row['salaryMin'] === 'number' || typeof row['salaryMax'] === 'number')
    )
      job.facts!.salary = supplied({
        min: typeof row['salaryMin'] === 'number' ? row['salaryMin'] : null,
        max: typeof row['salaryMax'] === 'number' ? row['salaryMax'] : null,
        currency: row['salaryCurrency'],
        period,
        origin: 'unknown',
      });
    return [job];
  });
}
