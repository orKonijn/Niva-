export interface JobSource {
  id: string;
  provider: 'greenhouse' | 'lever';
  board: string;
  company: string;
  name: string;
  url: string;
  careersUrl: string;
  allowedHosts: readonly string[];
  cadence: number;
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
});
// Explicit employer boards verified against their public ATS endpoints. No user-supplied URLs.
// Large global boards use metadata-only snapshots; full descriptions remain at the employer link.
export const SOURCES: readonly JobSource[] = [
  { ...greenhouse('appsflyer', 'AppsFlyer', 'careers.appsflyer.com'), cadence: 600_000 },
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
];
