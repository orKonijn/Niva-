import { it, expect, afterEach, describe } from 'vitest';
import { auditJobs, auditFixture } from '../tests/audit40-data';
import { enrichJob } from './job-facts';
import { descriptionText } from '../src/app/core/description-text';
import { defaultPreferences } from '../src/app/core/preferences';
import { emptyCriteria } from '../src/app/core/models/discovery';
import { normalizeCriteria } from '../src/app/core/candidate-validation';
import { passesDiscovery } from '../src/app/core/discovery-filters';
import { assessJob } from '../src/app/core/job-assessment';
import { resumeMatch } from '../src/app/core/matching';
import { payLabel } from '../src/app/core/pay-label';
import { repairHarness } from './repair-harness';
import { discoveryPage } from './discovery';
import { reindexFacts } from './reindex-facts';
import { FACT_VERSION, descriptionSalary } from './source-evidence';
import type { Job } from '../src/app/core/models/job';
import { trustedJobUrl } from '../src/app/core/source-registry';
import { canonicalJobUrl } from '../src/app/core/job-identity';
const jobs = auditJobs();
const publicJob = (n: number) => structuredClone(jobs[n - 1]);
const preferences = defaultPreferences();
const open: ReturnType<typeof repairHarness>[] = [];
it('retains 20 distinct trusted job-specific original routes without pretending form completion', () => {
  expect(new Set(jobs.map((j) => canonicalJobUrl(j.source!.applicationUrl))).size).toBe(20);
  for (const j of jobs) expect(trustedJobUrl(j.id, j.source!.applicationUrl)).toBe(true);
});
afterEach(() => {
  for (const h of open.splice(0)) h.sqlite.close();
});
it('B01 recovers explicit hybrid/onsite while retaining true unknowns and conflicts', () => {
  expect([1, 2, 5, 7].map((n) => publicJob(n).workStyle)).toEqual([
    'hybrid',
    'hybrid',
    'onsite',
    'onsite',
  ]);
  expect(publicJob(3).workStyle).toBe('unknown');
  expect(publicJob(10).workStyle).toBe('unknown');
  expect(publicJob(10).facts!.workArrangementConflict).toBe(true);
  for (const n of [1, 2, 5, 7]) {
    const fact = publicJob(n).facts!.workArrangements![0];
    expect(fact.quote.length).toBeGreaterThan(0);
    expect(fact.url).toMatch(/^https:/);
    expect(fact.observedAt).toBe(auditFixture.observedAt);
  }
});
it('B02/S03 collaboration and bonus scopes never create mandatory gaps, explicit qualifications still do', () => {
  const unframe = publicJob(3);
  expect(unframe.facts!.requiredSkills?.map((x) => x.value)).not.toContain('Product Management');
  expect(resumeMatch(unframe, 'Synthetic candidate Python SQL', true).missing).not.toContain(
    'Product Management',
  );
  const canopy = publicJob(1);
  expect(canopy.facts!.requiredSkills?.map((x) => x.value)).not.toContain('QA Automation');
  expect(canopy.facts!.preferredSkills?.map((x) => x.value)).toContain('QA Automation');
  expect(publicJob(5).facts!.requiredSkills?.map((x) => x.value)).toContain('JavaScript');
  expect(publicJob(5).facts!.requiredSkills?.map((x) => x.value)).not.toContain('Java');
  expect(publicJob(1).facts!.minimumYears?.value).toBe(2);
  expect(publicJob(2).facts!.minimumYears?.value).toBe(5);
  const generic = publicJob(3);
  generic.facts = undefined;
  generic.description = 'Requirements\n4 years of experience as a QA Engineer.';
  enrichJob(generic);
  expect(generic.facts!.requiredSkills).toBeNull();
  const j = publicJob(3);
  j.facts = undefined;
  j.description =
    'Requirements\nExperience in Product Management required.\nPython is not required.\nBonus Points\nExperience with SQL.\nExperience with Docker.\nResponsibilities\nWork closely with product managers to define requirements.';
  enrichJob(j);
  expect(j.facts!.requiredSkills?.map((x) => x.value)).toEqual(['Product Management']);
  expect(j.facts!.preferredSkills?.map((x) => x.value)).toEqual(['SQL', 'Docker']);
  expect(assessJob(j, preferences, '', false).score).toBeNull();
  expect(resumeMatch(j, 'Python SQL', true).missing).toEqual(['Product Management']);
});
it('B03 safely decodes repeated encoding and keeps heading/list order in both languages', () => {
  const html =
    '&amp;lt;h2&amp;gt;דרישות &amp;amp; benefits&amp;lt;/h2&amp;gt;<ul><li>Python&nbsp;SQL</li><li>API &mdash; בדיקות</li></ul><script>globalThis.auditUnsafe=true</script><img src=x onerror="alert(1)">';
  const text = descriptionText(html);
  expect(text).toBe('דרישות & benefits\n\n• Python SQL\n• API — בדיקות');
  expect(text).not.toMatch(/&(?:amp|nbsp|lt|gt|mdash);|<script|onerror|auditUnsafe/);
  for (const n of [1, 2, 3, 4]) {
    expect(publicJob(n).description).not.toMatch(/&(?:amp|nbsp|lt|gt|mdash);/);
    expect(publicJob(n).description.split('\n').length).toBeGreaterThan(5);
  }
});
it('B04 preserves supplied employer estimates and does not invent JFrog periods', () => {
  const ambiguous = publicJob(3);
  ambiguous.description = 'Annual team retreat. Compensation USD100000-120000.';
  expect(descriptionSalary(ambiguous).salary).toBeNull();
  ambiguous.description = 'Annual base salary USD100000-120000.';
  expect(descriptionSalary(ambiguous).salary?.value.period).toBe('year');
  for (const [n, min, max] of [
    [9, 149000, 198000],
    [10, 192000, 240000],
  ]) {
    expect(publicJob(n).facts!.salary!.value).toEqual({
      min,
      max,
      currency: 'USD',
      period: 'year',
      origin: 'estimated',
    });
    expect(publicJob(n).facts!.salary!.provenance).toBe('supplied');
    expect(payLabel(publicJob(n))).toContain('אומדן');
  }
  for (const n of [11, 12]) {
    expect(publicJob(n).facts!.salary).toBeNull();
    expect(publicJob(n).facts!.salaryText).not.toBeNull();
    expect(payLabel(publicJob(n))).toContain('שכר מופיע בתיאור');
  }
  expect(
    passesDiscovery(
      publicJob(10),
      { salaryMin: '200000', currency: 'USD', period: 'year', missing: 'hide' },
      preferences,
    ),
  ).toBe(true);
  expect(
    passesDiscovery(
      publicJob(10),
      { salaryMin: '30000', currency: 'ILS', period: 'month', missing: 'hide' },
      preferences,
    ),
  ).toBe(false);
  expect(
    passesDiscovery(
      publicJob(10),
      { salaryMin: '30000', currency: 'ILS', period: 'month' },
      preferences,
    ),
  ).toBe(true);
  expect(
    passesDiscovery(
      publicJob(11),
      { salaryMin: '1', currency: 'USD', period: 'year', missing: 'hide' },
      preferences,
    ),
  ).toBe(false);
});
it('S01 surfaces exact citizenship/local-rights evidence without inferring candidate rights', () => {
  expect(publicJob(11).facts!.citizenshipCountry!.value).toBe('US');
  const unknown = assessJob(publicJob(11), preferences);
  expect(unknown.blockers).toEqual([]);
  expect(unknown.questions.join(' ')).toContain('אזרחות US');
  const c = {
    ...emptyCriteria(),
    confirmed: true,
    currentCountry: 'US',
    authorizationCountry: 'US',
    workAuthorization: 'authorized' as const,
    citizenshipCountry: 'US',
    citizenshipStatus: 'not-citizen' as const,
  };
  expect(assessJob(publicJob(11), preferences, '', false, c).blockers.join(' ')).toContain(
    'אזרחות US',
  );
  expect(
    assessJob(publicJob(11), preferences, '', false, { ...c, confirmed: false }).blockers,
  ).toEqual([]);
  for (const [n, code] of [
    [13, 'JP'],
    [14, 'GB'],
    [15, 'AU'],
  ] as const) {
    const j = publicJob(n);
    expect(j.facts!.authorizationCountry!.value).toBe(code);
    expect(j.facts!.authorizationCondition!.quote).toContain('legal right');
    expect(j.facts!.sponsorship!.value).toBe('unavailable');
    const candidate = {
      ...emptyCriteria(),
      confirmed: true,
      currentCountry: code,
      authorizationCountry: 'IL',
      workAuthorization: 'authorized' as const,
    };
    expect(assessJob(j, preferences, '', false, candidate).blockers).toEqual([]);
    expect(
      assessJob(j, preferences, '', false, {
        ...candidate,
        authorizationExclusive: true,
      }).blockers.join(' '),
    ).toContain('מוגבל');
  }
});
it('candidate additions validate independently and old profiles preserve unknowns', () => {
  const old = { ...emptyCriteria(), confirmed: true };
  delete old.citizenshipCountry;
  delete old.citizenshipStatus;
  delete old.authorizationExclusive;
  expect(normalizeCriteria(old)).toMatchObject({
    citizenshipStatus: 'unknown',
    citizenshipCountry: null,
    authorizationExclusive: false,
  });
  expect(() => normalizeCriteria({ ...old, citizenshipStatus: 'guessed' })).toThrow(
    'INVALID_CRITERIA',
  );
  expect(() => normalizeCriteria({ ...old, authorizationExclusive: 'yes' })).toThrow(
    'INVALID_CRITERIA',
  );
  expect(() => normalizeCriteria({ ...old, authorizationExclusive: true })).toThrow(
    'INVALID_CRITERIA',
  );
  expect(() => normalizeCriteria({ ...old, citizenshipStatus: 'citizen' })).toThrow(
    'INVALID_CRITERIA',
  );
});
for (const adapter of ['node', 'd1'] as const)
  describe(`audit40 ${adapter} persistence`, () => {
    it('persists explicitly confirmed citizenship and exclusive rights through account reload', async () => {
      const h = repairHarness(adapter);
      open.push(h);
      const value = {
        ...emptyCriteria(),
        confirmed: true,
        citizenshipCountry: 'US',
        citizenshipStatus: 'not-citizen',
        authorizationCountry: 'IL',
        workAuthorization: 'authorized',
        authorizationExclusive: true,
      };
      if (h.repository)
        h.repository.mutate(h.owner, { revision: 0, operation: { type: 'criteria', value } });
      else
        expect(
          (await h.req('account/state', { revision: 0, operation: { type: 'criteria', value } }))
            .status,
        ).toBe(200);
      const state = h.repository
        ? h.repository.read(h.owner)
        : await (await h.req('account/state')).json();
      expect(state.profile.criteria).toMatchObject(value);
    });
    it('reindexes stale public caches in bounded pages before SQL style filtering and preserves cursors', async () => {
      const h = repairHarness(adapter);
      open.push(h);
      const insert = h.sqlite.prepare(
        'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
      );
      for (const j of auditJobs(true))
        insert.run(
          j.id,
          j.source!.sourceId!,
          j.source!.applicationUrl,
          j.company.toLowerCase(),
          j.title.toLowerCase(),
          j.district,
          j.category,
          j.workStyle,
          `${j.title} ${j.company}`.toLowerCase(),
          'old',
          JSON.stringify(j),
        );
      const hybrid = await discoveryPage(h.db, 'audit40', {
        scope: 'all',
        q: 'QA',
        category: 'qa-automation',
        styles: 'hybrid',
        unknownStyle: 'false',
      });
      expect(hybrid.total).toBe(2);
      expect(hybrid.jobs.map((j) => j.company).sort()).toEqual(['Canopy', 'Transmit Security']);
      // Historical Veeva rows lost provider-only workplaceType. Never invent it
      // from an old cache; the next normal source ingestion supplies that fact.
      expect(
        (
          await discoveryPage(h.db, 'audit40', {
            scope: 'all',
            q: 'QA',
            styles: 'onsite',
            unknownStyle: 'false',
          })
        ).total,
      ).toBe(1);
      const veeva = publicJob(7);
      await h.db.run(
        'UPDATE niva_jobs SET style=?,data=? WHERE id=?',
        veeva.workStyle,
        JSON.stringify(veeva),
        veeva.id,
      );
      expect(
        (
          await discoveryPage(h.db, 'audit40', {
            scope: 'all',
            q: 'QA',
            styles: 'onsite',
            unknownStyle: 'false',
          })
        ).total,
      ).toBe(2);
      expect(
        h.sqlite
          .prepare(
            "SELECT count(*) n FROM niva_jobs WHERE json_extract(data,'$.facts.extractionVersion')=?",
          )
          .get(FACT_VERSION),
      ).toEqual({ n: 20 });
      const rows = h.sqlite.prepare('SELECT id,version FROM niva_jobs ORDER BY id').all();
      await reindexFacts(h.db);
      expect(h.sqlite.prepare('SELECT id,version FROM niva_jobs ORDER BY id').all()).toEqual(rows);
      const first = await discoveryPage(h.db, 'audit40', { scope: 'all', limit: '5' });
      const next = await discoveryPage(h.db, 'audit40', {
        scope: 'all',
        limit: '5',
        cursor: first.nextCursor!,
      });
      expect(new Set([...first.jobs, ...next.jobs].map((j) => j.id)).size).toBe(10);
    });
  });

it('numeric terminology coverage separates positive, negative and unknown evidence', () => {
  const j = publicJob(3);
  j.facts = undefined;
  j.description = 'Requirements\nPython and SQL experience required.';
  enrichJob(j);
  expect(resumeMatch(j, 'Built Python services and SQL queries', true).coverage).toBe(1);
  expect(resumeMatch(j, 'No Python, SQL', true).coverage).toBe(0);
  expect(resumeMatch(j, 'Python SQL', false).coverage).toBeNull();
  expect(assessJob(j, preferences).score).toBeNull();
});
it('bounded discovery scans beyond 128 rows without losing totals or cursor entries', async () => {
  const h = repairHarness('node');
  open.push(h);
  const insert = h.sqlite.prepare(
    'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
  );
  for (let i = 0; i < 260; i++) {
    const j = publicJob(1);
    j.id = 'greenhouse-canopycare-' + (8000000000 + i);
    j.source!.applicationUrl =
      'https://job-boards.greenhouse.io/canopycare/jobs/' + (8000000000 + i);
    insert.run(
      j.id,
      j.source!.sourceId!,
      j.source!.applicationUrl,
      'canopy',
      j.title,
      j.district,
      j.category,
      j.workStyle,
      'qa',
      'test',
      JSON.stringify(j),
    );
  }
  const ids = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await discoveryPage(h.db, 'synthetic', {
      scope: 'all',
      limit: '50',
      ...(cursor ? { cursor } : {}),
    });
    expect(page.total).toBe(260);
    for (const j of page.jobs) {
      expect(ids.has(j.id)).toBe(false);
      ids.add(j.id);
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  expect(ids.size).toBe(260);
});

it('upgrades a cold 5000-row public cache within the paid D1 invocation budget', async () => {
  const h = repairHarness('d1');
  open.push(h);
  const insert = h.sqlite.prepare(
    'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
  );
  const oldJob = auditJobs(true)[0];
  h.sqlite.exec('BEGIN');
  for (let i = 0; i < 5000; i++) {
    const j = structuredClone(oldJob);
    j.id = 'greenhouse-canopycare-' + (7000000000 + i);
    j.source!.applicationUrl =
      'https://job-boards.greenhouse.io/canopycare/jobs/' + (7000000000 + i);
    insert.run(
      j.id,
      j.source!.sourceId!,
      j.source!.applicationUrl,
      'canopy',
      j.title,
      j.district,
      j.category,
      j.workStyle,
      'qa',
      'old',
      JSON.stringify(j),
    );
  }
  h.sqlite.exec('COMMIT');
  let calls = 0;
  const db = {
    ...h.db,
    all: async <T>(sql: string, ...args: (string | number | null)[]) => {
      calls++;
      return h.db.all<T>(sql, ...args);
    },
    batch: async (rows: Parameters<typeof h.db.batch>[0]) => {
      calls++;
      return h.db.batch(rows);
    },
  };
  const result = await discoveryPage(db, 'cold-cache', {
    scope: 'all',
    styles: 'hybrid',
    unknownStyle: 'false',
    limit: '50',
  });
  expect(result.total).toBe(5000);
  expect(result.jobs).toHaveLength(50);
  expect(calls).toBeLessThan(1000);
  expect(h.sqlite.prepare("SELECT count(*) n FROM niva_jobs WHERE style='hybrid'").get()).toEqual({
    n: 5000,
  });
}, 30000);
