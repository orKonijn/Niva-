export interface WatchdogConfig {
  healthUrl: string;
  secret: string;
  operator: string;
  alertUrl: string;
  alertSecret?: string;
  siteAuthorization?: string;
}
export interface WatchdogState {
  lastKey?: string;
  lastDeliveredAt?: number;
}
export interface WatchdogResult {
  status: 'healthy' | 'delivered' | 'cooldown' | 'delivery-failed';
  reasons: string[];
  state: WatchdogState;
}
/** Run outside the application scheduler. Uses only health metadata, never account/CV data. */
export async function checkWatchdog(
  config: WatchdogConfig,
  previous: WatchdogState = {},
  now = Date.now(),
  fetcher: typeof fetch = fetch,
): Promise<WatchdogResult> {
  if (!config.operator.trim() || config.secret.length < 32)
    throw new Error('OPERATOR_AND_SECRET_REQUIRED');
  for (const endpoint of [config.healthUrl, config.alertUrl]) {
    const url = new URL(endpoint);
    if (
      url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
    )
      throw new Error('HTTPS_REQUIRED');
    if (url.username || url.password) throw new Error('URL_CREDENTIALS_FORBIDDEN');
  }
  let reasons: string[] = [];
  try {
    const response = await fetcher(config.healthUrl, {
      headers: {
        Authorization: 'Bearer ' + config.secret,
        ...(config.siteAuthorization
          ? { 'OAI-Sites-Authorization': 'Bearer ' + config.siteAuthorization }
          : {}),
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('UNAVAILABLE');
    const health = (await response.json()) as {
      schedulerOverdue?: boolean;
      ingestionOverdue?: boolean;
      cleanupOverdue?: boolean;
      rows?: { id: string; error: string | null }[];
    };
    if (typeof health.schedulerOverdue !== 'boolean' || typeof health.cleanupOverdue !== 'boolean')
      throw new Error('INVALID_HEALTH');
    if (typeof health.ingestionOverdue === 'boolean') {
      if (health.ingestionOverdue) reasons.push('INGESTION_OVERDUE');
    } else if (health.schedulerOverdue) reasons.push('SCHEDULER_OVERDUE');
    if (health.cleanupOverdue) reasons.push('CLEANUP_OVERDUE');
    if (health.rows?.some((r) => r.error)) reasons.push('MAINTENANCE_FAILURE');
  } catch {
    reasons = ['HEALTH_UNREACHABLE'];
  }
  if (!reasons.length) return { status: 'healthy', reasons, state: {} };
  const key = reasons.join(',');
  if (previous.lastKey === key && now - (previous.lastDeliveredAt ?? 0) < 3600000)
    return { status: 'cooldown', reasons, state: previous };
  try {
    const response = await fetcher(config.alertUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.alertSecret ? { Authorization: 'Bearer ' + config.alertSecret } : {}),
      },
      body: JSON.stringify({
        service: 'Niva',
        operator: config.operator,
        reasons,
        observedAt: new Date(now).toISOString(),
        action: 'Check scheduler, source health and retention; do not send private records.',
      }),
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('DELIVERY_FAILED');
    await response.body?.cancel();
    return { status: 'delivered', reasons, state: { lastKey: key, lastDeliveredAt: now } };
  } catch {
    return { status: 'delivery-failed', reasons, state: previous };
  }
}
