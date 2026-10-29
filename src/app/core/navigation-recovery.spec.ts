import { describe, expect, it } from 'vitest';
import { isModuleLoadError, recoveryPath } from './navigation-recovery';

describe('navigation recovery', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://example.test/chunk-old.js',
    'error loading dynamically imported module: https://example.test/chunk-old.js',
    'Importing a module script failed.',
    'Loading chunk 42 failed.',
  ])('recognizes a browser module failure: %s', (message) => {
    expect(isModuleLoadError(new TypeError(message))).toBe(true);
  });
  it('does not misdiagnose unrelated errors', () => {
    for (const error of [new Error('Failed to fetch'), new Error('invalid profile'), null, {}])
      expect(isModuleLoadError(error)).toBe(false);
  });
  it('only accepts local destinations, preserving query and fragment', () => {
    expect(recoveryPath('/app/preferences?mode=edit#main')).toBe('/app/preferences?mode=edit#main');
    for (const path of ['//example.test', '/\\example.test', 'https://example.test', '/\n/test'])
      expect(recoveryPath(path)).toBeNull();
  });
});
