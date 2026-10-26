import type { Job } from '../src/app/core/models/job';
import type { District } from '../src/app/core/preferences';
import { classify, normalizeFeed, plainText } from './job-feed';
import type { JobSource } from './job-sources';
import { enrichJob } from './job-facts';
import { sourceEvidence } from './source-evidence';
import { descriptionBlocks } from './description-blocks';
const text = (v: unknown) => (typeof v === 'string' ? v : '');
const cities: { pattern: RegExp; city: string; district: District; lat: number; lng: number }[] = [
  {
    pattern: /tel[ -]?aviv|tel aviv-yafo/i,
    city: 'תל אביב',
    district: 'tel-aviv',
    lat: 32.0853,
    lng: 34.7818,
  },
  {
    pattern: /herzliya|herzlia/i,
    city: 'הרצליה',
    district: 'tel-aviv',
    lat: 32.16627,
    lng: 34.82536,
  },
  { pattern: /giv.?atayim/i, city: 'גבעתיים', district: 'tel-aviv', lat: 32.0723, lng: 34.8089 },
  { pattern: /haifa/i, city: 'חיפה', district: 'haifa', lat: 32.794, lng: 34.9896 },
  { pattern: /jerusalem/i, city: 'ירושלים', district: 'jerusalem', lat: 31.7683, lng: 35.2137 },
  { pattern: /netanya/i, city: 'נתניה', district: 'central', lat: 32.3215, lng: 34.8532 },
  { pattern: /ra.?anana/i, city: 'רעננה', district: 'central', lat: 32.1848, lng: 34.8713 },
  {
    pattern: /petah[ -]?tikva|petach[ -]?tikva/i,
    city: 'פתח תקווה',
    district: 'central',
    lat: 32.084,
    lng: 34.8878,
  },
  {
    pattern: /beer[ -]?sheva|be.er[ -]?sheva/i,
    city: 'באר שבע',
    district: 'south',
    lat: 31.252,
    lng: 34.7915,
  },
  { pattern: /yokneam|yokne.am/i, city: 'יקנעם', district: 'north', lat: 32.6591, lng: 35.1046 },
];
export function normalizeGreenhouse(
  payload: unknown,
  source: JobSource,
  at: string,
  scope: 'israel' | 'global' = 'israel',
): Job[] {
  const rows = (payload as { jobs?: unknown[] } | null)?.jobs;
  const total = (payload as { meta?: { total?: unknown } } | null)?.meta?.total;
  if (
    !Array.isArray(rows) ||
    rows.length > 1000 ||
    (typeof total === 'number' && total !== rows.length) ||
    rows.some(
      (row) =>
        !row ||
        typeof row !== 'object' ||
        !Number.isSafeInteger((row as { id: unknown }).id) ||
        typeof (row as { title: unknown }).title !== 'string',
    )
  )
    throw Error('INCOMPLETE_SOURCE');
  // Preserve existing AppsFlyer IDs, locations and historical saved-job references.
  if (source.board === 'appsflyer' && scope === 'israel') return normalizeFeed(payload, at);
  const jobs = new Map<string, Job>();
  for (const item of rows) {
    const row = item as Record<string, unknown>;
    const location = text((row['location'] as { name?: unknown })?.name);
    const found = cities.filter((c) => c.pattern.test(location));
    // A global remote label alone is never evidence of Israeli eligibility.
    if (scope === 'israel' && !/\bisrael\b/i.test(location) && !found.length) continue;
    let url: URL;
    try {
      url = new URL(text(row['absolute_url']));
    } catch {
      continue;
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !source.allowedHosts.includes(url.hostname) ||
      (url.hostname.endsWith('greenhouse.io') && !url.pathname.startsWith('/' + source.board + '/'))
    )
      continue;
    const title = text(row['title']).slice(0, 200),
      updated = text(row['updated_at']);
    if (!title || !Number.isFinite(Date.parse(updated))) continue;
    const districts = [...new Set(found.map((c) => c.district))];
    const id = `${source.id}-${row['id']}`,
      content = plainText(row['content']);
    const job: Job = {
      id,
      title,
      company: source.company,
      initials: source.company.slice(0, 2).toUpperCase(),
      color: '#e4f1fa',
      district:
        districts.length === 1
          ? districts[0]
          : !districts.length && /\bholon\b|kiryat[ -]?ono/i.test(location)
            ? 'tel-aviv'
            : 'unknown',
      category: classify(title),
      workStyle: /\bremote\b/i.test(location) ? 'remote' : 'unknown',
      posted: `עודכן במקור: ${updated.slice(0, 10)}`,
      description: content || 'תיאור המשרה המלא זמין בקישור המקורי באתר המעסיק.',
      descriptionBlocks: descriptionBlocks(row['content']),
      skills: [],
      reason: `מקור: ${source.name}. סיווג תחום לפי כותרת התפקיד; הסבר התאמה מוצג בנפרד.`,
      offices: found.map((c) => ({
        id: `${source.board}-${c.district}-${c.lat}`,
        country: 'IL',
        district: c.district,
        city: c.city,
        latitude: c.lat,
        longitude: c.lng,
        precision: 'city',
        demonstration: false,
        coordinateSource:
          'https://www.geonames.org/search.html?q=' + encodeURIComponent(c.city) + '&country=IL',
      })),
      source: {
        kind: 'real',
        sourceId: source.id,
        name: source.name,
        url: source.careersUrl,
        applicationUrl: url.href,
        updatedAt: new Date(updated).toISOString(),
        fetchedAt: at,
        publishedAt: Number.isFinite(Date.parse(text(row['first_published'])))
          ? new Date(text(row['first_published'])).toISOString()
          : undefined,
        location,
        active: true,
        classification:
          'תחום לפי כותרת; נקודות עירוניות משוערות בלבד. אופן עבודה לפי מידע מפורש במקור; סתירות נשארות לבירור.',
      },
    };
    enrichJob(job);
    const ranges = Array.isArray(row['pay_input_ranges'])
      ? (row['pay_input_ranges'] as Record<string, unknown>[])
      : [];
    if (ranges.length === 1) {
      const r = ranges[0],
        title = text(r['title']);
      const period = /annual|yearly|per year/i.test(title)
        ? 'year'
        : /monthly|per month/i.test(title)
          ? 'month'
          : /hourly|per hour/i.test(title)
            ? 'hour'
            : null;
      if (
        typeof r['min_cents'] === 'number' &&
        typeof r['max_cents'] === 'number' &&
        r['min_cents'] >= 0 &&
        r['max_cents'] >= r['min_cents'] &&
        r['max_cents'] <= 10_000_000_000 &&
        /^[A-Z]{3}$/.test(text(r['currency_type'])) &&
        period
      )
        job.facts!.salary = sourceEvidence(
          job,
          {
            min: r['min_cents'] / 100,
            max: r['max_cents'] / 100,
            currency: text(r['currency_type']),
            period,
            origin: /estimat/i.test(title) ? 'estimated' : 'employer',
          },
          `${title} ${r['min_cents'] / 100}-${r['max_cents'] / 100} ${r['currency_type']}`,
          'supplied',
        );
    }
    if (Number.isFinite(Date.parse(text(row['application_deadline']))))
      job.facts!.deadline = sourceEvidence(
        job,
        new Date(text(row['application_deadline'])).toISOString(),
        text(row['application_deadline']),
        'supplied',
      );
    if (text(row['requisition_id'])) job.facts!.requisitionId = text(row['requisition_id']);
    const metadata = Array.isArray(row['metadata'])
      ? (row['metadata'] as Record<string, unknown>[])
      : [];
    for (const m of metadata) {
      const name = text(m['name']),
        value = text(m['value']).toLowerCase();
      if (
        /workplace|work style|work model|working model/i.test(name) &&
        /^(?:hybrid|remote|onsite|on-site)$/.test(value)
      ) {
        job.facts!.workArrangements!.push(
          sourceEvidence(
            job,
            value === 'on-site' ? 'onsite' : (value as 'hybrid' | 'remote' | 'onsite'),
            `${name}: ${value}`,
            'supplied',
          ),
        );
      }
    }
    jobs.set(id, enrichJob(job));
  }
  return [...jobs.values()];
}
