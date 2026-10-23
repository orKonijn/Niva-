import { Category, District, WorkStyle } from '../preferences';
export interface JobLocation {
  id: string;
  country: 'IL';
  district: District;
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
  id: string;
  title: string;
  company: string;
  initials: string;
  color: string;
  district: District;
  workStyle: WorkStyle;
  category: Category;
  posted: string;
  description: string;
  skills: string[];
  reason: string;
  offices: JobLocation[];
}
