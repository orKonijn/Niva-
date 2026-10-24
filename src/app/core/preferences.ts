export const CATEGORIES = [
  { id: 'engineering', label: 'פיתוח תוכנה' },
  { id: 'design', label: 'עיצוב וחוויית משתמש' },
  { id: 'product', label: 'ניהול מוצר' },
  { id: 'qa-manual', label: 'בדיקות תוכנה ידניות (QA)' },
  { id: 'qa-automation', label: 'אוטומציית בדיקות תוכנה (QA)' },
  { id: 'workflow-automation', label: 'אוטומציית תהליכים ואינטגרציות' },
  { id: 'devops-cloud', label: 'DevOps ותשתיות ענן' },
  { id: 'data-analytics', label: 'נתונים ואנליטיקה' },
  { id: 'it-support', label: 'IT ותמיכה טכנית' },
] as const;
export const DISTRICTS = [
  { id: 'north', label: 'מחוז הצפון' },
  { id: 'haifa', label: 'מחוז חיפה' },
  { id: 'central', label: 'מחוז המרכז' },
  { id: 'tel-aviv', label: 'מחוז תל אביב' },
  { id: 'jerusalem', label: 'מחוז ירושלים' },
  { id: 'south', label: 'מחוז הדרום' },
] as const;
export const WORK_STYLES = [
  { id: 'onsite', label: 'במשרד' },
  { id: 'hybrid', label: 'היברידי' },
  { id: 'remote', label: 'מרחוק' },
] as const;
export type Category = (typeof CATEGORIES)[number]['id'];
export type District = (typeof DISTRICTS)[number]['id'];
export type WorkStyle = (typeof WORK_STYLES)[number]['id'];
export interface Preferences {
  role: Category | 'all';
  district: District | 'all';
  workStyles: WorkStyle[];
  exclusions: string;
}
export const isCategory = (value: unknown): value is Category =>
  CATEGORIES.some((x) => x.id === value);
export const isDistrict = (value: unknown): value is District =>
  DISTRICTS.some((x) => x.id === value);
export const isWorkStyle = (value: unknown): value is WorkStyle =>
  WORK_STYLES.some((x) => x.id === value);
export const defaultPreferences = (): Preferences => ({
  role: 'all',
  district: 'all',
  workStyles: [],
  exclusions: '',
});
const legacyDistricts: Record<string, District> = {
  'תל אביב': 'tel-aviv',
  הרצליה: 'tel-aviv',
  חיפה: 'haifa',
};
const legacyStyles: Record<string, WorkStyle> = {
  במשרד: 'onsite',
  היברידי: 'hybrid',
  מרחוק: 'remote',
};
export function normalizeWorkStyles(value: unknown): WorkStyle[] {
  const values: unknown[] = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const mapped = values.map((x) =>
    typeof x === 'string' && Object.hasOwn(legacyStyles, x) ? legacyStyles[x] : x,
  );
  return WORK_STYLES.map((x) => x.id).filter((x) => mapped.includes(x));
}
/** Read-time migration; the next serialized mutation writes the canonical v2 shape. */
export function migratePreferences(value: unknown): Preferences {
  if (!value || typeof value !== 'object') return defaultPreferences();
  const raw = value as Record<string, unknown>;
  const location = raw['location'];
  return {
    role: isCategory(raw['role']) ? raw['role'] : 'all',
    district: isDistrict(raw['district'])
      ? raw['district']
      : typeof location === 'string' && Object.hasOwn(legacyDistricts, location)
        ? legacyDistricts[location]
        : 'all',
    workStyles: Array.isArray(raw['workStyles'])
      ? normalizeWorkStyles(raw['workStyles'])
      : location === 'מרחוק'
        ? ['remote']
        : normalizeWorkStyles(typeof raw['model'] === 'string' ? raw['model'] : undefined),
    exclusions: typeof raw['exclusions'] === 'string' ? raw['exclusions'].slice(0, 500) : '',
  };
}
export function validPreferences(value: Preferences): boolean {
  return (
    (value.role === 'all' || isCategory(value.role)) &&
    (value.district === 'all' || isDistrict(value.district)) &&
    Array.isArray(value.workStyles) &&
    value.workStyles.every(isWorkStyle) &&
    typeof value.exclusions === 'string'
  );
}
export function matchesPreferences(
  job: {
    category: Category | 'other';
    district: District | 'unknown';
    workStyle: WorkStyle | 'unknown';
    company: string;
  },
  value: Preferences,
): boolean {
  const excluded = value.exclusions
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return (
    (value.role === 'all' || job.category === value.role) &&
    (value.district === 'all' || job.district === value.district) &&
    (!value.workStyles.length ||
      (isWorkStyle(job.workStyle) && value.workStyles.includes(job.workStyle))) &&
    !excluded.some((x) => job.company.toLowerCase().includes(x))
  );
}
export const districtLabel = (value: District | 'all' | 'unknown'): string =>
  value === 'unknown'
    ? 'מחוז לא נמסר'
    : (DISTRICTS.find((x) => x.id === value)?.label ?? 'כל המחוזות');
export const categoryLabel = (value: Category | 'all'): string =>
  CATEGORIES.find((x) => x.id === value)?.label ?? 'כל התחומים';
export const workStyleLabel = (value: WorkStyle | 'unknown'): string =>
  WORK_STYLES.find((x) => x.id === value)?.label ?? 'סגנון עבודה לא נמסר';
export const workStylesLabel = (values: WorkStyle[]): string =>
  values.length ? values.map(workStyleLabel).join(' / ') : 'כל סגנונות העבודה';
