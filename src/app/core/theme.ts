import { Injectable, signal } from '@angular/core';
export type ThemePreference = 'system' | 'light' | 'dark';
export const parseTheme = (value: unknown): ThemePreference =>
  value === 'light' || value === 'dark' ? value : 'system';
@Injectable({ providedIn: 'root' })
export class Theme {
  accountSelection: ((value: ThemePreference) => void) | null = null;
  applyAccount(value: ThemePreference): void {
    this.preference.set(value);
    this.apply();
  }
  restoreGuest(): void {
    this.preference.set(this.read());
    this.apply();
  }
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  readonly preference = signal<ThemePreference>(this.readInitial());
  private readInitial(): ThemePreference {
    const value = document
      .querySelector('meta[name="niva-account-theme"]')
      ?.getAttribute('content');
    return value ? parseTheme(value) : this.read();
  }
  readonly notice = signal('');
  constructor() {
    this.apply();
    this.media.addEventListener('change', this.onSystemChange);
    window.addEventListener('storage', this.onStorage);
  }
  private read(): ThemePreference {
    try {
      return parseTheme(localStorage.getItem('niva.theme'));
    } catch {
      return 'system';
    }
  }
  private apply(): void {
    const preference = this.preference();
    const resolved = preference === 'system' ? (this.media.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset['theme'] = resolved;
    document.documentElement.dataset['themePreference'] = preference;
    document.documentElement.style.colorScheme = resolved;
    document.documentElement.style.backgroundColor = resolved === 'dark' ? '#0e1727' : '#f7faff';
  }
  select(value: string): void {
    const preference = parseTheme(value);
    this.preference.set(preference);
    this.apply();
    try {
      if (this.accountSelection) {
        this.accountSelection(preference);
        return;
      }
      localStorage.setItem('niva.theme', preference);
      this.notice.set('');
    } catch {
      this.notice.set('ערכת הנושא עודכנה לביקור הנוכחי בלבד. האחסון אינו זמין.');
    }
  }
  private readonly onSystemChange = (): void => {
    if (this.preference() === 'system') this.apply();
  };
  private readonly onStorage = (event: StorageEvent): void => {
    if (this.accountSelection) return;
    if (event.key === 'niva.theme' || event.key === null) {
      this.preference.set(this.read());
      this.apply();
    }
  };
  ngOnDestroy(): void {
    this.media.removeEventListener('change', this.onSystemChange);
    window.removeEventListener('storage', this.onStorage);
  }
}
