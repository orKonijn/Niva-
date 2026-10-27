import type { Job } from '../src/app/core/models/job';
import type { Evidence, JobFacts } from '../src/app/core/models/discovery';
import { positiveEvidence, SKILLS } from '../src/app/core/matching';
import { requirementClauses } from '../src/app/core/requirements';
import { descriptionText } from '../src/app/core/description-text';
import { descriptionBlockText } from '../src/app/core/description-block-text';
import { evidenceExcerpt } from '../src/app/core/evidence-excerpt';
import { residenceCountries } from './residence-requirements';
import { jobOpportunity } from '../src/app/core/job-opportunity';
import {
  FACT_VERSION,
  arrangementEvidence,
  countryIn,
  descriptionSalary,
  sourceEvidence,
} from './source-evidence';
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
    return {
      value,
      quote: evidenceExcerpt(quote, match?.index ?? 0),
      provenance,
      url: job.source!.applicationUrl,
      observedAt: job.source!.descriptionFetchedAt ?? job.source!.fetchedAt,
    };
  };
  job.description = descriptionText(job.description);
  const blockText = descriptionBlockText(job.descriptionBlocks ?? []);
  const comparable = (s: string) => s.replace(/[\s•]+/gu, '');
  if (blockText && comparable(blockText) === comparable(job.description))
    job.description = blockText;
  const text = job.description;
  const sections = requirementClauses(text);
  const clauses = text
    .split(/\n|[.!?;](?:\s|$)/)
    .map((x) => x.trim())
    .filter(Boolean);
  const required = sections.required;
  // Only a simple explicit skill disjunction is supported. Complex mixed
  // conjunctions stay unknown rather than silently requiring every option.
  const supportedAlternatives = new Set<string>();
  const alternatives = required.flatMap((x) => {
    const scope = x.split(/e\.g\.|such as|for example|at least one|one of/i)[0];
    const options = scope.split(/\bor\b/i).map((s) => positiveEvidence(s).map((e) => e.skill));
    if (options.length > 1 && !/\band\b/i.test(scope) && options.every((s) => s.length === 1)) {
      supportedAlternatives.add(x);
      return [evidence([...new Set(options.flat())], x)];
    }
    return [];
  });
  const skillRows = (rows: string[], mandatory = true) =>
    rows.flatMap((x) => {
      // Examples/alternatives do not each become a mandatory named tool.
      const scope = mandatory ? x.split(/e\.g\.|such as|for example|at least one|one of/i)[0] : x;
      if (mandatory && /\bor\b/i.test(scope)) return [];
      return positiveEvidence(scope).map((s) => evidence(s.skill, x));
    });
  const years = required
    .map((x) => ({
      x,
      m: x.match(
        /(?:at least\s+|minimum\s+(?:of\s+)?)?(\d{1,2})\+?\s*(?:-|to)\s*\d{1,2}\s+years?\s+(?:of\s+)?(?:(?:relevant|professional|hands-on|QA|automation|software|engineering|testing|development)\s+){0,3}experience|(?:at least\s+|minimum\s+(?:of\s+)?)?(\d{1,2})\+?\s+years?\s+(?:of\s+)?(?:(?:relevant|professional|hands-on|QA|automation|software|engineering|testing|development)\s+){0,3}experience/i,
      ),
    }))
    .find((x) => x.m);
  const senior = job.title.match(/\b(junior|senior|lead|principal|director|manager|intern)\b/i);
  const residence = residenceCountries(clauses);
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
    extractionVersion: FACT_VERSION,
    opportunity: (() => {
      const opportunity = jobOpportunity({ ...job, facts: undefined });
      return opportunity ? evidence('talent-pool', opportunity.quote) : null;
    })(),
    ...arrangementEvidence(job),
    postingId: job.id,
    employerId: job.source.sourceId ?? null,
    requisitionId: null,
    department: null,
    responsibilities: sections.responsibilities.length
      ? sections.responsibilities.map((x) => evidence(x, x))
      : null,
    requiredSkills: skillRows(required).length ? skillRows(required) : null,
    requiredSkillAlternatives: alternatives.length ? alternatives : null,
    requirementsUnresolved:
      sections.unresolved.length > 0 ||
      required.some((x) => /\bor\b/i.test(x) && !supportedAlternatives.has(x)),
    preferredSkills: skillRows(sections.preferred, false).length
      ? skillRows(sections.preferred, false)
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
    applicantCountries: residence.countries
      ? evidence(residence.countries, residence.conditions.join('; '))
      : null,
    locationConditions: residence.conditions.length
      ? residence.conditions.map((x) => evidence(x, x))
      : null,
    applicantRegions: (() => {
      const clause = clauses.find(
        (x) =>
          /\bmust\s+(?:be\s+)?(?:located|based|resid(?:e|ing)|liv(?:e|ing))\s+(?:in|within)\s+(?:the\s+)?Schengen\s+(?:Area|Zone)\s*[.!]?$/i.test(
            x,
          ) && !/\b(?:not|no|optional|preferred|bonus|not required)\b/i.test(x),
      );
      return clause ? evidence(['SCHENGEN'], clause) : null;
    })(),
    timezone: timezone ? evidence(timezone.slice(0, 200), timezone) : null,
    sponsorship: noSponsor
      ? evidence('unavailable', noSponsor)
      : yesSponsor
        ? evidence('available', yesSponsor)
        : null,
    authorizationCountry: authorization?.m
      ? evidence(codes[authorization.m[1].toLowerCase()], authorization.x)
      : null,
    ...descriptionSalary(job),
    deadline: null,
  };

  const locationCountry = countryIn(job.source.location);
  const citizen = text.match(
    /(?:U\.S\.|US|United States)\s+citizenship\s+(?:is\s+)?required|must\s+be\s+(?:a\s+)?(?:U\.S\.|US|United States)\s+citizen/i,
  );
  facts.citizenshipCountry = citizen ? evidence('US', citizen[0]) : null;
  const localRights = clauses.find((x) =>
    /(?:must have|must be|requires?|are required to have).{0,60}(?:legal right|legally authori[sz]ed|work authori[sz]ation)/i.test(
      x,
    ),
  );
  facts.authorizationCondition = localRights ? evidence(localRights, localRights) : null;
  if (localRights && !facts.authorizationCountry && locationCountry)
    facts.authorizationCountry = sourceEvidence(
      job,
      locationCountry,
      localRights + ' Source location: ' + job.source.location,
      'inferred',
    );
  if (
    !facts.applicantCountries &&
    !facts.locationConditions?.length &&
    locationCountry &&
    (job.workStyle === 'remote' || facts.workArrangements?.some((r) => r.value === 'remote')) &&
    !job.source.sourceId?.startsWith('jobicy-')
  )
    facts.applicantCountries = sourceEvidence(job, [locationCountry], job.source.location);
  const previous = job.facts;
  // Only actual provider-supplied fields override recomputed extraction. Nulls
  // and obsolete extracted facts must not conceal newly available evidence.
  for (const [key, value] of Object.entries(previous ?? {})) {
    const supplied = Array.isArray(value)
      ? value.length > 0 && value.every((v) => v?.provenance === 'supplied')
      : value &&
        typeof value === 'object' &&
        'provenance' in value &&
        value.provenance === 'supplied';
    if (supplied && key !== 'workArrangements') Object.assign(facts, { [key]: value });
  }
  job.facts = facts;
  return job;
}
