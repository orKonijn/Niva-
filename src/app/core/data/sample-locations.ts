import type { Job, JobLocation } from '../models/job';
const cities = {
  telAviv: {
    id: 'tel-aviv-city',
    city: 'תל אביב-יפו',
    district: 'tel-aviv',
    latitude: 32.08088,
    longitude: 34.78057,
    coordinateSource: 'https://www.geonames.org/293397/tel-aviv.html',
  },
  haifa: {
    id: 'haifa-city',
    city: 'חיפה',
    district: 'haifa',
    latitude: 32.81303,
    longitude: 34.99928,
    coordinateSource: 'https://www.geonames.org/294801/haifa.html',
  },
  jerusalem: {
    id: 'jerusalem-city',
    city: 'ירושלים',
    district: 'jerusalem',
    latitude: 31.76904,
    longitude: 35.21633,
    coordinateSource: 'https://www.geonames.org/281184/jerusalem.html',
  },
  beerSheva: {
    id: 'beer-sheva-city',
    city: 'באר שבע',
    district: 'south',
    latitude: 31.25181,
    longitude: 34.7913,
    coordinateSource: 'https://www.geonames.org/295530/beersheba.html',
  },
} satisfies Record<string, Partial<JobLocation>>;
function city(key: keyof typeof cities): JobLocation {
  return {
    ...cities[key],
    country: 'IL',
    precision: 'city',
    demonstration: true,
    verifiedOn: '2026-10-24',
  };
}
/** Fictional employer/city associations. Coordinates identify cities, never employer premises. */
export function sampleOffices(job: Omit<Job, 'offices'>): JobLocation[] {
  if (job.workStyle === 'remote') return [];
  if (job.id === 'fullstack-developer') return [city('haifa'), city('telAviv')];
  if (job.district === 'north')
    return [
      {
        id: 'north-unspecified',
        country: 'IL',
        district: 'north',
        city: 'לא נמסרה עיר',
        precision: 'unknown',
        demonstration: true,
      },
    ];
  if (job.district === 'haifa') return [city('haifa')];
  if (job.district === 'jerusalem') return [city('jerusalem')];
  if (job.district === 'south') return [city('beerSheva')];
  if (job.district === 'tel-aviv') return [city('telAviv')];
  return [
    {
      id: `${job.district}-unspecified`,
      country: 'IL',
      district: job.district,
      city: 'לא נמסרה עיר',
      precision: 'unknown',
      demonstration: true,
    },
  ];
}
