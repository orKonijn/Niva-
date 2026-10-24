import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
export function digestFiles(root, files) {
  const hash = createHash('sha256');
  for (const file of [...files].sort()) {
    hash.update(file.replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(readFileSync(join(root, file)));
    hash.update('\0');
  }
  return hash.digest('hex');
}
export function assetFiles(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap((item) => {
    const file = prefix ? prefix + '/' + item.name : item.name;
    return ['server', '.openai', 'build-info.json'].includes(item.name)
      ? []
      : item.isDirectory()
        ? assetFiles(root, file)
        : [file];
  });
}
export function verifiedMapping(root, mapping, actualFiles = mapping?.files) {
  if (
    !mapping ||
    !/^[a-f0-9]{40}$/.test(mapping.githubCommit) ||
    !Array.isArray(mapping.files) ||
    mapping.files.some(
      (f) => typeof f !== 'string' || f.includes('..') || f.startsWith('/') || f.includes(':'),
    )
  )
    throw new Error('INVALID_SOURCE_MAPPING');
  if (JSON.stringify([...actualFiles].sort()) !== JSON.stringify([...mapping.files].sort()))
    throw new Error('SOURCE_FILE_SET_MISMATCH');
  if (digestFiles(root, mapping.files) !== mapping.contentDigest)
    throw new Error('SOURCE_MAPPING_MISMATCH');
  return mapping.githubCommit;
}
