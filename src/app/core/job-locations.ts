import type { Job, JobLocation } from './models/job';
export function usableCoordinates(office: JobLocation): boolean {
  return (
    office.precision !== 'unknown' &&
    Number.isFinite(office.latitude) &&
    Number.isFinite(office.longitude) &&
    Math.abs(office.latitude!) <= 90 &&
    Math.abs(office.longitude!) <= 180 &&
    !!office.coordinateSource
  );
}
export interface LocationGroup {
  key: string;
  office: JobLocation;
  jobs: Job[];
}
export function groupLocations(jobs: readonly Job[]): LocationGroup[] {
  const groups = new Map<string, LocationGroup>();
  for (const job of jobs) {
    if (job.workStyle === 'remote') continue;
    for (const office of job.offices) {
      if (!usableCoordinates(office)) continue;
      const key = `${office.latitude},${office.longitude}:${office.precision}`;
      const group = groups.get(key) ?? { key, office, jobs: [] };
      if (!group.jobs.some((j) => j.id === job.id)) group.jobs.push(job);
      groups.set(key, group);
    }
  }
  return [...groups.values()];
}
export function locationText(office: JobLocation): string {
  return [office.street, office.houseNumber, office.city, office.postalCode]
    .filter(Boolean)
    .join(', ');
}
export function directionsUrl(office: JobLocation): string | null {
  return usableCoordinates(office)
    ? `https://www.google.com/maps/dir/?api=1&destination=${office.latitude},${office.longitude}`
    : null;
}
