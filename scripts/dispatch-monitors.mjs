import pg from 'pg';

const { Pool } = pg;

function createPool(connectionString) {
  return new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });
}

function baseUrl() {
  if (process.env.MONITOR_DISPATCH_BASE_URL) {
    return process.env.MONITOR_DISPATCH_BASE_URL.replace(/\/+$/, '');
  }
  const port = process.env.PORT || '3000';
  return `http://127.0.0.1:${port}`;
}

function operatorHeaders() {
  const token =
    process.env.OPERATOR_TOKEN ||
    process.env.TRENDANALYSIS_OPERATOR_TOKEN ||
    process.env.MONITOR_OPERATOR_TOKEN ||
    '';
  const headers = {};
  if (token) headers['x-operator-token'] = token;
  return headers;
}

function providerLimit(provider) {
  const envName = provider === 'brightdata' ? 'DAILY_BRIGHTDATA_CALL_LIMIT' : 'DAILY_OPENROUTER_CALL_LIMIT';
  const fallback = provider === 'brightdata' ? 2000 : 1500;
  const parsed = Number.parseInt(process.env[envName] || String(fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function listProviderUsageWarnings(pool) {
  const providers = ['brightdata', 'openrouter'];
  const { rows } = await pool.query(
    `SELECT provider, calls
     FROM market_signal.provider_usage_daily
     WHERE usage_date = CURRENT_DATE
       AND provider = ANY($1::text[])`,
    [providers],
  );
  const callsByProvider = new Map(rows.map((row) => [String(row.provider || ''), Number(row.calls || 0)]));

  return providers
    .map((provider) => {
      const limit = providerLimit(provider);
      const calls = callsByProvider.get(provider) || 0;
      const ratio = limit > 0 ? calls / limit : 0;
      return {
        provider,
        calls,
        limit,
        ratio,
        threshold: 0.8,
      };
    })
    .filter((usage) => usage.ratio >= usage.threshold);
}

async function postAlertWebhook(payload) {
  const webhook = process.env.ALERT_WEBHOOK || '';
  if (!webhook) return { configured: false, ok: true, skipped: true };

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  return {
    configured: true,
    ok: response.ok,
    status: response.status,
  };
}

async function checkProviderUsageAlerts(pool) {
  try {
    const warnings = await listProviderUsageWarnings(pool);
    if (!warnings.length) return { warnings: [], alert: { configured: Boolean(process.env.ALERT_WEBHOOK), ok: true } };

    const payload = {
      type: 'trendanalysis.provider_usage_warning',
      severity: 'warning',
      generatedAt: new Date().toISOString(),
      warnings: warnings.map((warning) => ({
        provider: warning.provider,
        calls: warning.calls,
        limit: warning.limit,
        percent: Math.round(warning.ratio * 100),
        thresholdPercent: Math.round(warning.threshold * 100),
      })),
    };
    const alert = await postAlertWebhook(payload).catch((error) => ({
      configured: Boolean(process.env.ALERT_WEBHOOK),
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }));
    return { warnings: payload.warnings, alert };
  } catch (error) {
    return {
      warnings: [],
      alert: {
        configured: Boolean(process.env.ALERT_WEBHOOK),
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

async function listDueMonitorIds(pool, limit) {
  const { rows } = await pool.query(
    `SELECT id
     FROM market_signal.monitors
     WHERE active = TRUE
       AND (
         last_run_at IS NULL OR
         last_run_at <= NOW() - make_interval(mins => cadence_minutes)
       )
       AND NOT EXISTS (
         SELECT 1
         FROM market_signal.monitor_runs
         WHERE monitor_id = market_signal.monitors.id
           AND status IN ('queued', 'running')
           AND created_at >= NOW() - INTERVAL '30 minutes'
       )
     ORDER BY COALESCE(last_run_at, to_timestamp(0)) ASC, created_at ASC
     LIMIT $1`,
    [limit],
  );

  return rows
    .map((row) => (typeof row.id === 'string' ? row.id : ''))
    .filter(Boolean);
}

async function queueMonitor(base, monitorId) {
  const response = await fetch(`${base}/api/monitors/${encodeURIComponent(monitorId)}/run`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...operatorHeaders(),
    },
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text().catch(() => '');
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  return {
    monitorId,
    status: response.status,
    ok: response.ok,
    payload,
  };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(JSON.stringify({ ok: false, error: 'DATABASE_URL missing' }));
    process.exit(1);
  }

  const limit = Math.max(1, Number.parseInt(process.env.MONITOR_DISPATCH_LIMIT || '2', 10) || 2);
  const pool = createPool(connectionString);

  try {
    const providerUsage = await checkProviderUsageAlerts(pool);
    const dueMonitorIds = await listDueMonitorIds(pool, limit);
    const targetBaseUrl = baseUrl();
    const results = [];

    for (const monitorId of dueMonitorIds) {
      results.push(await queueMonitor(targetBaseUrl, monitorId));
    }

    console.log(
      JSON.stringify({
        ok: true,
        due: dueMonitorIds.length,
        queued: results.filter((result) => result.status === 202).length,
        conflicts: results.filter((result) => result.status === 409).length,
        errors: results.filter((result) => result.status >= 400 && result.status !== 409).length,
        dispatchedAt: new Date().toISOString(),
        providerUsage,
        results,
      }),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
});
