import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digestFiles, verifiedMapping } from './provenance.mjs';
test('source handoff mapping is order-independent and rejects altered content and unsafe paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'niva-provenance-'));
  try {
    writeFileSync(join(root, 'a'), 'first');
    writeFileSync(join(root, 'b'), 'second');
    const mapping = {
      githubCommit: 'a'.repeat(40),
      files: ['b', 'a'],
      contentDigest: digestFiles(root, ['a', 'b']),
    };
    assert.equal(verifiedMapping(root, mapping), mapping.githubCommit);
    assert.throws(() => verifiedMapping(root, mapping, ['a', 'b', 'extra']), /FILE_SET_MISMATCH/);
    writeFileSync(join(root, 'b'), 'modified');
    assert.throws(() => verifiedMapping(root, mapping), /MISMATCH/);
    assert.throws(() => verifiedMapping(root, { ...mapping, files: ['../secret'] }), /INVALID/);
  } finally {
    rmSync(root, { recursive: true });
  }
});
