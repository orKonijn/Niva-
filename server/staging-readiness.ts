export interface StagingReadConfig {
  origin: string;
  directOrigin?: string;
  aliceCookie: string;
  bobCookie: string;
  aliceResumeId: string;
  syntheticMarker: string;
  disposable: boolean;
  siteAuthorization?: string;
}
export interface StagingReadResult {
  gate: string;
  status: 'passed' | 'failed' | 'unverified';
  reason: string;
}
/** Read-only staging checks. Does not create/delete records, run providers or print private bodies. */
export async function verifyStagingReads(
  config: StagingReadConfig,
  fetcher: typeof fetch = fetch,
): Promise<StagingReadResult[]> {
  if (
    !config.disposable ||
    !config.aliceCookie ||
    !config.bobCookie ||
    !config.aliceResumeId ||
    !config.syntheticMarker.startsWith('SYNTHETIC-STAGING-')
  )
    throw new Error('EXPLICIT_DISPOSABLE_FIXTURES_REQUIRED');
  for (const origin of [config.origin, ...(config.directOrigin ? [config.directOrigin] : [])]) {
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      url.hostname === 'niva-demo-ziv-20261023.ork77.chatgpt.site' ||
      url.username ||
      url.password ||
      !(
        url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))
      )
    )
      throw new Error('SEPARATE_STAGING_ORIGIN_REQUIRED');
  }
  const read = (origin: string, path: string, headers: Record<string, string>) =>
    fetcher(origin + path, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
  const results: StagingReadResult[] = [];
  try {
    const sessions = [];
    for (const cookie of [config.aliceCookie, config.bobCookie]) {
      const response = await read(config.origin, '/api/session', { Cookie: cookie });
      if (response.status !== 200) throw new Error('SESSIONS_UNVERIFIED');
      sessions.push(((await response.json()) as { user?: { id?: string } }).user?.id);
    }
    if (!sessions[0] || !sessions[1] || sessions[0] === sessions[1])
      throw new Error('SESSIONS_UNVERIFIED');
    results.push({
      gate: 'independent-identities',
      status: 'passed',
      reason: 'Two different authenticated staging identities observed; identifiers omitted.',
    });
    const path = '/api/career/resumes/' + encodeURIComponent(config.aliceResumeId) + '/export';
    const owned = await read(config.origin, path, { Cookie: config.aliceCookie });
    const text = owned.status === 200 ? await owned.text() : '';
    if (!text.startsWith(config.syntheticMarker))
      throw new Error('KNOWN_SYNTHETIC_FIXTURE_UNVERIFIED');
    const denied = await read(config.origin, path, { Cookie: config.bobCookie });
    await denied.body?.cancel();
    results.push({
      gate: 'known-owner-record-isolation',
      status: [403, 404].includes(denied.status) ? 'passed' : 'failed',
      reason:
        'Checked a known synthetic Alice resume with independently authenticated Bob; no body retained.',
    });
    for (const [name, origin] of [
      ['site', config.origin],
      ...(config.directOrigin ? [['direct', config.directOrigin]] : []),
    ] as [string, string][]) {
      const response = await read(origin, '/api/career/resumes', {
        'oai-authenticated-user-id': sessions[0]!,
        'oai-authenticated-user-email': 'synthetic@example.test',
        ...(name === 'site' && config.siteAuthorization
          ? { 'OAI-Sites-Authorization': 'Bearer ' + config.siteAuthorization }
          : {}),
      });
      await response.body?.cancel();
      results.push({
        gate: name + '-forged-header',
        status: [401, 403].includes(response.status)
          ? 'passed'
          : [301, 302, 303, 307, 308].includes(response.status)
            ? 'unverified'
            : 'failed',
        reason:
          'Unauthenticated forged headers must be rejected. Redirects do not prove the underlying API boundary.',
      });
    }
    if (!config.directOrigin)
      results.push({
        gate: 'direct-origin',
        status: 'unverified',
        reason: 'Alternate/direct origin inventory and access were not supplied.',
      });
  } catch {
    results.push({
      gate: 'read-only-staging',
      status: 'unverified',
      reason:
        'Authenticated sessions, known synthetic fixture or endpoint access could not be established; no private response logged.',
    });
  }
  return results;
}
