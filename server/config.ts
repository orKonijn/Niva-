import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function configuration() {
  const production = process.env['NODE_ENV'] === 'production';
  const origin = process.env['BETTER_AUTH_URL'] ?? 'http://127.0.0.1:4300';
  const parsed = new URL(origin);
  if (parsed.origin !== origin || (production && parsed.protocol !== 'https:'))
    throw new Error('BETTER_AUTH_URL must be a single origin; production requires HTTPS.');
  const data = resolve(process.env['NIVA_DATA_DIR'] ?? '.data');
  mkdirSync(data, { recursive: true, mode: 0o700 });
  let secret = process.env['BETTER_AUTH_SECRET'];
  if (!secret && !production) {
    const file = resolve(data, 'development-secret');
    if (!existsSync(file))
      writeFileSync(file, randomBytes(48).toString('base64url'), { mode: 0o600 });
    secret = readFileSync(file, 'utf8');
  }
  if (!secret || secret.length < 32 || secret === 'replace-with-at-least-32-random-characters')
    throw new Error('Set a server-only BETTER_AUTH_SECRET of at least 32 random characters.');
  const localMail = process.env['NIVA_MAIL_MODE'] === 'local';
  if (localMail && (production || !['127.0.0.1', 'localhost'].includes(parsed.hostname)))
    throw new Error('Local outbox is restricted to non-production loopback use.');
  return { production, origin, secret, data, database: resolve(data, 'niva.sqlite'), localMail };
}
