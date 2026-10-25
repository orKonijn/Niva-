export interface DeploymentEnvironment {
  NIVA_PUBLIC_ORIGIN?: string;
  NIVA_REDIRECT_HOSTS?: string;
  NIVA_ALLOW_INDEXING?: string;
}
export const publicPaths = ['/', '/privacy', '/terms', '/accessibility'];
export function deploymentPolicy(env: DeploymentEnvironment) {
  const value = env.NIVA_PUBLIC_ORIGIN?.trim();
  const origin = value ? new URL(value) : null;
  if (
    origin &&
    (origin.protocol !== 'https:' || origin.origin !== value || origin.username || origin.password)
  )
    throw Error('INVALID_PUBLIC_ORIGIN');
  const aliases = (env.NIVA_REDIRECT_HOSTS ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (aliases.some((x) => !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(x)))
    throw Error('INVALID_REDIRECT_HOST');
  return { origin, aliases, indexing: !!origin && env.NIVA_ALLOW_INDEXING === '1' };
}
export function canonicalRedirect(request: Request, env: DeploymentEnvironment): string | null {
  const policy = deploymentPolicy(env),
    url = new URL(request.url);
  if (
    !policy.origin ||
    !['GET', 'HEAD'].includes(request.method) ||
    /^\/(?:api(?:\/|$)|callback(?:\/|$)|signin-with-chatgpt|signout-with-chatgpt)/.test(
      url.pathname,
    )
  )
    return null;
  if (
    url.origin !== policy.origin.origin &&
    (url.hostname === policy.origin.hostname || policy.aliases.includes(url.hostname))
  ) {
    url.protocol = 'https:';
    url.host = policy.origin.host;
    return url.href;
  }
  return null;
}
export function responsePolicy(url: URL): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    ...(url.protocol === 'https:' ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
  };
}
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function pageMetadata(html: string, url: URL, env: DeploymentEnvironment) {
  const policy = deploymentPolicy(env),
    index = policy.indexing && publicPaths.includes(url.pathname);
  const canonical = policy.origin
    ? new URL(url.pathname === '/index.html' ? '/' : url.pathname, policy.origin).href
    : null;
  return {
    index,
    html: html.replace(
      '<head>',
      `<head><meta name="robots" content="${index ? 'index,follow' : 'noindex,nofollow'}">${canonical ? `<link rel="canonical" href="${escape(canonical)}"><meta property="og:url" content="${escape(canonical)}">` : ''}`,
    ),
  };
}
export function robots(env: DeploymentEnvironment) {
  const policy = deploymentPolicy(env);
  if (!policy.indexing) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\n${['/app', '/account', '/api', '/login', '/register', '/signup', '/forgot-password', '/reset-password', '/signin-with-chatgpt', '/signout-with-chatgpt', '/callback'].map((p) => 'Disallow: ' + p).join('\n')}\nSitemap: ${policy.origin!.origin}/sitemap.xml\n`;
}
export function sitemap(env: DeploymentEnvironment) {
  const policy = deploymentPolicy(env);
  if (!policy.indexing) return null;
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicPaths.map((p) => `<url><loc>${escape(new URL(p, policy.origin!).href)}</loc></url>`).join('')}</urlset>`;
}
export function assetCache(path: string) {
  if (path === '/build-info.json') return 'no-store';
  if (path === '/theme-init.js' || path.endsWith('.html')) return 'no-cache';
  return /\/(?:main|chunk|styles)-[a-zA-Z0-9_-]+\.(?:js|css)$/.test(path)
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=86400';
}
