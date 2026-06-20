import pg from 'pg';

const { Pool } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(JSON.stringify({ ok: false, error: 'DATABASE_URL missing' }));
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: url,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const { rowCount: deletedSessions } = await pool.query(
      `DELETE FROM market_signal.sessions AS s
       WHERE s.published IS NOT TRUE
         AND (
           (s.status = 'ready' AND s.created_at < NOW() - INTERVAL '30 days')
           OR (
             s.status <> 'ready'
             AND s.created_at < NOW() - INTERVAL '24 hours'
             AND NOT EXISTS (
               SELECT 1
               FROM market_signal.monitor_runs
               WHERE monitor_runs.session_id = s.session_id
                 AND monitor_runs.created_at >= NOW() - INTERVAL '7 days'
             )
           )
         )`,
    );
    const { rowCount: deletedRateLimitCounters } = await pool.query(
      `DELETE FROM market_signal.rate_limit_counters
       WHERE reset_at < NOW()`,
    );
    console.log(
      JSON.stringify({
        ok: true,
        deleted: deletedSessions ?? 0,
        deletedRateLimitCounters: deletedRateLimitCounters ?? 0,
        ranAt: new Date().toISOString(),
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
