import { Category, District, WorkStyle } from '../preferences';
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
}
