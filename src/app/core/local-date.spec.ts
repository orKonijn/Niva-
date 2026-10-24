import { it, expect } from 'vitest';
import { localDate } from './local-date';
it('shows Israel local dates and handles unknown dates', () => {
  expect(localDate('2026-10-24T18:00:00Z')).toContain('21:00');
  expect(localDate('invalid')).toBe('לא נמסר');
  expect(localDate(undefined)).toBe('לא נמסר');
});
