import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { safeReturn } from './account-session';
describe('safe authentication return paths', () => {
  it('allows account/job paths and rejects external, protocol-relative and backslash destinations', () => {
    expect(safeReturn('/app/jobs/qa-automation?view=map')).toContain('/app/jobs/');
    for (const path of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/app\\evil.example',
      '/login',
      '/accounting',
      '/app\n',
    ])
      expect(safeReturn(path)).toBe('/app');
  });
});
