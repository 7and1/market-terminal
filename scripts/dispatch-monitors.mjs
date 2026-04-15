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
