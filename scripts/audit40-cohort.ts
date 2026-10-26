import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { auditJobs, auditFixture } from '../tests/audit40-data';
import { canonicalJobUrl } from '../src/app/core/job-identity';
import { assessJob } from '../src/app/core/job-assessment';
import { defaultPreferences } from '../src/app/core/preferences';
const before = auditJobs(true),
  after = auditJobs();
const summary = (jobs: typeof before) => ({
  sample: jobs.length,
  knownStyle: jobs.filter((j) => j.workStyle !== 'unknown').length,
  conflictingStyle: jobs.filter((j) => j.facts?.workArrangementConflict).length,
  structuredSalary: jobs.filter((j) => j.facts?.salary).length,
  unstructuredSalary: jobs.filter((j) => !j.facts?.salary && j.facts?.salaryText).length,
  entityDescriptions: jobs.filter((j) => /&(?:amp|nbsp|mdash|lt|gt);/.test(j.description)).length,
  uniqueCanonical: new Set(jobs.map((j) => canonicalJobUrl(j.source!.applicationUrl))).size,
  active: jobs.filter((j) => j.source?.active).length,
});
const records = after.map((j, i) => ({
  auditId: auditFixture.results[i].auditId,
  id: j.id,
  title: j.title,
  company: j.company,
  beforeStyle: before[i].workStyle,
  afterStyle: j.workStyle,
  conflict: !!j.facts?.workArrangementConflict,
  required: j.facts?.requiredSkills?.map((x) => x.value),
  preferred: j.facts?.preferredSkills?.map((x) => x.value),
  minimumYears: j.facts?.minimumYears?.value ?? null,
  country: j.facts?.applicantCountries?.value ?? null,
  authorization: j.facts?.authorizationCountry?.value ?? null,
  citizenship: j.facts?.citizenshipCountry?.value ?? null,
  salary: j.facts?.salary?.value ?? null,
  salaryText: j.facts?.salaryText?.value ?? null,
  published: j.source?.publishedAt ?? null,
  updated: j.source?.updatedAt ?? null,
  application: j.source!.applicationUrl,
  unconfirmedScore: assessJob(j, defaultPreferences()).score,
}));
mkdirSync('docs/verification', { recursive: true });
writeFileSync(
  'docs/verification/audit40-cohort.json',
  JSON.stringify(
    {
      observedAt: auditFixture.observedAt,
      scope:
        'Fixed purposive public 20-record cohort; 14 official provider payloads, 6 existing board records; not a current full-catalog field measurement',
      before: summary(before),
      after: summary(after),
      records,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify({ before: summary(before), after: summary(after), records }, null, 2));
import { DatabaseSync } from 'node:sqlite';
import { sqliteCareerDb } from '../server/career-db';
import { discoveryPage } from '../server/discovery';
const sql = new DatabaseSync(':memory:');
for (const m of ['003_career', '004_lifecycle', '005_career_erasure'])
  sql.exec(readFileSync(`server/migrations/${m}.sql`, 'utf8'));
const insert = sql.prepare(
  'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
);
for (const j of after)
  insert.run(
    j.id,
    j.source!.sourceId!,
    canonicalJobUrl(j.source!.applicationUrl),
    j.company.toLowerCase(),
    j.title.toLowerCase(),
    j.district,
    j.category,
    j.workStyle,
    `${j.title} ${j.company}`.toLowerCase(),
    'audit40',
    JSON.stringify(j),
  );
const scenarios = [];
for (const s of auditFixture.scenarios) {
  const q = Object.fromEntries(new URL(s.url).searchParams);
  delete q.cursor;
  const p = await discoveryPage(sqliteCareerDb(sql), 'synthetic', q);
  scenarios.push({
    id: s.id,
    query: q,
    originalAuditTotal: (
      { S1: 4, S2: 7, S3: 6, S4: 1, S4b: 0, S5: 0, S6: 338 } as Record<string, number>
    )[s.id],
    currentPublicTotal: s.total,
    localFixedCohortTotal: p.total,
    ids: p.jobs.map((j) => j.id),
  });
}
sql.close();
writeFileSync(
  'docs/verification/audit40-scenarios.json',
  JSON.stringify(
    {
      scope:
        'Local repaired 20-record cohort is a subset of current catalog. Original/current totals are context, not direct local recall denominators.',
      scenarios,
    },
    null,
    2,
  ) + '\n',
);
