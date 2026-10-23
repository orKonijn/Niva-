import type { Preferences } from '../preferences';
import { defaultPreferences } from '../preferences';
import type { DemoApplication } from './demo-application';
export interface AccountState {
  revision: number;
  preferences: Preferences;
  saved: string[];
  applications: (DemoApplication & { kind: 'local-demo' })[];
  paused: boolean;
  profile: { name: string; headline: string };
  theme: 'light' | 'dark' | 'system';
  importedAt: string | null;
}
export const emptyAccountState = (): AccountState => ({
  revision: 0,
  preferences: defaultPreferences(),
  saved: [],
  applications: [],
  paused: false,
  profile: { name: '', headline: '' },
  theme: 'system',
  importedAt: null,
});
