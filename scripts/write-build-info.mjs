import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
writeFileSync(
  'dist/build-info.json',
  JSON.stringify({ repository: 'orKonijn/Niva-', sourceCommit }, null, 2) + '\n',
);
