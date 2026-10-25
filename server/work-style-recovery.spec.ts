import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { sqliteCareerDb } from './career-db';
import { discoveryPage } from './discovery';
import type { Job } from '../src/app/core/models/job';
import { defaultPreferences, matchesPreferences } from '../src/app/core/preferences';
import { preferenceMatch } from '../src/app/core/matching';
const fixture = JSON.parse(readFileSync('tests/fixtures/qa-work-style-20261025.json', 'utf8')) as {
  jobs: Job[];
};
describe('missing work arrangement is not a known conflict', () => {
  it('serves the real QA regression fixture before pagination without changing saved preferences', async () => {
    const sqlite = new DatabaseSync(':memory:');
    try {
      for (const name of ['003_career', '004_lifecycle', '005_career_erasure'])
        sqlite.exec(readFileSync(`server/migrations/${name}.sql`, 'utf8'));
      const db = sqliteCareerDb(sqlite);
      for (const j of fixture.jobs)
        await db.run(
          'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
          j.id,
          j.source!.sourceId!,
          j.source!.applicationUrl,
          j.company.toLowerCase(),
          j.title.toLowerCase(),
          j.district,
          j.category,
          j.workStyle,
          j.title.toLowerCase(),
          j.source!.version!,
          JSON.stringify(j),
        );
      const prefs = {
        ...defaultPreferences(),
        role: 'qa-automation' as const,
        district: 'tel-aviv' as const,
        workStyles: ['onsite', 'hybrid', 'remote'] as const,
      };
      const preferences = { ...prefs, workStyles: [...prefs.workStyles] };
      const original = structuredClone(preferences);
      const first = await discoveryPage(db, 'regression-secret', { limit: '1' }, preferences);
      expect(first.total).toBe(2);
      expect(first.jobs).toHaveLength(1);
      const second = await discoveryPage(
        db,
        'regression-secret',
        { limit: '1', cursor: first.nextCursor! },
        preferences,
      );
      expect(second.jobs[0].id).not.toBe(first.jobs[0].id);
      expect(
        (await discoveryPage(db, 'regression-secret', { unknownStyle: 'false' }, preferences))
          .total,
      ).toBe(0);
      expect(
        (
          await discoveryPage(
            db,
            'regression-secret',
            { unknownStyle: 'false' },
            defaultPreferences(),
          )
        ).total,
      ).toBe(0);
      expect(
        (
          await discoveryPage(
            db,
            'regression-secret',
            {},
            { ...preferences, workStyles: ['hybrid'] },
          )
        ).total,
      ).toBe(2);
      expect(
        (await discoveryPage(db, 'regression-secret', { district: 'haifa' }, preferences)).total,
      ).toBe(0);
      expect(
        (await discoveryPage(db, 'regression-secret', {}, { ...preferences, exclusions: 'Canopy' }))
          .total,
      ).toBe(1);
      expect(preferences).toEqual(original);
    } finally {
      sqlite.close();
    }
  });
  it('keeps unknown separate from a verified match and still rejects explicit style conflicts', () => {
    const job = fixture.jobs[0],
      prefs = { ...defaultPreferences(), workStyles: ['hybrid' as const] };
    expect(matchesPreferences(job, prefs)).toBe(true);
    expect(matchesPreferences(job, prefs, false)).toBe(false);
    expect(matchesPreferences({ ...job, workStyle: 'remote' }, prefs)).toBe(false);
    const result = preferenceMatch(job, prefs);
    expect(result.factors[2].status).toBe('unknown');
    expect(result.label).toContain('נדרש בירור');
  });
});
