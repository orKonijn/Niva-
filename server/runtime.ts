import { DatabaseSync } from 'node:sqlite';
import { createTransport } from 'nodemailer';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chmodSync } from 'node:fs';
import { configuration } from './config';
import type { AuthOptions } from './auth';
export function runtime() {
  const config = configuration();
  const smtp = process.env['SMTP_URL'];
  const from = process.env['MAIL_FROM'];
  const emailEnabled = config.localMail || !!(smtp && from);
  const browserTestMode = process.env['NIVA_BROWSER_TESTS'] === '1';
  if (browserTestMode && (!config.localMail || process.env['NODE_ENV'] !== 'test'))
    throw new Error('Browser test limits require NODE_ENV=test and the local-only outbox.');
  const transport = smtp ? createTransport(smtp) : null;
  const google =
    process.env['GOOGLE_CLIENT_ID'] && process.env['GOOGLE_CLIENT_SECRET']
      ? {
          clientId: process.env['GOOGLE_CLIENT_ID'],
          clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
        }
      : undefined;
  const apple =
    process.env['APPLE_CLIENT_ID'] && process.env['APPLE_CLIENT_SECRET']
      ? {
          clientId: process.env['APPLE_CLIENT_ID'],
          clientSecret: process.env['APPLE_CLIENT_SECRET'],
        }
      : undefined;
  const options: AuthOptions = {
    ...config,
    emailEnabled,
    emailDelivery: config.localMail ? 'local-outbox' : 'smtp',
    browserTestMode,
    google,
    apple,
    sendMail: async (mail) => {
      if (config.localMail) {
        const outbox = join(config.data, 'outbox');
        await mkdir(outbox, { recursive: true });
        await writeFile(join(outbox, `${randomUUID()}.json`), JSON.stringify(mail), {
          mode: 0o600,
        });
      } else if (transport && from)
        await transport.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text });
      else throw new Error('Email delivery is not configured');
    },
  };
  const database = new DatabaseSync(config.database);
  chmodSync(config.database, 0o600);
  database.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  return { config, database, options };
}
