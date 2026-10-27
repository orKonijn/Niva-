import type { JobFacts } from './models/discovery';

/** Residence only. Reviewed 2026-10-27 against the Council's membership list:
 * https://www.consilium.europa.eu/en/policies/schengen-area/
 * Country membership cannot establish visa, citizenship or work authorization,
 * or residence in an included territory of that country.
 */
const SCHENGEN = new Set(
  'AT BE BG HR CZ DK EE FI FR DE GR HU IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH'.split(
    ' ',
  ),
);
const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
// CLDR names include non-country aggregate/pseudo-regions; never use those as
// evidence of incompatible residence.
const nonCountries = new Set(['ZZ', 'EU', 'EZ', 'UN', 'QO', 'XA', 'XB']);
export function hasApplicantLocationRestriction(f?: JobFacts) {
  return !!(f?.applicantCountries?.value.length || f?.applicantRegions?.value.length);
}
/** false = explicit conflict; null = unresolved; true = country-level fit only. */
export function applicantLocationMatch(
  f: JobFacts | undefined,
  country?: string | null,
): boolean | null {
  if (!country || !hasApplicantLocationRestriction(f)) return null;
  const code = country.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || nonCountries.has(code) || !regionNames.of(code)) return null;
  if (f?.applicantCountries?.value.length && !f.applicantCountries.value.includes(code))
    return false;
  let unresolved = false;
  for (const region of f?.applicantRegions?.value ?? []) {
    if (region !== 'SCHENGEN') {
      unresolved = true;
      continue;
    }
    if (!SCHENGEN.has(code)) return false;
  }
  return unresolved ? null : true;
}
