import type { Job } from './models/job';
/** Only explicit source wording; never infer a pool merely from an old date. */
export function jobOpportunity(job: Job) {
  if (job.facts?.opportunity?.value === 'talent-pool')
    return { kind: 'talent-pool' as const, quote: job.facts.opportunity.quote };
  const title =
    /\btalent (?:pool|community)\b|\bexpression of interest\b|\bfuture opportunities\b/i.exec(
      job.title,
    );
  const description =
    /(?:this (?:is|position is)|apply(?:ing)? to|join(?:ing)? (?:our|the))\s+(?:a |our |the )?talent pool\b|\bwe are (?:currently )?(?:building|growing) a talent pool\b/i.exec(
      job.description ?? '',
    );
  const quote = title ? job.title : description?.[0];
  return quote ? { kind: 'talent-pool' as const, quote } : null;
}
