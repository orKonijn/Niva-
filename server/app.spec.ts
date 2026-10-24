import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { DatabaseSync } from 'node:sqlite';
import { createBackend, migrateDatabase } from './app';
import type { Mail, AuthOptions } from './auth';
const origin = 'http://127.0.0.1:4300';
describe('real authentication and account API', () => {
  let database: DatabaseSync;
  let backend: ReturnType<typeof createBackend>;
  let mail: Mail[];
  const password = 'A-valid-Niva-password-2026';
  beforeEach(async () => {
    database = new DatabaseSync(':memory:');
    mail = [];
    const options: AuthOptions = {
      origin,
      production: false,
      secret: 'test-only-secret-with-more-than-thirty-two-characters',
      emailEnabled: true,
      sendMail: async (value) => {
        mail.push(value);
      },
      google: { clientId: 'test-google-client', clientSecret: 'test-google-secret' },
      apple: { clientId: 'test-apple-client', clientSecret: 'test-apple-secret' },
    };
    await migrateDatabase(database, options);
    backend = createBackend(database, options);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    database.close();
  });
  const cookies = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
  const send = (path: string, body?: unknown, cookie = '', extra: Record<string, string> = {}) =>
    backend.app.request(origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'X-Niva-CSRF': '1',
        Cookie: cookie,
        'x-niva-client-ip': '127.0.0.1',
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  async function register(email = 'one@example.test') {
    const response = await send('/api/auth/sign-up/email', {
      name: 'משתמש בדיקה',
      email,
      password,
      callbackURL: origin + '/login',
    });
    expect(response.status).toBe(200);
    return response;
  }
  async function login(email = 'one@example.test') {
    await register(email);
    const verification = mail.find(
      (message) => message.to === email && message.subject.includes('אימות'),
    )!;
    expect(verification).toBeTruthy();
    const response = await backend.app.request(verification.text.match(/https?:\/\/\S+/)![0]);
    expect([200, 302]).toContain(response.status);
    const signedIn = await send('/api/auth/sign-in/email', { email, password });
    expect(signedIn.status).toBe(200);
    return cookies(signedIn);
  }
  it('requires email verification, uses HTTP-only cookies, and invalidates sign-out', async () => {
    await register();
    expect(
      (await send('/api/auth/sign-in/email', { email: 'one@example.test', password })).status,
    ).toBe(403);
    const link = mail[0].text.match(/https?:\/\/\S+/)![0];
    await backend.app.request(link);
    const response = await send('/api/auth/sign-in/email', { email: 'one@example.test', password });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(response.headers.get('set-cookie')).toMatch(/SameSite=Lax/i);
    const cookie = cookies(response);
    expect((await send('/api/account/state', undefined, cookie)).status).toBe(200);
    expect((await send('/api/auth/sign-out', {}, cookie)).status).toBe(200);
    expect((await send('/api/account/state', undefined, cookie)).status).toBe(401);
  });
  it('resets passwords with emailed one-use tokens and revokes existing sessions', async () => {
    const cookie = await login();
    expect(
      (
        await send('/api/auth/request-password-reset', {
          email: 'one@example.test',
          redirectTo: origin + '/reset-password',
        })
      ).status,
    ).toBe(200);
    const reset = mail.find((message) => message.subject.includes('איפוס'))!;
    const url = reset.text.match(/https?:\/\/\S+/)![0];
    const redirected = await backend.app.request(url);
    const target = new URL(redirected.headers.get('location')!, origin);
    const token = target.searchParams.get('token');
    expect(token).toBeTruthy();
    expect(
      (await send('/api/auth/reset-password', { token, newPassword: password + '-new' })).status,
    ).toBe(200);
    expect((await send('/api/account/state', undefined, cookie)).status).toBe(401);
    expect((await send('/api/auth/reset-password', { token, newPassword: password })).status).toBe(
      400,
    );
    expect(
      (
        await send('/api/auth/sign-in/email', {
          email: 'one@example.test',
          password: password + '-new',
        })
      ).status,
    ).toBe(200);
  });
  it('denies cross-user reads/writes and rejects caller-supplied ownership', async () => {
    const first = await login();
    const second = await login('two@example.test');
    const saved = await send(
      '/api/account/state',
      { revision: 0, operation: { type: 'saved', jobId: 'manual-qa', value: true } },
      first,
    );
    expect(saved.status).toBe(200);
    const own = await (
      await send('/api/account/state?userId=someone-else', undefined, second, {
        'x-user-id': 'someone-else',
      })
    ).json();
    expect(own.saved).toEqual([]);
    expect(
      (
        await send(
          '/api/account/state',
          { userId: 'someone-else', revision: 0, operation: { type: 'pause', value: true } },
          second,
        )
      ).status,
    ).toBe(400);
    expect((await send('/api/account/state', undefined, '')).status).toBe(401);
    expect((await (await send('/api/account/state', undefined, first)).json()).saved).toEqual([
      'manual-qa',
    ]);
  });
  it('persists across backend instances, rejects expired sessions and keeps methods private', async () => {
    const cookie = await login();
    expect(
      (
        await send(
          '/api/account/state',
          { revision: 0, operation: { type: 'theme', value: 'dark' } },
          cookie,
        )
      ).status,
    ).toBe(200);
    expect(
      backend.states.read(String(database.prepare('SELECT id FROM user').get()!['id'])).theme,
    ).toBe('dark');
    expect(await (await send('/api/account/methods', undefined, cookie)).json()).toEqual({
      methods: ['credential'],
    });
    database.exec('UPDATE session SET expiresAt = 0');
    expect((await send('/api/account/state', undefined, cookie)).status).toBe(401);
  });
  it('serializes concurrent revisions without lost updates', async () => {
    const cookie = await login();
    const responses = await Promise.all(
      ['manual-qa', 'qa-automation'].map((jobId) =>
        send(
          '/api/account/state',
          { revision: 0, operation: { type: 'saved', jobId, value: true } },
          cookie,
        ),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const state = await (await send('/api/account/state', undefined, cookie)).json();
    expect(state.saved).toHaveLength(1);
    expect(state.revision).toBe(1);
  });
  it('previews, validates and deduplicates imports once, without CV/profile upload', async () => {
    const cookie = await login();
    const data = {
      preferences: { location: 'חיפה', model: 'היברידי' },
      saved: ['manual-qa', 'manual-qa', 'unknown'],
      applications: [
        { jobId: 'qa-automation', approvedAt: '2026-01-01T00:00:00Z' },
        { jobId: 'qa-automation', approvedAt: '2026-02-01T00:00:00Z' },
      ],
      paused: true,
      cv: 'DO_NOT_SAVE',
      name: 'DO_NOT_SAVE',
    };
    const preview = await (await send('/api/account/import-preview', data, cookie)).json();
    expect(preview.counts).toEqual({ saved: 1, demoApprovals: 1 });
    expect((await (await send('/api/account/state', undefined, cookie)).json()).saved).toEqual([]);
    const response = await send(
      '/api/account/state',
      {
        revision: preview.revision,
        operation: { type: 'import', data: preview.data, receipt: preview.receipt },
      },
      cookie,
    );
    expect(response.status).toBe(200);
    const state = await response.json();
    expect(state.preferences.district).toBe('haifa');
    expect(state.applications[0].kind).toBe('local-demo');
    expect(JSON.stringify(state)).not.toContain('DO_NOT_SAVE');
    expect((await send('/api/account/import-preview', data, cookie)).status).toBe(409);
    const other = await login('other@privaterelay.appleid.com');
    expect(
      (
        await send(
          '/api/account/state',
          {
            revision: 0,
            operation: { type: 'import', data: preview.data, receipt: preview.receipt },
          },
          other,
        )
      ).status,
    ).toBe(400);
  });
  it('enforces pause and eligibility on server approvals and validates fields', async () => {
    const cookie = await login();
    await send(
      '/api/account/state',
      { revision: 0, operation: { type: 'pause', value: true } },
      cookie,
    );
    expect(
      (
        await send(
          '/api/account/state',
          { revision: 1, operation: { type: 'approve', jobId: 'manual-qa' } },
          cookie,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await send(
          '/api/account/state',
          {
            revision: 1,
            operation: { type: 'profile', value: { name: 'x'.repeat(51), headline: '' } },
          },
          cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await send(
          '/api/account/state',
          { revision: 1, operation: { type: 'saved', jobId: 'invented', value: true } },
          cookie,
        )
      ).status,
    ).toBe(400);
  });
  it('requires same-origin CSRF headers and rejects oversized requests', async () => {
    const cookie = await login();
    const body = { revision: 0, operation: { type: 'pause', value: true } };
    expect(
      (await send('/api/account/state', body, cookie, { Origin: 'https://evil.example' })).status,
    ).toBe(403);
    expect((await send('/api/account/state', body, cookie, { 'X-Niva-CSRF': '' })).status).toBe(
      403,
    );
    expect((await send('/api/account/state', { data: 'x'.repeat(40000) }, cookie)).status).toBe(
      413,
    );
  });
  it('delegates Google and Apple state/PKCE to Better Auth and rejects cancelled/invalid callbacks', async () => {
    for (const provider of ['google', 'apple']) {
      const response = await send('/api/auth/sign-in/social', {
        provider,
        callbackURL: origin + '/app',
        errorCallbackURL: origin + '/login?oauth=error',
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      const url = new URL(data.url);
      expect(url.hostname).toBe(
        provider === 'google' ? 'accounts.google.com' : 'appleid.apple.com',
      );
      expect(url.searchParams.get('state')).toBeTruthy();
      const rejected = await send(
        `/api/auth/callback/${provider}?error=access_denied&state=invalid`,
      );
      expect([302, 400, 401]).toContain(rejected.status);
      expect((await send('/api/session')).status).toBe(200);
      expect((await (await send('/api/session')).json()).user).toBeNull();
    }
    expect(
      (
        await send('/api/auth/link-social', {
          provider: 'google',
          callbackURL: origin + '/account',
        })
      ).status,
    ).toBe(401);
  });
  it('rate-limits auth attempts using persistent database counters', async () => {
    const statuses = [];
    for (let i = 0; i < 10; i++)
      statuses.push(
        (await send('/api/auth/sign-in/email', { email: 'unknown@example.test', password })).status,
      );
    expect(statuses).toContain(429);
  });
  async function mockProviderToken(provider: 'google' | 'apple', email: string) {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = {
      ...(await exportJWK(publicKey)),
      kid: 'local-oidc-fixture',
      alg: 'RS256',
      use: 'sig',
    };
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      if (
        ![
          'https://www.googleapis.com/oauth2/v3/certs',
          'https://appleid.apple.com/auth/keys',
        ].includes(url)
      )
        throw new Error('Unexpected external request in OAuth fixture');
      return Response.json({ keys: [jwk] });
    });
    return new SignJWT({
      email,
      email_verified: true,
      name: 'Local provider fixture',
      nonce: 'fixture-nonce',
    })
      .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
      .setIssuedAt()
      .setExpirationTime('5m')
      .setIssuer(
        provider === 'google' ? 'https://accounts.google.com' : 'https://appleid.apple.com',
      )
      .setAudience(`test-${provider}-client`)
      .setSubject(`${provider}-fixture-subject`)
      .sign(privateKey);
  }
  for (const provider of ['google', 'apple'] as const)
    it(`${provider} signed-token/JWKS fixture validates signature, nonce and account success (not real OAuth)`, async () => {
      const email =
        provider === 'apple' ? 'fixture@privaterelay.appleid.com' : 'fixture@example.test';
      const token = await mockProviderToken(provider, email);
      expect(
        (
          await send('/api/auth/sign-in/social', {
            provider,
            idToken: { token, nonce: 'wrong-nonce' },
          })
        ).status,
      ).toBe(401);
      const response = await send('/api/auth/sign-in/social', {
        provider,
        idToken: { token, nonce: 'fixture-nonce' },
      });
      expect(response.status).toBe(200);
      const cookie = cookies(response);
      expect((await (await send('/api/session', undefined, cookie)).json()).user.email).toBe(email);
      expect(await (await send('/api/account/methods', undefined, cookie)).json()).toEqual({
        methods: [provider],
      });
    });
  it('rejects implicit same-email linking but permits verified explicit linking in a fresh session', async () => {
    const cookie = await login();
    const token = await mockProviderToken('google', 'one@example.test');
    const denied = await send('/api/auth/sign-in/social', {
      provider: 'google',
      idToken: { token, nonce: 'fixture-nonce' },
    });
    expect(denied.status).toBe(401);
    expect(await (await send('/api/account/methods', undefined, cookie)).json()).toEqual({
      methods: ['credential'],
    });
    expect(
      (
        await send(
          '/api/auth/link-social',
          { provider: 'google', idToken: { token, nonce: 'fixture-nonce' } },
          cookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (await (await send('/api/account/methods', undefined, cookie)).json()).methods.sort(),
    ).toEqual(['credential', 'google']);
  });
});
