import type { Job } from '../src/app/core/models/job';
import type { Category } from '../src/app/core/preferences';

export const FEED_URL = 'https://boards-api.greenhouse.io/v1/boards/appsflyer/jobs?content=true';
export const EMPLOYER_URL = 'https://careers.appsflyer.com/';
export interface Feed {
  jobs: Job[];
  fetchedAt: string;
  stale: boolean;
  error?: string;
}
const text = (value: unknown) => (typeof value === 'string' ? value : '');
// Display provider content as text, never injected HTML. Decode only common text entities.
export function plainText(value: unknown): string {
  return text(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18000);
}
export function classify(title: string): Category | 'other' {
  if (
    /automation.*(?:qa|test)|(?:qa|test).*automation|\bsdet\b|software engineer.*(?:in test|testing)|testing.*software engineer/i.test(
      title,
    )
  )
    return 'qa-automation';
  if (/\bqa\b|quality assurance|manual test/i.test(title)) return 'qa-manual';
  if (/workflow|integration.*automation/i.test(title)) return 'workflow-automation';
  if (/devops|cloud|infrastructure|sre/i.test(title)) return 'devops-cloud';
  if (/data|analyst|analytics/i.test(title)) return 'data-analytics';
  if (/\bit\b|service desk|support engineer/i.test(title)) return 'it-support';
  if (/product (manager|designer)|ux|ui designer/i.test(title))
    return /design|ux/i.test(title) ? 'design' : 'product';
  if (/software|backend|frontend|full.?stack|engineer|developer/i.test(title)) return 'engineering';
  return 'other';
}
export function normalizeFeed(payload: unknown, fetchedAt = new Date().toISOString()): Job[] {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray((payload as { jobs?: unknown }).jobs)
  )
    throw new Error('INVALID_FEED');
  const jobs: Job[] = [];
  for (const item of (payload as { jobs: unknown[] }).jobs.slice(0, 1000)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const location = text((row['location'] as { name?: unknown })?.name);
    // Pilot deliberately covers this employer's explicitly named Israeli office only.
    if (location !== 'Herzliya' || !Number.isSafeInteger(row['id']) || !text(row['title']))
      continue;
    let url: URL;
    try {
      url = new URL(text(row['absolute_url']));
    } catch {
      continue;
    }
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'careers.appsflyer.com' ||
      url.username ||
      url.password
    )
      continue;
    const updated = text(row['updated_at']);
    if (!Number.isFinite(Date.parse(updated))) continue;
    const id = `greenhouse-appsflyer-${row['id']}`;
    if (jobs.some((j) => j.id === id)) continue;
    const title = text(row['title']).slice(0, 200);
    jobs.push({
      id,
      title,
      company: 'AppsFlyer',
      initials: 'AF',
      color: '#e4f1fa',
      district: 'tel-aviv',
      workStyle: 'unknown',
      category: classify(title),
      posted: `עודכן במקור: ${updated.slice(0, 10)}`,
      description: plainText(row['content']) || 'תיאור מלא זמין באתר המעסיק.',
      skills: [],
      reason:
        'מקור: AppsFlyer / Greenhouse. הסיווג לפי כותרת התפקיד, ללא ציון התאמה או ניתוח קורות חיים.',
      offices: [
        {
          id: 'herzliya-city',
          country: 'IL',
          district: 'tel-aviv',
          city: 'הרצליה',
          latitude: 32.16627,
          longitude: 34.82536,
          precision: 'city',
          demonstration: false,
          coordinateSource: 'https://www.geonames.org/294778/herzliya.html',
          verifiedOn: '2026-10-24',
        },
      ],
      source: {
        kind: 'real',
        name: 'AppsFlyer / Greenhouse',
        url: EMPLOYER_URL,
        applicationUrl: url.href,
        updatedAt: new Date(updated).toISOString(),
        fetchedAt,
        location,
        classification: 'סיווג אוטומטי לפי כותרת; סגנון העבודה לא נמסר במקור.',
        active: true,
      },
    });
  }
  return jobs;
}
let current: Feed | undefined;
let pending: Promise<Feed> | undefined;
export async function loadFeed(): Promise<Feed> {
  if (current && Date.now() - Date.parse(current.fetchedAt) < 600000) return current;
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch(FEED_URL, {
        signal: AbortSignal.timeout(10000),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('FEED_UNAVAILABLE');
      const fetchedAt = new Date().toISOString();
      current = { jobs: normalizeFeed(await response.json(), fetchedAt), fetchedAt, stale: false };
      return current;
    } catch {
      if (current) return { ...current, stale: true, error: 'FEED_UNAVAILABLE' };
      throw new Error('FEED_UNAVAILABLE');
    } finally {
      pending = undefined;
    }
  })();
  return pending;
}
export const localRealCatalog = () => current?.jobs ?? [];
