import { describe, expect, it } from 'vitest';
import { SOURCES } from './job-sources';
import { normalizeGreenhouse } from './greenhouse-source';
import { hostedAuth, hostedProviders } from './hosted-auth';
import type { HostedAuthEnvironment } from './hosted-auth';
const source = SOURCES.find((s) => s.board === 'gongio')!;
const row = {
  id: 42,
  title: 'QA Automation Engineer',
  location: { name: 'Tel Aviv, Israel' },
  absolute_url: 'https://job-boards.greenhouse.io/gongio/jobs/42',
  updated_at: '2026-10-25T00:00:00Z',
  content: '<p>Playwright &amp; SQL</p>',
};
describe('expanded official job sources', () => {
  it('registers distinct employers with bounded official ATS endpoints', () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(15);
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
    expect(new Set(SOURCES.map((s) => s.company)).size).toBe(SOURCES.length);
    for (const s of SOURCES)
      expect(['boards-api.greenhouse.io', 'api.lever.co', 'jobicy.com']).toContain(
        new URL(s.url).hostname,
      );
  });
  it('keeps employer identity, safe source link and category separate from display labels', () => {
    const [job] = normalizeGreenhouse({ jobs: [row, row] }, source, '2026-10-25T00:01:00Z');
    expect(job.id).toBe('greenhouse-gongio-42');
    expect(job.company).toBe('Gong');
    expect(job.category).toBe('qa-automation');
    expect(job.description).toBe('Playwright & SQL');
    expect(job.workStyle).toBe('unknown');
    expect(job.source?.applicationUrl).toBe(row.absolute_url);
    expect(normalizeGreenhouse({ jobs: [row, row] }, source, 'now')).toHaveLength(1);
  });
  it('does not infer global remote eligibility or trust another board/host', () => {
    for (const change of [
      { location: { name: 'Remote, United States' } },
      { absolute_url: 'https://evil.example/jobs/42' },
      { absolute_url: 'https://job-boards.greenhouse.io/other/jobs/42' },
      { absolute_url: 'https://user:password@job-boards.greenhouse.io/gongio/jobs/42' },
    ])
      expect(normalizeGreenhouse({ jobs: [{ ...row, ...change }] }, source, 'now')).toEqual([]);
    const [remote] = normalizeGreenhouse(
      { jobs: [{ ...row, location: { name: 'Israel, Remote' } }] },
      source,
      'now',
    );
    expect(remote.workStyle).toBe('remote');
    expect(remote.district).toBe('unknown');
    expect(remote.offices).toEqual([]);
  });
  it('retains multiple explicit city areas without inventing a single district', () => {
    const [job] = normalizeGreenhouse(
      { jobs: [{ ...row, location: { name: 'Tel Aviv / Netanya, Israel' } }] },
      source,
      'now',
    );
    expect(job.district).toBe('unknown');
    expect(job.offices.map((o) => o.district)).toEqual(['tel-aviv', 'central']);
    expect(job.offices.every((o) => o.precision === 'city' && !o.demonstration)).toBe(true);
  });
  it('rejects malformed/incomplete snapshots and labels metadata-only descriptions', () => {
    expect(() => normalizeGreenhouse({ jobs: [{ id: 'bad' }] }, source, 'now')).toThrow(
      'INCOMPLETE_SOURCE',
    );
    expect(
      normalizeGreenhouse({ jobs: [{ ...row, content: undefined }] }, source, 'now')[0].description,
    ).toContain('בקישור המקורי');
  });
});
describe('hosted provider activation gates', () => {
  it('never enables a provider without secure origin, signing secret and complete provider credentials', () => {
    const base = { DB: {} as HostedAuthEnvironment['DB'] };
    expect(hostedProviders(base)).toEqual({ google: false, apple: false });
    expect(hostedAuth(base)).toBeNull();
    expect(
      hostedProviders({
        ...base,
        NIVA_PUBLIC_ORIGIN: 'https://niva.example',
        NIVA_AUTH_SECRET: 'x'.repeat(40),
        GOOGLE_CLIENT_ID: 'id',
      }).google,
    ).toBe(false);
    expect(
      hostedProviders({
        ...base,
        NIVA_PUBLIC_ORIGIN: 'https://niva.example',
        NIVA_AUTH_SECRET: 'x'.repeat(40),
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'secret',
      }),
    ).toEqual({ google: true, apple: false });
  });
});
