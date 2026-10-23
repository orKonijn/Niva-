import { describe, expect, it } from 'vitest';
import { JOBS } from './data/sample-jobs';
import { directionsUrl, groupLocations, usableCoordinates } from './job-locations';
describe('map location integrity', () => {
  it('groups city markers and includes all offices for a multi-office job', () => {
    const groups = groupLocations(JOBS);
    expect(groups.filter((g) => g.jobs.some((j) => j.id === 'fullstack-developer'))).toHaveLength(
      2,
    );
    expect(groups.find((g) => g.office.city === 'תל אביב-יפו')!.jobs.length).toBeGreaterThan(1);
  });
  it('keeps fully remote jobs off the map and missing coordinates explicit', () => {
    expect(groupLocations(JOBS.filter((j) => j.workStyle === 'remote'))).toEqual([]);
    expect(groupLocations(JOBS.filter((j) => j.id === 'manual-qa'))).toEqual([]);
    expect(JOBS.filter((j) => j.workStyle === 'remote').every((j) => !j.offices.length)).toBe(true);
  });
  it('only maps sourced valid coordinates and labels every fixture approximate/demo', () => {
    for (const group of groupLocations(JOBS)) {
      expect(group.office.precision).toBe('city');
      expect(group.office.demonstration).toBe(true);
      expect(group.office.street).toBeUndefined();
      expect(directionsUrl(group.office)).toMatch(/^https:\/\/www.google.com\/maps\/dir\//);
    }
    const office = JOBS[0].offices[0];
    expect(usableCoordinates({ ...office, latitude: 200 })).toBe(false);
    expect(usableCoordinates({ ...office, coordinateSource: undefined })).toBe(false);
  });
});
