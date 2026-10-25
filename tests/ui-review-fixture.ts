import type { BrowserContext } from '@playwright/test';
import { emptyAccountState } from '../src/app/core/models/account-state';
import type { Job } from '../src/app/core/models/job';
import type { ResumeVersion } from '../src/app/core/models/career';

export const reviewJobs: Job[] = [0, 1].map((n) => ({
  id: `greenhouse-appsflyer-${801 + n}`,
  title: n ? 'UnbrokenTitle'.repeat(15) : 'QA Engineer — משרת בדיקה',
  company: n ? 'UnbrokenEmployer'.repeat(12) : 'Synthetic Employer',
  initials: 'SE',
  color: '#e4f1fa',
  district: 'tel-aviv',
  workStyle: 'hybrid',
  category: 'qa-automation',
  posted: 'עודכן במקור: 2026-10-25',
  description: 'Synthetic layout fixture only. Python SQL בדיקות תוכנה.',
  skills: ['Python'],
  reason: 'מקור בדיקה בלבד; הסבר התאמה זמין בנפרד.',
  offices: [
    {
      id: 'synthetic-city',
      country: 'IL',
      district: 'tel-aviv',
      city: 'הרצליה',
      latitude: 32.16,
      longitude: 34.82,
      precision: 'city',
      demonstration: true,
    },
  ],
  source: {
    kind: 'real',
    name: 'AppsFlyer / Greenhouse',
    url: 'https://careers.appsflyer.com/',
    applicationUrl: `https://careers.appsflyer.com/jobs/position/${801 + n}`,
    updatedAt: '2026-10-25T00:00:00Z',
    fetchedAt: '2026-10-25T00:00:00Z',
    location: 'Herzliya',
    active: true,
    version: 'synthetic-v1',
    classification: 'Synthetic UI regression fixture',
  },
}));
export const reviewResume: ResumeVersion = {
  id: 'synthetic-original',
  name: 'גרסת בדיקה מקורית',
  text: 'Synthetic Candidate\nPython SQL QA experience 2020–2026',
  confirmed: true,
  active: true,
  kind: 'original',
  createdAt: '2026-10-25T00:00:00Z',
  expiresAt: '2099-10-25T00:00:00Z',
};
export async function reviewFixture(context: BrowserContext, empty = false) {
  const account = emptyAccountState();
  account.saved = reviewJobs.map((j) => j.id);
  const data = {
    resumes: empty ? [] : [structuredClone(reviewResume)],
    deletes: 0,
    chats: [] as Record<string, unknown>[],
    tailors: [] as Record<string, unknown>[],
  };
  await context.addInitScript(() => localStorage.setItem('niva.cookie-choice', 'necessary'));
  await context.route('**/api/**', async (r) => {
    const req = r.request(),
      p = new URL(req.url()).pathname;
    let json: unknown = {};
    if (p === '/api/config')
      json = {
        accounts: true,
        email: true,
        discovery: true,
        realJobs: true,
        google: false,
        apple: false,
      };
    else if (p === '/api/session')
      json = {
        user: {
          id: 'synthetic-review',
          name: 'בדיקת ממשק',
          email: 'synthetic@example.test',
          emailVerified: true,
        },
      };
    else if (p === '/api/account/state') json = account;
    else if (p === '/api/feed')
      json = {
        jobs: reviewJobs,
        total: 2,
        nextCursor: null,
        snapshot: 'synthetic',
        health: [],
        stale: false,
        fetchedAt: '2026-10-25T00:00:00Z',
      };
    else if (p.startsWith('/api/listings/')) {
      json = reviewJobs.find((j) => j.id === p.split('/').at(-1));
      if (!json) return r.fulfill({ status: 404, json: { error: 'NOT_FOUND' } });
    } else if (p === '/api/career/snapshot')
      json = {
        epoch: 'fixture',
        erasure: 'fixture',
        revision: JSON.stringify(data.resumes),
        resumes: data.resumes,
        config: { ai: true, uploads: false, retentionDays: 30, maxUploadBytes: 750000 },
        operations: null,
      };
    else if (p === '/api/career/conversations') json = [];
    else if (p === '/api/career/chat') {
      data.chats.push(req.postDataJSON());
      return r.fulfill({ status: 503, json: { error: 'AI_UNAVAILABLE' } });
    } else if (p === '/api/career/tailor') {
      data.tailors.push(req.postDataJSON());
      json = {
        ...reviewResume,
        id: 'synthetic-tailored',
        active: false,
        kind: 'tailored',
        parentId: reviewResume.id,
      };
    } else if (p.endsWith('/delete')) {
      data.deletes++;
      const id = p.split('/').at(-2);
      data.resumes = data.resumes.filter((x) => x.id !== id);
      await new Promise((resolve) => setTimeout(resolve, 200));
      json = { ok: true };
    } else if (p.startsWith('/api/auth/'))
      return r.fulfill({ status: 503, json: { error: 'SERVICE_UNAVAILABLE' } });
    return r.fulfill({
      json,
      headers: { 'X-Niva-Lifecycle': 'fixture', 'X-Niva-Erasure': 'fixture' },
    });
  });
  return data;
}
