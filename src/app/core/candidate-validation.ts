import { emptyCriteria, type CandidateCriteria } from './models/discovery';
/** Whitelist fields on both sides; no inferred authorization or nationality. */
export function normalizeCriteria(input: unknown): CandidateCriteria {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('INVALID_CRITERIA');
  const raw = input as Record<string, unknown>,
    value = emptyCriteria();
  if (raw['confirmed'] !== true) throw Error('CONFIRM_CRITERIA');
  value.confirmed = true;
  for (const key of [
    'skills',
    'languages',
    'qualifications',
    'licenses',
    'employmentTypes',
  ] as const) {
    const rows = raw[key];
    if (
      !Array.isArray(rows) ||
      rows.length > 30 ||
      rows.some((x) => typeof x !== 'string' || x.length > 200)
    )
      throw Error('INVALID_CRITERIA');
    value[key] = [...new Set((rows as string[]).map((x) => x.trim()).filter(Boolean))];
  }
  for (const key of ['currentCountry', 'authorizationCountry', 'currency'] as const) {
    const v = raw[key];
    if (
      v != null &&
      (typeof v !== 'string' ||
        !new RegExp(key === 'currency' ? '^[A-Z]{3}$' : '^[A-Z]{2}$').test(v))
    )
      throw Error('INVALID_CRITERIA');
    value[key] = v as string | null;
  }
  for (const key of ['yearsExperience', 'salaryMin'] as const) {
    const v = raw[key];
    if (
      v != null &&
      (typeof v !== 'number' ||
        !Number.isFinite(v) ||
        v < 0 ||
        v > (key === 'yearsExperience' ? 80 : 100000000))
    )
      throw Error('INVALID_CRITERIA');
    value[key] = v as number | null;
  }
  for (const [key, choices] of Object.entries({
    workAuthorization: ['unknown', 'authorized', 'not-authorized'],
    sponsorship: ['unknown', 'needed', 'not-needed'],
    clearance: ['unknown', 'none', 'held'],
    period: [null, 'hour', 'month', 'year'],
  })) {
    if (!choices.includes(raw[key] as never)) throw Error('INVALID_CRITERIA');
    Object.assign(value, { [key]: raw[key] });
  }
  if (
    raw['timezone'] != null &&
    (typeof raw['timezone'] !== 'string' || raw['timezone'].length > 80)
  )
    throw Error('INVALID_CRITERIA');
  value.timezone = raw['timezone'] as string | null;
  return value;
}
