import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  DISTRICTS,
  defaultPreferences,
  matchesPreferences,
  migratePreferences,
  normalizeWorkStyles,
} from './preferences';
import { DemoStore, JOBS } from './demo-store';

describe('district and work-style preference migration', () => {
  it.each([
    ['תל אביב', 'tel-aviv'],
    ['הרצליה', 'tel-aviv'],
    ['חיפה', 'haifa'],
    ['all', 'all'],
  ])('maps the legacy location %s to %s', (location, district) => {
    expect(
      migratePreferences({ role: 'engineering', location, model: 'היברידי', exclusions: 'Orbit' }),
    ).toEqual({ role: 'engineering', district, workStyles: ['hybrid'], exclusions: 'Orbit' });
  });
  it('moves a remote geographic preference into work styles, including contradictory legacy pairs', () => {
    expect(migratePreferences({ location: 'מרחוק', model: 'all' })).toMatchObject({
      district: 'all',
      workStyles: ['remote'],
    });
    expect(migratePreferences({ location: 'מרחוק', model: 'היברידי' }).workStyles).toEqual([
      'remote',
    ]);
  });
  it('accepts all/no style, deduplicates arrays and rejects unsupported values without coercion', () => {
    expect(migratePreferences(null)).toEqual(defaultPreferences());
    expect(
      migratePreferences({ location: '__proto__', model: ['היברידי'], role: ['design'] }),
    ).toEqual(defaultPreferences());
    expect(normalizeWorkStyles(['remote', 'hybrid', 'remote', 'unknown', null])).toEqual([
      'hybrid',
      'remote',
    ]);
    expect(
      migratePreferences({
        role: 'qa-automation',
        district: 'haifa',
        workStyles: ['hybrid', 'remote'],
      }),
    ).toMatchObject({ role: 'qa-automation', district: 'haifa', workStyles: ['hybrid', 'remote'] });
    expect(migratePreferences({ model: 'במשרד' }).workStyles).toEqual(['onsite']);
    expect(migratePreferences({ model: 'all' }).workStyles).toEqual([]);
  });
  it('uses OR within styles and AND across district, category and exclusions', () => {
    const preferences = {
      ...defaultPreferences(),
      district: 'tel-aviv' as const,
      workStyles: ['onsite', 'hybrid'] as ('onsite' | 'hybrid')[],
    };
    expect(JOBS.filter((job) => matchesPreferences(job, preferences)).map((job) => job.id)).toEqual(
      ['product-designer', 'frontend-engineer', 'product-manager', 'devops-cloud'],
    );
    expect(
      JOBS.filter((job) => matchesPreferences(job, { ...preferences, role: 'engineering' })).map(
        (job) => job.id,
      ),
    ).toEqual(['frontend-engineer']);
    expect(
      JOBS.filter((job) =>
        matchesPreferences(job, { ...preferences, role: 'engineering', exclusions: 'orbit' }),
      ),
    ).toEqual([]);
    expect(
      JOBS.filter((job) =>
        matchesPreferences(job, {
          ...defaultPreferences(),
          district: 'north',
          workStyles: ['onsite', 'remote'],
        }),
      ).map((job) => job.id),
    ).toEqual(['ux-designer', 'manual-qa']);
  });
  it('provides fixtures in every district and category and keeps the automation fields distinct', () => {
    expect(new Set(JOBS.map((job) => job.district))).toEqual(new Set(DISTRICTS.map((x) => x.id)));
    expect(new Set(JOBS.map((job) => job.category))).toEqual(new Set(CATEGORIES.map((x) => x.id)));
    expect(
      JOBS.filter((job) =>
        matchesPreferences(job, { ...defaultPreferences(), role: 'qa-automation' }),
      ).map((job) => job.id),
    ).toEqual(['qa-automation']);
    expect(
      JOBS.filter((job) =>
        matchesPreferences(job, { ...defaultPreferences(), role: 'workflow-automation' }),
      ).map((job) => job.id),
    ).toEqual(['workflow-automation']);
    expect(JOBS.filter((job) => matchesPreferences(job, defaultPreferences()))).toHaveLength(11);
  });
});

describe('migration preserves unrelated demo state', () => {
  const stores: DemoStore[] = [];
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: (_: string, action: () => unknown) => Promise.resolve().then(action) },
    });
  });
  afterEach(() => stores.forEach((store) => store.ngOnDestroy()));
  it('keeps saved IDs, approval timestamps, exclusions and pause through a canonical write and reload', async () => {
    const approvedAt = '2026-10-23T10:00:00.000Z';
    localStorage.setItem(
      'niva.demo.v1',
      JSON.stringify({
        preferences: {
          role: 'engineering',
          location: 'חיפה',
          model: 'היברידי',
          exclusions: 'Forma',
        },
        saved: ['ux-designer'],
        applications: [{ jobId: 'product-designer', approvedAt }],
        paused: true,
      }),
    );
    const first = new DemoStore();
    stores.push(first);
    expect(first.preferences()).toEqual({
      role: 'engineering',
      district: 'haifa',
      workStyles: ['hybrid'],
      exclusions: 'Forma',
    });
    await first.toggleSaved('frontend-engineer');
    const second = new DemoStore();
    stores.push(second);
    expect(second.saved()).toEqual(['ux-designer', 'frontend-engineer']);
    expect(second.applications()).toEqual([{ jobId: 'product-designer', approvedAt }]);
    expect(second.paused()).toBe(true);
    expect(second.preferences()).toEqual(first.preferences());
    const raw = JSON.parse(localStorage.getItem('niva.demo.v1') ?? '{}');
    expect(raw.version).toBe(2);
    expect(raw.preferences).not.toHaveProperty('model');
    expect(raw.preferences).not.toHaveProperty('location');
  });
});
