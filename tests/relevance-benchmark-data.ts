import { normalizeJobicy } from '../server/jobicy-source';
import { emptyCriteria } from '../src/app/core/models/discovery';
import { defaultPreferences } from '../src/app/core/preferences';

/** Frozen synthetic stress cases, not market precision or real vacancies.
 * Labels were set before ranking changes. Held-out cases vary wording/stacks.
 */
export const benchmarkCandidate = {
  ...emptyCriteria(),
  confirmed: true,
  currentCountry: 'IL',
  authorizationCountry: 'IL',
  workAuthorization: 'authorized' as const,
  yearsExperience: 5,
  skills: ['Python', 'SQL', 'Playwright', 'TypeScript', 'React'],
};
export const benchmarkPreferences = { ...defaultPreferences(), role: 'qa-automation' as const };
const at = '2026-10-27T10:00:00Z';
export function relevanceBenchmarkJobs(split: 'development' | 'held-out') {
  const offset = split === 'development' ? 910000 : 920000;
  const rows: { title: string; requirements: string; aligned: boolean; family: boolean }[] = [
    {
      title: 'QA Automation Engineer — Talent Pool',
      requirements: 'Experience with Python and SQL.',
      aligned: false,
      family: true,
    },
    ...Array.from({ length: 4 }, (_, i) => ({
      title:
        split === 'development'
          ? 'QA Automation Engineer'
          : 'Software Development Engineer in Test',
      requirements:
        i % 2 ? 'Experience with Java and Azure.' : 'Experience with Java and Kubernetes.',
      aligned: false,
      family: true,
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      title:
        i === 0
          ? 'Software QA Automation Engineer — Customer Platform'
          : split === 'development'
            ? 'QA Automation Engineer'
            : 'Software Development Engineer in Test',
      requirements:
        i % 2 ? 'Experience with Playwright and SQL.' : 'Experience with Python and SQL.',
      aligned: true,
      family: true,
    })),
    {
      title: 'Manufacturing QA Engineer',
      requirements: 'Experience with Python and SQL.',
      aligned: false,
      family: false,
    },
    {
      title: 'Quality Assurance Specialist — Food Safety',
      requirements: 'Experience with Python and SQL.',
      aligned: false,
      family: false,
    },
    {
      title: 'Frontend Engineer',
      requirements: 'Experience with Angular and Java.',
      aligned: false,
      family: false,
    },
    {
      title: 'Frontend Engineer',
      requirements: 'Experience with React and TypeScript.',
      aligned: true,
      family: false,
    },
    {
      title: 'Senior Frontend Engineer',
      requirements: 'Experience with React and SQL.',
      aligned: true,
      family: false,
    },
  ];
  return rows.map((r, i) => {
    const job = normalizeJobicy(
      {
        jobs: [
          {
            id: offset + i,
            url: `https://jobicy.com/jobs/${offset + i}-synthetic-benchmark`,
            jobTitle: r.title,
            companyName: 'Synthetic Benchmark Employer',
            jobGeo: 'Anywhere',
            jobDescription: `<h2>Requirements</h2><p>${r.requirements}</p><p>Candidates must be located in Israel.</p>`,
            pubDate: at,
          },
        ],
      },
      at,
    )[0];
    job.category = /Frontend/.test(r.title) ? 'engineering' : 'qa-automation';
    return {
      job,
      expectedSkillAligned: r.aligned,
      expectedQaFamily: r.family,
      opportunity: i === 0 ? 'talent-pool' : 'vacancy',
    };
  });
}

export const benchmarkScenarios = [
  { id: 'close-role', query: '', country: '', remote: false },
  { id: 'alternate-title', query: 'QA', related: true, country: '', remote: false },
  { id: 'location-constrained', query: '', country: 'IL', remote: false },
  { id: 'remote-country', query: '', country: 'IL', remote: true },
  { id: 'restrictive-empty', query: 'Unobtainium Researcher', country: 'IL', remote: false },
];
