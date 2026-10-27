export interface Evidence<T> {
  value: T;
  provenance: 'supplied' | 'extracted' | 'inferred';
  url: string;
  observedAt: string;
  quote: string;
}
export interface CandidateCriteria {
  confirmed: boolean;
  skills: string[];
  yearsExperience: number | null;
  currentCountry: string | null;
  authorizationCountry: string | null;
  workAuthorization: 'unknown' | 'authorized' | 'not-authorized';
  authorizationExclusive?: boolean;
  citizenshipCountry?: string | null;
  citizenshipStatus?: 'unknown' | 'citizen' | 'not-citizen';
  sponsorship: 'unknown' | 'needed' | 'not-needed';
  languages: string[];
  qualifications: string[];
  licenses: string[];
  clearance: 'unknown' | 'none' | 'held';
  salaryMin: number | null;
  currency: string | null;
  period: 'hour' | 'month' | 'year' | null;
  employmentTypes: string[];
  timezone: string | null;
}
export const emptyCriteria = (): CandidateCriteria => ({
  confirmed: false,
  skills: [],
  yearsExperience: null,
  currentCountry: null,
  authorizationCountry: null,
  workAuthorization: 'unknown',
  authorizationExclusive: false,
  citizenshipCountry: null,
  citizenshipStatus: 'unknown',
  sponsorship: 'unknown',
  languages: [],
  qualifications: [],
  licenses: [],
  clearance: 'unknown',
  salaryMin: null,
  currency: null,
  period: null,
  employmentTypes: [],
  timezone: null,
});
export interface JobFacts {
  extractionVersion?: string;
  workArrangements?: Evidence<'onsite' | 'hybrid' | 'remote'>[];
  workArrangementConflict?: boolean;
  citizenshipCountry?: Evidence<string> | null;
  authorizationCondition?: Evidence<string> | null;
  salaryText?: Evidence<string> | null;
  postingId: string;
  employerId: string | null;
  requisitionId: string | null;
  department: Evidence<string> | null;
  responsibilities: Evidence<string>[] | null;
  requiredSkills: Evidence<string>[] | null;
  /** Each group is one requirement satisfied by any listed skill. */
  requiredSkillAlternatives?: Evidence<string[]>[] | null;
  requirementsUnresolved?: boolean;
  preferredSkills: Evidence<string>[] | null;
  minimumYears: Evidence<number> | null;
  seniority: Evidence<string> | null;
  qualifications: Evidence<string>[] | null;
  licenses: Evidence<string>[] | null;
  clearance: Evidence<string> | null;
  languages: Evidence<string>[] | null;
  employmentType: Evidence<string> | null;
  applicantCountries: Evidence<string[]> | null;
  /** Residence constraints, separate from citizenship and work authorization. */
  applicantRegions?: Evidence<string[]> | null;
  locationConditions?: Evidence<string>[] | null;
  opportunity?: Evidence<'talent-pool'> | null;
  timezone: Evidence<string> | null;
  sponsorship: Evidence<'available' | 'unavailable'> | null;
  authorizationCountry: Evidence<string> | null;
  salary: Evidence<{
    min: number | null;
    max: number | null;
    currency: string;
    period: 'hour' | 'month' | 'year';
    origin: 'employer' | 'estimated' | 'unknown';
  }> | null;
  deadline: Evidence<string> | null;
}
