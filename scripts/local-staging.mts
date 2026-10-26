import { resolve } from 'node:path';
if (process.argv[2] !== '--serve') throw Error('Use --serve for isolated loopback staging.');
Object.assign(process.env, {
  NODE_ENV: 'development',
  HOST: '127.0.0.1',
  PORT: '4310',
  BETTER_AUTH_URL: 'http://127.0.0.1:4310',
  NIVA_MAIL_MODE: 'local',
  NIVA_DATA_DIR: resolve('.test-data/staging42'),
  NIVA_SCHEDULE_INGESTION: '0',
  NIVA_ALERT_DELIVERY_ENABLED: '0',
});
for (const key of [
  'SMTP_URL',
  'MAIL_FROM',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'APPLE_CLIENT_ID',
  'APPLE_CLIENT_SECRET',
  'OPENAI_API_KEY',
  'JSEARCH_API_KEY',
  'NIVA_ALERT_URL',
  'NIVA_ALERT_SECRET',
  'NIVA_OPERATOR_ID',
  'NIVA_RESUME_PROCESSOR_URL',
  'NIVA_RESUME_PROCESSOR_KEY',
  'NIVA_BROWSER_TESTS',
  'BETTER_AUTH_SECRET',
])
  delete process.env[key];
await import('../server/index.ts');
