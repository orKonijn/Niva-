import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve('.test-data/staging42'),
  config = JSON.parse(readFileSync(resolve(root, 'private-test-access.json'), 'utf8'));
if (config.origin !== 'http://127.0.0.1:4310' || process.argv[2] !== '--local-only')
  throw Error('Local disposable staging only.');
const receipts = [];
for (const account of config.accounts) {
  const response = await fetch(config.origin + '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: config.origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: account.email,
      password: account.password,
      name: `Synthetic ${account.alias} staging`,
    }),
  });
  if (!response.ok) throw Error('STAGING_SIGNUP_FAILED_' + response.status);
  const mails = readdirSync(resolve(root, 'outbox')).map((f) =>
    JSON.parse(readFileSync(resolve(root, 'outbox', f), 'utf8')),
  );
  const mail = mails.find((m) => m.to === account.email && m.subject.includes('אימות'));
  const link = mail?.text.match(/http:\/\/127\.0\.0\.1:4310\/[^\s]+/)?.[0];
  if (!link) throw Error('LOCAL_VERIFICATION_MAIL_NOT_FOUND');
  const verified = await fetch(link, { redirect: 'manual' });
  if (![200, 302, 303].includes(verified.status)) throw Error('STAGING_VERIFICATION_FAILED');
  receipts.push({
    alias: account.alias,
    email: account.email,
    signUpStatus: response.status,
    verificationStatus: verified.status,
  });
}
writeFileSync(
  resolve(root, 'invitation-receipts.json'),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      origin: config.origin,
      receipts,
      access:
        'Use local login with private access file or request password reset and read local-only outbox. No delivery to external email.',
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    accountsCreated: receipts.length,
    verified: true,
    externalMailSent: 0,
    credentialsPrinted: false,
    signInUrl: config.origin + '/login',
  }),
);
