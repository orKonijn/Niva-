import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { digestFiles, assetFiles, verifiedMapping } from './provenance.mjs';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sourceCommit = git('rev-parse', 'HEAD');
const files = git('ls-files', '--cached', '--others', '--exclude-standard')
  .split('\n')
  .filter((f) => f && f !== '.openai/reviewed-source.json' && existsSync(f));
const mappingPath = '.openai/reviewed-source.json';
const mapping = existsSync(mappingPath) ? JSON.parse(readFileSync(mappingPath, 'utf8')) : null;
let origin = '';
try {
  origin = git('config', '--get', 'remote.origin.url');
} catch {
  /* No remote does not establish GitHub provenance. */
}
const githubCheckout = /github\.com[:/]orKonijn\/Niva-(?:\.git)?$/i.test(origin);
const githubCommit = mapping
  ? verifiedMapping('.', mapping, files)
  : githubCheckout
    ? sourceCommit
    : null;
const build = {
  repository: 'orKonijn/Niva-',
  sourceCommit,
  githubCommit,
  sitesCommit: mapping ? sourceCommit : null,
  sourceTree: git('rev-parse', 'HEAD^{tree}'),
  sourceContentDigest: digestFiles('.', files),
  digestScope:
    'sorted tracked and non-ignored source paths + NUL + bytes + NUL; excludes source mapping',
  clientArtifactDigest: digestFiles('dist', assetFiles('dist')),
  artifactScope: 'dist static assets excluding server, .openai and build-info.json',
  builtAt: new Date().toISOString(),
  dirty: !!git('status', '--porcelain'),
  mappedSourceVerified: !!mapping,
  provenanceStatus: mapping
    ? 'mapped-reviewed-source'
    : githubCheckout
      ? 'github-checkout'
      : 'unmapped-checkout',
};
writeFileSync('dist/build-info.json', JSON.stringify(build, null, 2) + '\n');
