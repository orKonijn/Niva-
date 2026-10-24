// Local preparation only. Never commits, pushes, deploys or changes a Site.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { digestFiles } from './provenance.mjs';
const destination = process.argv[2];
if (!destination) throw new Error('Supply a new destination directory');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain'))
  throw new Error('Commit and review the source before preparing a handoff');
const target = resolve(destination);
if (existsSync(target)) throw new Error('Destination must not exist');
const files = git('ls-files').split('\n').filter(Boolean);
mkdirSync(target, { recursive: true });
for (const file of files) {
  mkdirSync(dirname(resolve(target, file)), { recursive: true });
  copyFileSync(file, resolve(target, file));
}
mkdirSync(resolve(target, '.openai'), { recursive: true });
writeFileSync(
  resolve(target, '.openai/reviewed-source.json'),
  JSON.stringify(
    { githubCommit: git('rev-parse', 'HEAD'), contentDigest: digestFiles('.', files), files },
    null,
    2,
  ) + '\n',
);
console.log('Prepared reviewed source locally at ' + target);
