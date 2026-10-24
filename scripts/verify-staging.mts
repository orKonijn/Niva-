import { verifyStagingReads } from '../server/staging-readiness.ts';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const plan = JSON.parse(readFileSync('docs/verification/staging-gates.json', 'utf8'));
if (process.argv[2] === '--read-only') {
  const required = [
    'NIVA_STAGING_ORIGIN',
    'NIVA_STAGING_ALICE_COOKIE',
    'NIVA_STAGING_BOB_COOKIE',
    'NIVA_STAGING_ALICE_RESUME_ID',
    'NIVA_STAGING_SYNTHETIC_MARKER',
  ];
  if (required.some((n) => !process.env[n])) throw new Error('MISSING_STAGING_ENVIRONMENT');
  const checks = await verifyStagingReads({
    origin: process.env['NIVA_STAGING_ORIGIN']!,
    directOrigin: process.env['NIVA_STAGING_DIRECT_ORIGIN'],
    aliceCookie: process.env['NIVA_STAGING_ALICE_COOKIE']!,
    bobCookie: process.env['NIVA_STAGING_BOB_COOKIE']!,
    aliceResumeId: process.env['NIVA_STAGING_ALICE_RESUME_ID']!,
    syntheticMarker: process.env['NIVA_STAGING_SYNTHETIC_MARKER']!,
    disposable: process.env['NIVA_STAGING_DISPOSABLE'] === '1',
    siteAuthorization: process.env['NIVA_STAGING_SERVICE_TOKEN'],
  });
  console.log(JSON.stringify({ mode: 'read-only', checks }, null, 2));
  process.exit(checks.every((c) => c.status === 'passed') ? 0 : 2);
}
if (process.argv[2] !== '--plan')
  throw new Error(
    'Use --plan; approved disposable staging supports --read-only. No write/provider mode exists.',
  );
const result = {
  generatedAt: new Date().toISOString(),
  mode: 'plan-only',
  networkRequests: 0,
  gates: plan.cases.map((c: { id: string; status: string; requires: string[] }) => ({
    id: c.id,
    status: c.status,
    requires: c.requires,
  })),
  next: 'Follow docs/staging-verification.md with separately authorized disposable staging infrastructure; unverified is never pass.',
};
mkdirSync('.test-data/review-20261025', { recursive: true });
writeFileSync('.test-data/review-20261025/staging-plan.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
