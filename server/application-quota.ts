import type { Context } from 'hono';
import { getSignedCookie, setSignedCookie } from 'hono/cookie';
import { createHmac, randomUUID } from 'node:crypto';
/** Account identity is supplied by the trusted session/platform adapter. Anonymous
 * browsers use a server-signed, short-lived cookie; caller identity/IP headers
 * never select a quota bucket. IDs are HMACed before they enter the limits table. */
export async function applicationVisitor(c: Context, secret: string, owner: string | null) {
  const digest = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
  if (owner) return { key: digest('account:' + owner), freshAnonymous: false };
  const signed = await getSignedCookie(c, secret, 'niva-apply-visitor');
  if (typeof signed === 'string' && /^[a-f0-9-]{36}$/.test(signed))
    return { key: digest('visitor:' + signed), freshAnonymous: false };
  const id = randomUUID();
  await setSignedCookie(c, 'niva-apply-visitor', id, secret, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:',
    path: '/api/apply',
    maxAge: 3600,
  });
  return { key: digest('visitor:' + id), freshAnonymous: true };
}
export function limitedApplication(c: Context) {
  const listing = '/app/jobs/' + encodeURIComponent(c.req.param('id') ?? '');
  c.header('Retry-After', '60');
  const message = 'בוצעו בקשות רבות מהדפדפן או מהחשבון הזה. אפשר לחזור למשרה ולנסות שוב בעוד דקה.';
  if (c.req.header('accept')?.includes('text/html'))
    return c.html(
      `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>אפשר לנסות שוב בעוד דקה — Niva</title><main><h1>אפשר לנסות שוב בעוד דקה</h1><p>${message}</p><a href="${listing}">בחזרה למשרה</a></main></html>`,
      429,
    );
  return c.json({ error: 'RATE_LIMITED', message, retryAfterSeconds: 60, listing }, 429);
}
