import { createPilot, platformUser, type PilotEnv } from './pilot';
import assets from 'niva:assets';
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};
export default {
  async fetch(request: Request, env: PilotEnv): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pilot = createPilot(env);
      if (url.pathname.startsWith('/api/')) return pilot.app.fetch(request);
      if (!['GET', 'HEAD'].includes(request.method))
        return new Response('Method not allowed', { status: 405, headers });
      const asset = assets[url.pathname];
      if (asset)
        return new Response(
          request.method === 'HEAD'
            ? null
            : Uint8Array.from(atob(asset.body), (c) => c.charCodeAt(0)),
          {
            headers: {
              ...headers,
              'Content-Type': asset.type,
              'Cache-Control':
                url.pathname === '/build-info.json' ? 'no-store' : 'public, max-age=86400',
            },
          },
        );
      if (/\.[a-z0-9]+$/i.test(url.pathname))
        return new Response('Not found', { status: 404, headers });
      let html = atob(assets['/index.html']!.body);
      // UTF-8 decode before injecting account theme to avoid wrong-theme flash.
      html = new TextDecoder().decode(Uint8Array.from(html, (c) => c.charCodeAt(0)));
      const user = platformUser(request);
      if (user) {
        const state = await pilot.readState(user.id);
        html = html.replace(
          '<head>',
          `<head><meta name="niva-account-theme" content="${['light', 'dark', 'system'].includes(state.theme) ? state.theme : 'system'}">`,
        );
      }
      return new Response(request.method === 'HEAD' ? null : html, {
        headers: {
          ...headers,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'private, no-store',
        },
      });
    } catch {
      return Response.json(
        { error: 'SERVICE_UNAVAILABLE' },
        { status: 503, headers: { ...headers, 'Cache-Control': 'no-store' } },
      );
    }
  },
};
