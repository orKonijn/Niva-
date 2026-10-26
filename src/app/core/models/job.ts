import { Category, District, WorkStyle } from '../preferences';
export type DescriptionBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: DescriptionBlock[][] };
export interface JobLocation {
  id: string;
  country: 'IL';
  district: District | 'unknown';
  city: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  precision: 'exact' | 'city' | 'unknown';
  demonstration: boolean;
  coordinateSource?: string;
  verifiedOn?: string;
}
export interface Job {
  facts?: import('./discovery').JobFacts;
  id: string;
  title: string;
  company: string;
  initials: string;
  color: string;
  district: District | 'unknown';
  workStyle: WorkStyle | 'unknown';
  category: Category | 'other';
  posted: string;
  description: string;
  descriptionBlocks?: DescriptionBlock[];
  skills: string[];
  reason: string;
  offices: JobLocation[];
  source?: {
    kind: 'real';
    sourceId?: string;
    publishedAt?: string;
    version?: string;
    attribution?: { name: string; url: string }[];
    name: string;
    url: string;
    applicationUrl: string;
    updatedAt: string;
    fetchedAt: string;
    firstSeenAt?: string | null;
    lastVerifiedAt?: string | null;
    descriptionFetchedAt?: string;
    statusCheckedAt?: string;
    availability?: 'published' | 'closed' | 'unknown';
    applicationCheck?: {
      status: 'reachable' | 'unverified' | 'unavailable';
      checkedAt: string;
      note: string;
    };
    location: string;
    classification: string;
    active: boolean;
  };
}
