export interface JobSource {
  id: string;
  provider: 'greenhouse' | 'lever' | 'jobicy';
  board: string;
  company: string;
  name: string;
  url: string;
  careersUrl: string;
  allowedHosts: readonly string[];
  cadence: number;
  verification?: {
    date: string;
    discoveryUrl: string;
    scope: string;
    access: string;
    upstreamDelay: string;
    review: string;
  };
}
const greenhouse = (board: string, company: string, host: string, content = true): JobSource => ({
  id: `greenhouse-${board}`,
  provider: 'greenhouse',
  board,
  company,
  name: `${company} / Greenhouse`,
  url: `https://boards-api.greenhouse.io/v1/boards/${board}/jobs${content ? '?content=true' : ''}`,
  careersUrl: `https://${host}${host.includes('greenhouse.io') ? '/' + board : ''}`,
  allowedHosts: [host],
  cadence: 900_000,
  verification: {
    date: '2026-10-25',
    discoveryUrl: `https://${host}${host.includes('greenhouse.io') ? '/' + board : ''}`,
    scope:
      'Worldwide published postings from this employer board; no worldwide applicant eligibility inferred',
    access: 'Public Job Board GET; no general redisplay licence inferred',
    upstreamDelay: 'Unknown',
    review: 'Quarterly registry and employer permission review; Niva owner',
  },
});
// Explicit employer boards verified against their public ATS endpoints. No user-supplied URLs.
// Large global boards use metadata-only snapshots; full descriptions remain at the employer link.
export const SOURCES: readonly JobSource[] = [
  greenhouse('appsflyer', 'AppsFlyer', 'careers.appsflyer.com'),
  {
    id: 'lever-walkme',
    provider: 'lever',
    board: 'walkme',
    company: 'WalkMe',
    name: 'WalkMe / Lever',
    url: 'https://api.lever.co/v0/postings/walkme?mode=json&limit=100',
    careersUrl: 'https://jobs.lever.co/walkme',
    allowedHosts: ['jobs.lever.co'],
    cadence: 900_000,
    verification: {
      date: '2026-10-25',
      discoveryUrl: 'https://jobs.lever.co/walkme',
      scope: 'Worldwide WalkMe published postings; not worldwide eligibility',
      access: 'Public company-scoped GET; no general redisplay licence inferred',
      upstreamDelay: 'Unknown',
      review: 'Quarterly registry and employer permission review; Niva owner',
    },
  },
  greenhouse('gongio', 'Gong', 'job-boards.greenhouse.io'),
  greenhouse('wizinc', 'Wiz', 'www.wiz.io'),
  greenhouse('taboola', 'Taboola', 'www.taboola.com'),
  greenhouse('elastic', 'Elastic', 'jobs.elastic.co', false),
  greenhouse('datadog', 'Datadog', 'careers.datadoghq.com', false),
  greenhouse('optimove', 'Optimove', 'job-boards.eu.greenhouse.io'),
  greenhouse('jfrog', 'JFrog', 'join.jfrog.com'),
  greenhouse('orcasecurity', 'Orca Security', 'orca.security'),
  greenhouse('torq', 'Torq', 'job-boards.greenhouse.io'),
  greenhouse('forter', 'Forter', 'job-boards.greenhouse.io'),
  greenhouse('similarweb', 'Similarweb', 'job-boards.greenhouse.io'),
  greenhouse('riskified', 'Riskified', 'www.riskified.com'),
  greenhouse('yotpo', 'Yotpo', 'www.yotpo.com'),
  greenhouse('pendo', 'Pendo', 'job-boards.greenhouse.io'),
  greenhouse('via', 'Via', 'job-boards.greenhouse.io'),
  greenhouse('canopycare', 'Canopy', 'job-boards.greenhouse.io'),
  greenhouse('unframe', 'Unframe', 'job-boards.eu.greenhouse.io'),
  greenhouse('aidocmedical', 'Aidoc', 'job-boards.eu.greenhouse.io'),
  {
    ...greenhouse('transmitsecurity', 'Transmit Security', 'www.transmitsecurity.com'),
    careersUrl: 'https://transmitsecurity.com/about/careers',
    verification: {
      date: '2026-10-25',
      discoveryUrl: 'https://transmitsecurity.com/about/careers',
      scope: 'Worldwide published employer postings',
      access:
        'Public Greenhouse GET; attribution and original links; independent redisplay licence not inferred',
      upstreamDelay: 'Unknown',
      review: 'Quarterly employer/source review; Niva owner',
    },
  },
  {
    ...greenhouse('wedev', 'WeDev', 'job-boards.eu.greenhouse.io'),
    verification: {
      date: '2026-10-25',
      discoveryUrl: 'https://job-boards.eu.greenhouse.io/wedev',
      scope: 'Worldwide published employer postings; current QA role is manual',
      access:
        'Public Greenhouse GET; attribution and original links; independent redisplay licence not inferred',
      upstreamDelay: 'Unknown',
      review: 'Quarterly employer/source review; Niva owner',
    },
  },
  {
    id: 'lever-veeva-israel',
    provider: 'lever',
    board: 'veeva',
    company: 'Veeva',
    name: 'Veeva / Lever',
    url: 'https://api.lever.co/v0/postings/veeva?mode=json&location=Israel%20-%20Kiryat%20Ono&limit=100',
    careersUrl: 'https://jobs.lever.co/veeva',
    allowedHosts: ['jobs.lever.co'],
    cadence: 900000,
    verification: {
      date: '2026-10-25',
      discoveryUrl: 'https://jobs.lever.co/veeva/fdca1089-4737-4b89-8fa7-03c36262d3ab',
      scope: 'Location-scoped Israel – Kiryat Ono, not global Veeva coverage',
      access:
        'Public Lever GET; attribution and original links; independent redisplay licence not inferred',
      upstreamDelay: 'Unknown',
      review: 'Quarterly employer/source review; Niva owner',
    },
  },
  {
    id: 'jobicy-israel-qa',
    provider: 'jobicy',
    board: 'israel-qa',
    company: 'Jobicy',
    name: 'Jobicy · remote jobs',
    url: 'https://jobicy.com/api/jobs?count=200',
    careersUrl: 'https://jobicy.com',
    allowedHosts: ['jobicy.com'],
    cadence: 3600000,
    verification: {
      date: '2026-10-25',
      discoveryUrl: 'https://jobicy.com/jobs-rss-feed',
      scope:
        'Worldwide remote roles in all fields; latest 1000 per hourly pass, rolling partial window; not eligibility proof',
      access:
        'Explicit public commercial reuse with source attribution; public application may require registration',
      upstreamDelay: '3 hours; rolling 7 days',
      review: 'Quarterly API/terms review; Niva owner',
    },
  },
];
/** One registry for ingestion and browser validation. Never accept arbitrary feed redirects. */
export function trustedJobUrl(id: string, value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    return SOURCES.some((source) => {
      if (!id.startsWith(source.id + '-') || !source.allowedHosts.includes(url.hostname))
        return false;
      const suffix = id.slice(source.id.length + 1);
      if (source.provider === 'jobicy')
        return /^\d+$/.test(suffix) && url.pathname.startsWith(`/jobs/${suffix}-`);
      if (source.provider === 'lever')
        return /^[a-z0-9-]{10,80}$/i.test(suffix) && url.pathname === `/${source.board}/${suffix}`;
      return (
        /^\d+$/.test(suffix) &&
        (!url.hostname.endsWith('greenhouse.io') ||
          url.pathname === `/${source.board}/jobs/${suffix}`)
      );
    });
  } catch {
    return false;
  }
}
