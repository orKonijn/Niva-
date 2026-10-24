import type { Job } from './models/job';
export function canonicalJobUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()])
    if (/^utm_|^gh_src$/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.href;
}
export function uniqueJobs(jobs: readonly Job[]): Job[] {
  const groups = new Map<string, Job>();
  for (const job of [...jobs].sort(
    (a, b) =>
      Number(b.source?.active !== false) - Number(a.source?.active !== false) ||
      a.id.localeCompare(b.id),
  )) {
    const key = job.source ? canonicalJobUrl(job.source.applicationUrl) : job.id;
    if (!groups.has(key)) groups.set(key, job);
  }
  return [...groups.values()];
}
