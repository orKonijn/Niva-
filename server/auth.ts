import { betterAuth } from 'better-auth';
import type { DatabaseSync } from 'node:sqlite';
export interface Mail {
  to: string;
  subject: string;
  text: string;
}
export interface AuthOptions {
  origin: string;
  secret: string;
  production: boolean;
  emailEnabled: boolean;
  emailDelivery?: 'local-outbox' | 'smtp';
  browserTestMode?: boolean;
  sendMail: (mail: Mail) => Promise<void>;
  google?: { clientId: string; clientSecret: string };
  apple?: { clientId: string; clientSecret: string };
}
export function createAuth(database: DatabaseSync, options: AuthOptions) {
  if (
    options.browserTestMode &&
    (options.production || !['127.0.0.1', 'localhost'].includes(new URL(options.origin).hostname))
  )
    throw new Error('Browser test limits require non-production loopback hosting.');
  return betterAuth({
    appName: 'Niva',
    database,
    baseURL: options.origin,
    secret: options.secret,
    trustedOrigins: [options.origin, ...(options.apple ? ['https://appleid.apple.com'] : [])],
    emailAndPassword: {
      enabled: options.emailEnabled,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) =>
        options.sendMail({
          to: user.email,
          subject: 'Niva — איפוס סיסמה',
          text: `איפוס הסיסמה: ${url}\nאם לא ביקשת איפוס, אפשר להתעלם.`,
        }),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) =>
        options.sendMail({
          to: user.email,
          subject: 'Niva — אימות כתובת דוא״ל',
          text: `אימות הכתובת: ${url}`,
        }),
    },
    socialProviders: {
      ...(options.google ? { google: options.google } : {}),
      ...(options.apple ? { apple: options.apple } : {}),
    },
    account: {
      encryptOAuthTokens: true,
      storeStateStrategy: 'database',
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        allowDifferentEmails: true,
        allowUnlinkingAll: false,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 12,
      freshAge: 60 * 10,
      cookieCache: { enabled: false },
    },
    advanced: {
      useSecureCookies: options.production,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: options.production },
      ipAddress: { ipAddressHeaders: ['x-niva-client-ip'] },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: options.browserTestMode ? 10000 : 100,
      customRules: {
        '/sign-in/email': { window: 60, max: options.browserTestMode ? 10000 : 8 },
        '/sign-up/email': { window: 60, max: options.browserTestMode ? 10000 : 5 },
        '/request-password-reset': { window: 60, max: options.browserTestMode ? 10000 : 3 },
        '/send-verification-email': { window: 60, max: options.browserTestMode ? 10000 : 3 },
      },
    },
    onAPIError: { errorURL: `${options.origin}/login?oauth=error` },
  });
}
