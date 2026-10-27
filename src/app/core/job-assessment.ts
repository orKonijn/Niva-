import type { Job } from './models/job';
import type { CandidateCriteria } from './models/discovery';
import type { Preferences } from './preferences';
import { positiveEvidence, requiredSkillGroups } from './matching';
import { applicantLocationMatch, hasApplicantLocationRestriction } from './applicant-location';
export const FIT_VERSION = 'fit-v3';
export const eligibilityLabel = (s: string) =>
  ({ blocked: 'חסם מפורש', confirmation: 'נדרש בירור', clear: 'לא נמצא חסם ידוע' })[s] ??
  'נדרש בירור';
export function assessJob(
  job: Job,
  preferences: Preferences,
  resume = '',
  confirmed = false,
  candidate?: CandidateCriteria,
  now = Date.now(),
) {
  const p = candidate?.confirmed ? candidate : undefined;
  const f = job.facts;
  const blockers: string[] = [],
    questions: string[] = [],
    strengths: string[] = [],
    gaps: string[] = [];
  if (
    (job.source?.active === false && job.source?.availability !== 'unknown') ||
    job.source?.availability === 'closed'
  )
    blockers.push('המשרה אינה מפורסמת עוד במקור');
  if (f?.deadline && Date.parse(f.deadline.value) < now) blockers.push('מועד ההגשה חלף');
  if (applicantLocationMatch(f, p?.currentCountry) === false)
    blockers.push(
      `המקור מגביל מגורים ל־${f?.applicantCountries?.value.join(', ') ?? ''}${f?.applicantRegions?.value.includes('SCHENGEN') ? 'אזור שנגן' : ''}; הפרופיל מציין ${p?.currentCountry}`,
    );
  if (!hasApplicantLocationRestriction(f) || !p?.currentCountry)
    questions.push('יש לברר מדינות מותרות למועמדים; עבודה מרחוק אינה אישור לעבודה מכל מדינה');
  if (f?.applicantRegions)
    questions.push(
      `יש לאמת מגורים בפועל באזור הנדרש; אין בכך אישור עבודה או אזרחות: ${f.applicantRegions.quote}`,
    );
  if (f?.locationConditions?.length && !f.applicantCountries)
    questions.push(
      ...f.locationConditions.map((e) => `מגבלת מגורים שלא פורשה בביטחון: ${e.quote}`),
    );
  if (f?.requirementsUnresolved)
    questions.push(
      'גבולות סעיפי הדרישות לא נשמרו במקור השמור; יש לבדוק דרישות חובה ויתרון בעמוד המקורי',
    );
  if (f?.sponsorship?.value === 'unavailable' && p?.sponsorship === 'needed')
    blockers.push('נדרשת חסות אשרה ובמקור נאמר שאין חסות');
  if (!f?.sponsorship || !p || p.sponsorship === 'unknown') questions.push('חסות אשרה לא אומתה');
  if (
    f?.authorizationCountry &&
    p?.authorizationCountry === f.authorizationCountry.value &&
    p.workAuthorization === 'not-authorized'
  )
    blockers.push('דרישת אישור העבודה סותרת את הפרופיל המאושר');
  if (!f?.authorizationCountry || !p || p.workAuthorization === 'unknown')
    questions.push('יש לברר אישור עבודה במדינת ההעסקה');
  if (
    f?.authorizationCountry &&
    p?.authorizationExclusive &&
    p.authorizationCountry &&
    p.authorizationCountry !== f.authorizationCountry.value
  )
    blockers.push(
      `נדרש אישור עבודה ב־${f.authorizationCountry.value}; אושר בפרופיל שאישור העבודה מוגבל ל־${p.authorizationCountry}`,
    );
  else if (f?.authorizationCountry && p?.authorizationCountry !== f.authorizationCountry.value)
    questions.push(
      `המקור דורש אישור עבודה ב־${f.authorizationCountry.value}; אישור במדינה אחרת אינו מוכיח או שולל אותו`,
    );
  if (f?.authorizationCondition) questions.push(`תנאי המקור: ${f.authorizationCondition.quote}`);
  if (f?.citizenshipCountry) {
    if (
      p?.citizenshipCountry === f.citizenshipCountry.value &&
      p.citizenshipStatus === 'not-citizen'
    )
      blockers.push(`המקור דורש אזרחות ${f.citizenshipCountry.value}; בפרופיל אושר שאין אזרחות זו`);
    else if (
      p?.citizenshipCountry !== f.citizenshipCountry.value ||
      p.citizenshipStatus !== 'citizen'
    )
      questions.push(
        `המקור דורש אזרחות ${f.citizenshipCountry.value}: ${f.citizenshipCountry.quote}. מצב המועמד אינו מאומת`,
      );
  }
  if (f?.workArrangementConflict)
    questions.push('מקורות אופן העבודה סותרים; הסגנון נשאר לא ידוע עד לבירור');
  for (const field of ['languages', 'qualifications', 'licenses'] as const) {
    for (const requirement of f?.[field] ?? [])
      if (!p?.[field].some((x) => x.toLowerCase() === requirement.value.toLowerCase()))
        questions.push(`דרישה לבדיקה: ${requirement.value}`);
  }
  if (f?.clearance && p?.clearance === 'none')
    blockers.push('המקור דורש סיווג ביטחוני; בפרופיל אושר שאין סיווג');
  else if (f?.clearance && p?.clearance !== 'held') questions.push('יש לברר סיווג ביטחוני');
  if (!job.source?.applicationCheck || job.source.applicationCheck.status !== 'reachable')
    questions.push('מסלול ההגשה טרם אומת; יש לבדוק באתר המקור');
  if (job.source?.availability === 'unknown') questions.push('מצב הפרסום אינו מאומת כרגע');
  if (job.workStyle === 'remote')
    questions.push(
      f?.timezone
        ? `יש לבדוק שעות עבודה ואזור זמן: ${f.timezone.value}`
        : 'אזורי זמן ושעות חפיפה לעבודה מרחוק לא אומתו',
    );
  if (f?.clearance && p?.clearance === 'held')
    questions.push('יש לבדוק סוג סיווג ביטחוני ותוקף מול הדרישה המקורית');
  if (
    p?.employmentTypes.length &&
    f?.employmentType &&
    !p.employmentTypes.includes(f.employmentType.value)
  )
    gaps.push(`סוג העסקה מחוץ להעדפות: ${f.employmentType.value}`);
  const groups = f ? requiredSkillGroups(job) : [];
  const required = groups.map((g) => g.join(' / '));
  const evidence = confirmed ? positiveEvidence(resume) : [];
  const skills = [...new Set([...evidence.map((x) => x.skill), ...(p?.skills ?? [])])];
  const matched = groups
    .filter((g) => g.some((x) => skills.some((s) => s.toLowerCase() === x.toLowerCase())))
    .map((g) => g.join(' / '));
  strengths.push(...matched.map((x) => `עדות למונח ${x}`));
  gaps.push(
    ...required
      .filter((x) => !matched.includes(x))
      .map((x) => `אין עדות בפרופיל: ${x} (לא הוכחת חוסר ניסיון)`),
  );
  const dimensions = [
    {
      key: 'skills',
      label: 'מונחי כישורים',
      weight: 35,
      known: confirmed && required.length >= 2,
      ratio: required.length ? matched.length / required.length : 0,
      evidence: `${matched.join(', ') || 'אין עדות משותפת'} / ${required.join(', ') || 'דרישות לא חולצו בביטחון'}`,
    },
    {
      key: 'experience',
      label: 'ניסיון',
      weight: 25,
      known: p?.yearsExperience != null && f?.minimumYears != null,
      ratio:
        p?.yearsExperience != null && f?.minimumYears
          ? Math.min(1, p.yearsExperience / Math.max(1, f.minimumYears.value))
          : 0,
      evidence: `${p?.yearsExperience ?? 'לא נמסר'} שנות ניסיון בפרופיל; מינימום במקור: ${f?.minimumYears?.value ?? 'לא נמסר'}`,
    },
    {
      key: 'role',
      label: 'תחום התפקיד',
      weight: 15,
      known: preferences.role !== 'all' && job.category !== 'other',
      ratio: preferences.role === job.category ? 1 : 0,
      evidence: `${preferences.role} / ${job.category} · סיווג כותרת משוער`,
    },
    {
      key: 'work',
      label: 'מיקום וסגנון עבודה',
      weight: 15,
      known:
        preferences.district !== 'all' &&
        !!preferences.workStyles.length &&
        job.district !== 'unknown' &&
        job.workStyle !== 'unknown',
      ratio:
        (preferences.district === job.district ||
          job.offices.some((x) => x.district === preferences.district)) &&
        preferences.workStyles.some((x) => x === job.workStyle)
          ? 1
          : 0,
      evidence: `${job.source?.location ?? job.district} / ${job.workStyle}; העדפות: ${preferences.district} / ${preferences.workStyles.join(', ')}`,
    },
    {
      key: 'salary',
      label: 'שכר',
      weight: 10,
      known:
        p?.salaryMin != null &&
        !!f?.salary &&
        f.salary.value.origin === 'employer' &&
        p.currency === f.salary.value.currency &&
        p.period === f.salary.value.period &&
        (f.salary.value.max ?? f.salary.value.min) != null,
      ratio:
        p?.salaryMin != null &&
        f?.salary &&
        (f.salary.value.max ?? f.salary.value.min ?? 0) >= p.salaryMin
          ? 1
          : 0,
      evidence: f?.salary
        ? `${JSON.stringify(f.salary.value)}; מינימום מבוקש ${p?.salaryMin ?? 'לא נמסר'}`
        : 'שכר לא נמסר; אין השלמת אומדן',
    },
  ].map((x) => ({ ...x, points: x.known ? Math.round(x.weight * x.ratio * 10) / 10 : 0 }));
  const knownWeight = dimensions.filter((x) => x.known).reduce((s, x) => s + x.weight, 0);
  const score =
    confirmed && required.length >= 2 && knownWeight >= 60
      ? Math.round(dimensions.reduce((s, x) => s + x.points, 0))
      : null;
  const fields = [
    f?.requiredSkills ?? f?.requiredSkillAlternatives,
    f?.minimumYears,
    f?.employmentType,
    f?.applicantCountries ?? f?.applicantRegions,
    f?.sponsorship,
    f?.salary,
    f?.deadline,
    f?.languages,
  ];
  const completeness = Math.round((fields.filter((x) => x != null).length / fields.length) * 100);
  const confidence =
    !confirmed || knownWeight < 60
      ? 'נמוכה'
      : knownWeight >= 85 && f?.requiredSkills?.every((x) => x.provenance === 'supplied')
        ? 'גבוהה'
        : 'בינונית';
  return {
    method: FIT_VERSION,
    jobVersion: job.source?.version ?? 'unknown',
    score,
    skillsScore:
      confirmed && required.length >= 2
        ? Math.round((matched.length / required.length) * 100)
        : null,
    skillsCoverage: { matched: matched.length, required: required.length },
    dimensions,
    knownWeight,
    completeness,
    confidence,
    eligibility: blockers.length ? 'blocked' : questions.length ? 'confirmation' : 'clear',
    blockers,
    questions,
    strengths,
    gaps,
    evidence,
  };
}
