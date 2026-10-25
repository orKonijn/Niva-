import { createAuth } from './auth';
import type { D1Database } from '@cloudflare/workers-types';
export interface HostedAuthEnvironment {
  DB: D1Database;
  NIVA_PUBLIC_ORIGIN?: string;
  NIVA_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
}
export function hostedProviders(env: HostedAuthEnvironment) {
  let validOrigin = false;
  try {
    const origin = new URL(env.NIVA_PUBLIC_ORIGIN ?? '');
    validOrigin =
      origin.protocol === 'https:' &&
      origin.origin === env.NIVA_PUBLIC_ORIGIN &&
      !origin.username &&
      !origin.password;
  } catch {
    /* Incomplete provider configuration stays disabled. */
  }
  const configured = validOrigin && (env.NIVA_AUTH_SECRET?.length ?? 0) >= 32;
  return {
    google: configured && !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
    apple: configured && !!env.APPLE_CLIENT_ID && !!env.APPLE_CLIENT_SECRET,
  };
}
export function hostedAuth(env: HostedAuthEnvironment) {
  const providers = hostedProviders(env);
  if (!providers.google && !providers.apple) return null;
  return createAuth(env.DB, {
    origin: env.NIVA_PUBLIC_ORIGIN!,
    secret: env.NIVA_AUTH_SECRET!,
    production: true,
    emailEnabled: false,
    sendMail: async () => {
      throw Error('EMAIL_NOT_CONFIGURED');
    },
    // Never merge an existing ChatGPT identity on the basis of an email match.
    accountLinking: false,
    ...(providers.google
      ? { google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! } }
      : {}),
    ...(providers.apple
      ? { apple: { clientId: env.APPLE_CLIENT_ID!, clientSecret: env.APPLE_CLIENT_SECRET! } }
      : {}),
  });
}
