import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Theme } from './theme';
describe('appearance preference', () => {
  const services: Theme[] = [];
  let dark = false;
  let systemChanged: (() => void) | undefined;
  beforeEach(() => {
    localStorage.clear();
    dark = false;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        get matches() {
          return dark;
        },
        addEventListener: (_: string, listener: () => void) => {
          systemChanged = listener;
        },
        removeEventListener: () => {},
      }),
    });
  });
  afterEach(() => {
    services.forEach((service) => service.ngOnDestroy());
    services.length = 0;
    vi.restoreAllMocks();
  });
  const create = () => {
    const service = new Theme();
    services.push(service);
    return service;
  };
  it('defaults to system and responds to live system changes', () => {
    const theme = create();
    expect(theme.preference()).toBe('system');
    expect(document.documentElement.dataset['theme']).toBe('light');
    dark = true;
    systemChanged?.();
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
  it('persists an explicit choice and ignores system changes until System is selected', () => {
    const theme = create();
    theme.select('dark');
    expect(localStorage.getItem('niva.theme')).toBe('dark');
    systemChanged?.();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(create().preference()).toBe('dark');
    theme.select('system');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });
  it('restores cross-tab choices and treats invalid stored values as system', () => {
    const theme = create();
    localStorage.setItem('niva.theme', 'dark');
    window.dispatchEvent(new StorageEvent('storage', { key: 'niva.theme' }));
    expect(theme.preference()).toBe('dark');
    localStorage.setItem('niva.theme', 'invalid');
    window.dispatchEvent(new StorageEvent('storage', { key: 'niva.theme' }));
    expect(theme.preference()).toBe('system');
  });
  it('changes the current theme and reports unavailable persistence truthfully', () => {
    const theme = create();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => theme.select('dark')).not.toThrow();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(theme.notice()).toBeTruthy();
  });
});
