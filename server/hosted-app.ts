import { runMaintenance } from './maintenance';
import { d1CareerDb } from './career-db';
import { createPilot, platformUser, type PilotEnv } from './pilot';
import {
  assetCache,
  canonicalRedirect,
  pageMetadata,
  responsePolicy,
  robots,
  sitemap,
} from './deployment-policy';
export function hostedApp(assets: Record<string, { body: string; type: string }>) {
  return {
    async scheduled(_event: unknown, env: PilotEnv) {
      await runMaintenance(d1CareerDb(env.DB), { trigger: 'scheduled' });
    },
    async fetch(
      request: Request,
      env: PilotEnv,
      execution?: { waitUntil(work: Promise<unknown>): void },
    ): Promise<Response> {
      const url = new URL(request.url),
        headers = responsePolicy(url);
      try {
        const redirect = canonicalRedirect(request, env);
        if (redirect)
          return new Response(null, {
            status: 308,
            headers: { ...headers, Location: redirect, 'Cache-Control': 'no-store' },
          });
        if (url.pathname === '/healthz') {
          if (!['GET', 'HEAD'].includes(request.method))
            return new Response('Method not allowed', {
              status: 405,
              headers: { ...headers, Allow: 'GET, HEAD' },
            });
          try {
            if (!env.DB || !env.NIVA_IMPORT_SECRET || env.NIVA_IMPORT_SECRET.length < 32)
              throw Error();
            const schema = await env.DB.prepare(
              "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('niva_pilot_states','niva_career_owners','niva_documents','niva_maintenance')",
            ).first<{ n: number }>();
            if (schema?.n !== 4) throw Error();
            await env.DB.prepare('SELECT erasure FROM niva_career_owners LIMIT 0').all();
            return new Response(
              request.method === 'HEAD'
                ? null
                : JSON.stringify({
                    service: 'niva',
                    status: 'ok',
                    checks: { database: 'ok', schema: 'ok' },
                  }),
              {
                headers: {
                  ...headers,
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-store',
                  'X-Robots-Tag': 'noindex, nofollow',
                },
              },
            );
          } catch {
            return new Response(
              request.method === 'HEAD'
                ? null
                : JSON.stringify({ service: 'niva', status: 'unavailable' }),
              {
                status: 503,
                headers: {
                  ...headers,
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-store',
                  'X-Robots-Tag': 'noindex, nofollow',
                },
              },
            );
          }
        }
        if (url.pathname.startsWith('/api/')) {
          const response = await createPilot(env, execution).app.fetch(request);
          const merged = new Headers(response.headers);
          for (const [key, value] of Object.entries(headers)) merged.set(key, value);
          merged.set('X-Robots-Tag', 'noindex, nofollow');
          merged.set('Cache-Control', 'private, no-store');
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: merged,
          });
        }
        if (!['GET', 'HEAD'].includes(request.method))
          return new Response('Method not allowed', { status: 405, headers });
        if (url.pathname === '/robots.txt')
          return new Response(request.method === 'HEAD' ? null : robots(env), {
            headers: {
              ...headers,
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'no-cache',
            },
          });
        if (url.pathname === '/sitemap.xml') {
          const xml = sitemap(env);
          return new Response(
            request.method === 'HEAD'
              ? null
              : (xml ?? 'Sitemap is unavailable until public indexing is configured.'),
            {
              status: xml ? 200 : 503,
              headers: {
                ...headers,
                'Content-Type': xml
                  ? 'application/xml; charset=utf-8'
                  : 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'X-Robots-Tag': 'noindex, nofollow',
              },
            },
          );
        }
        const asset = assets[url.pathname];
        if (asset && url.pathname !== '/index.html')
          return new Response(
            request.method === 'HEAD'
              ? null
              : Uint8Array.from(atob(asset.body), (c) => c.charCodeAt(0)),
            {
              headers: {
                ...headers,
                'Content-Type': asset.type,
                'Cache-Control': assetCache(url.pathname),
              },
            },
          );
        if (/\.[a-z0-9]+$/i.test(url.pathname) && url.pathname !== '/index.html')
          return new Response('Not found', { status: 404, headers });
        let html = new TextDecoder().decode(
          Uint8Array.from(atob(assets['/index.html']!.body), (c) => c.charCodeAt(0)),
        );
        const user = platformUser(request);
        if (user) {
          try {
            const state = await createPilot(env, execution).readState(user.id);
            html = html.replace(
              '<head>',
              `<head><meta name="niva-account-theme" content="${['light', 'dark', 'system'].includes(state.theme) ? state.theme : 'system'}">`,
            );
          } catch {
            /* Serve the shell with local/system theme; API failures retain their recovery UI. */
          }
        }
        const page = pageMetadata(html, url, env);
        return new Response(request.method === 'HEAD' ? null : page.html, {
          headers: {
            ...headers,
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'private, no-store',
            ...(page.index ? {} : { 'X-Robots-Tag': 'noindex, nofollow' }),
          },
        });
      } catch {
        return Response.json(
          { error: 'SERVICE_UNAVAILABLE' },
          {
            status: 503,
            headers: {
              ...headers,
              'Cache-Control': 'no-store',
              'X-Robots-Tag': 'noindex, nofollow',
            },
          },
        );
      }
    },
  };
}
