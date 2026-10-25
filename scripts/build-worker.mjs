import { build } from 'esbuild';
import { readdir, readFile, mkdir, writeFile, copyFile, cp } from 'node:fs/promises';
import { extname } from 'node:path';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};
const assets = {};
async function collect(root, relative = '') {
  for (const item of await readdir(root, { withFileTypes: true })) {
    if (['server', '.openai'].includes(item.name)) continue;
    const part = `${relative}/${item.name}`;
    if (item.isDirectory()) await collect(`${root}/${item.name}`, part);
    else
      assets[part] = {
        body: (await readFile(`${root}/${item.name}`)).toString('base64'),
        type: types[extname(item.name)] ?? 'application/octet-stream',
      };
  }
}
await collect('dist');
await mkdir('dist/server', { recursive: true });
await build({
  entryPoints: ['server/worker.ts'],
  outfile: 'dist/server/index.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  external: ['node:*'],
  plugins: [
    {
      name: 'niva-assets',
      setup(b) {
        b.onResolve({ filter: /^niva:assets$/ }, () => ({ path: 'assets', namespace: 'niva' }));
        b.onLoad({ filter: /.*/, namespace: 'niva' }, () => ({
          contents: `export default ${JSON.stringify(assets)}`,
          loader: 'js',
        }));
      },
    },
  ],
});
await mkdir('dist/.openai', { recursive: true });
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
await cp('drizzle', 'dist/.openai/drizzle', { recursive: true });
await writeFile(
  'dist/server/wrangler.json',
  JSON.stringify(
    {
      name: 'niva-pilot',
      main: 'index.js',
      compatibility_date: '2026-10-24',
      compatibility_flags: ['nodejs_compat'],
      d1_databases: [
        {
          binding: 'DB',
          database_name: 'niva-pilot',
          database_id: '00000000-0000-4000-8000-000000000000',
        },
      ],
    },
    null,
    2,
  ),
);
console.log('Built Angular + Worker ESM with embedded same-origin assets and D1 migrations.');
