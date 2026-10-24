import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { checkWatchdog, type WatchdogState } from '../server/operator-watchdog.ts';
const names = [
  'NIVA_HEALTH_URL',
  'NIVA_INGEST_SECRET',
  'NIVA_OPERATOR_ID',
  'NIVA_ALERT_URL',
] as const;
if (process.argv.includes('--plan')) {
  console.log(
    JSON.stringify(
      {
        mode: 'plan-only',
        requiredEnvironment: names,
        intervalMinutes: 5,
        independentOfAppScheduler: true,
        hostedDelivery: 'unverified',
        sideEffects: false,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
if (process.argv[2] !== '--run')
  throw new Error(
    'Use --plan, or configure an approved operator endpoint and explicitly use --run',
  );
if (names.some((n) => !process.env[n])) throw new Error('MISSING_WATCHDOG_CONFIGURATION');
const file = resolve(process.env['NIVA_WATCHDOG_STATE'] ?? '.data/operator-watchdog.json');
let previous: WatchdogState = {};
try {
  previous = JSON.parse(readFileSync(file, 'utf8'));
} catch {
  /* First run has no acknowledged alert. */
}
const result = await checkWatchdog(
  {
    healthUrl: process.env['NIVA_HEALTH_URL']!,
    secret: process.env['NIVA_INGEST_SECRET']!,
    operator: process.env['NIVA_OPERATOR_ID']!,
    alertUrl: process.env['NIVA_ALERT_URL']!,
    alertSecret: process.env['NIVA_ALERT_SECRET'],
    siteAuthorization: process.env['NIVA_SITES_SERVICE_TOKEN'],
  },
  previous,
);
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(result.state), { mode: 0o600 });
console.log(JSON.stringify({ status: result.status, reasons: result.reasons }));
if (result.status === 'delivery-failed') process.exitCode = 1;
