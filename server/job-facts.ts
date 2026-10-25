import type { Job } from '../src/app/core/models/job';
import type { Evidence, JobFacts } from '../src/app/core/models/discovery';
import { positiveEvidence, SKILLS } from '../src/app/core/matching';
/** Deliberately narrow extraction. Unrecognised, contradictory and optional requirements stay unknown. */
export function enrichJob(job: Job): Job {
  if (!job.source) return job;
  const evidence = <T>(
    value: T,
    quote: string,
    provenance: Evidence<T>['provenance'] = 'extracted',
  ): Evidence<T> => {
    const match =
      typeof value === 'string'
        ? SKILLS[value]?.exec(quote)
        : typeof value === 'number'
          ? new RegExp(`\\b${value}\\+?\\s+years?`, 'i').exec(quote)
          : null;
    const start = match ? Math.max(0, match.index - 60) : 0;
    return {
      value,
      quote: quote.slice(start, start + 300),
      provenance,
      url: job.source!.applicationUrl,
      observedAt: job.source!.fetchedAt,
    };
  };
  const text = job.description;
  const clauses = text
    .split(/\n|[.!?;](?:\s|$)/)
    .map((x) => x.trim())
    .filter(Boolean);
  const optional = /preferred|bonus|advantage|nice.to.have|a plus|יתרון/i;
  // A technology mentioned in responsibilities is not automatically a mandatory requirement.
  const required = clauses.filter(
    (x) =>
      !optional.test(x) &&
      /require|must |proficien|experience (?:with|in)|knowledge of|נדרש|חובה/i.test(x),
  );
  const skillRows = (rows: string[]) =>
    rows.flatMap((x) => positiveEvidence(x).map((s) => evidence(s.skill, x)));
  const years = required
    .map((x) => ({
      x,
      m: x.match(
        /(?:at least\s+|minimum\s+(?:of\s+)?)?(\d{1,2})\+?\s*(?:-|to)\s*\d{1,2}\s+years?\s+(?:of\s+)?(?:relevant |professional )?experience|(?:at least\s+|minimum\s+(?:of\s+)?)?(\d{1,2})\+?\s+years?\s+(?:of\s+)?(?:relevant |professional )?experience/i,
      ),
    }))
    .find((x) => x.m);
  const senior = job.title.match(/\b(junior|senior|lead|principal|director|manager|intern)\b/i);
  const country = clauses
    .map((x) => ({
      x,
      m: x.match(
        /(?:must (?:be |reside |live )?(?:physically )?(?:based|located|living|residing)?\s*(?:in )?|only applicants (?:based |located )?in )(Italy|Israel|United States|United Kingdom|Canada|Germany)\b/i,
      ),
    }))
    .find((x) => x.m);
  const codes: Record<string, string> = {
    italy: 'IT',
    israel: 'IL',
    'united states': 'US',
    'united kingdom': 'GB',
    canada: 'CA',
    germany: 'DE',
  };
  const authorization = clauses
    .map((x) => ({
      x,
      m: x.match(
        /must (?:be (?:legally )?authorized|have (?:the )?(?:legal )?right) to work in (Israel|United States|United Kingdom|Canada|Germany|Italy)\b/i,
      ),
    }))
    .find((x) => x.m);
  const timezone = clauses.find((x) =>
    /(?:must|required|working hours|time.?zone).{0,80}\bUTC[+−-]?\d{0,2}/i.test(x),
  );
  const noSponsor = clauses.find((x) =>
    /(?:cannot|do not|does not|will not|unable to)\s+(?:offer |provide )?(?:visa )?sponsor|no (?:visa )?sponsorship/i.test(
      x,
    ),
  );
  const yesSponsor = clauses.find(
    (x) => /(?:offer|provide)\s+(?:visa )?sponsorship/i.test(x) && !/not|cannot|unable/i.test(x),
  );
  const employment = text.match(/\b(full.time|part.time|contract|internship)\b/i);
  const languages = required.flatMap((x) =>
    [
      ...x.matchAll(
        /(?:fluent|native|proficien\w*)\s+(?:in\s+)?(English|Hebrew|Norwegian|Finnish|German|French)/gi,
      ),
    ].map((m) => evidence(m[1], x)),
  );
  const facts: JobFacts = {
    postingId: job.id,
    employerId: job.source.sourceId ?? null,
    requisitionId: null,
    department: null,
    responsibilities: null,
    requiredSkills: skillRows(required).length ? skillRows(required) : null,
    preferredSkills: skillRows(clauses.filter((x) => optional.test(x))).length
      ? skillRows(clauses.filter((x) => optional.test(x)))
      : null,
    minimumYears: years?.m ? evidence(Number(years.m[1] ?? years.m[2]), years.x) : null,
    seniority: senior ? evidence(senior[1].toLowerCase(), job.title, 'inferred') : null,
    qualifications:
      required
        .filter((x) => /degree|qualification/i.test(x))
        .map((x) => evidence(x.slice(0, 200), x)) || null,
    licenses:
      required
        .filter((x) => /(?:must|required).{0,40}(?:licen[sc]e|certification)/i.test(x))
        .map((x) => evidence(x.slice(0, 200), x)) || null,
    clearance: required.find((x) => /security clearance/i.test(x))
      ? evidence(
          'required',
          required.find((x) => /security clearance/i.test(x))!,
        )
      : null,
    languages: languages.length ? languages : null,
    employmentType: employment
      ? evidence(employment[1].toLowerCase().replace(' ', '-'), employment[0])
      : null,
    applicantCountries: country?.m
      ? evidence([codes[country.m[1].toLowerCase()]], country.x)
      : null,
    timezone: timezone ? evidence(timezone.slice(0, 200), timezone) : null,
    sponsorship: noSponsor
      ? evidence('unavailable', noSponsor)
      : yesSponsor
        ? evidence('available', yesSponsor)
        : null,
    authorizationCountry: authorization?.m
      ? evidence(codes[authorization.m[1].toLowerCase()], authorization.x)
      : null,
    salary: null,
    deadline: null,
  };
  job.facts = { ...facts, ...job.facts };
  if (job.workStyle === 'unknown') {
    if (/\bhybrid\b/i.test(job.source.location)) job.workStyle = 'hybrid';
    else if (/\bon.?site\b/i.test(job.source.location)) job.workStyle = 'onsite';
  }
  return job;
}
