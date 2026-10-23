import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

// Local preview only. Production hosting must provide HTTPS and SPA rewrites.
const root = resolve('dist/niva/browser');
const port = Number(process.env.PORT ?? 4300);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain',
};
createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    const pathname = decodeURIComponent(
      new URL(req.url ?? '/', `http://127.0.0.1:${port}`).pathname,
    );
    let file = resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      if (!(await stat(file)).isFile()) file = resolve(root, 'index.html');
    } catch {
      if (extname(pathname)) {
        res.writeHead(404);
        res.end();
        return;
      }
      file = resolve(root, 'index.html');
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(500);
    res.end('Preview unavailable. Run npm run build first.');
  }
}).listen(port, '127.0.0.1', () => console.log(`Niva preview: http://127.0.0.1:${port}`));
