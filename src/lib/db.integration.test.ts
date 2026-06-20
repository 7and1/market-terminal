import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { Pool } = pg;
const testDatabaseUrl = process.env.TEST_DATABASE_URL || '';
const describeIfDb = testDatabaseUrl ? describe : describe.skip;
const testKey = `integration-dynamic-head-${Date.now()}`;
const sessionPrefix = `integration-cleanup-${Date.now()}`;
const integrationUrlPrefix = `https://integration.example.test/${sessionPrefix}`;

describeIfDb('db integration', () => {
  let pool: InstanceType<typeof Pool> | null = null;
  let db: typeof import('@/lib/db') | null = null;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    pool = new Pool({ connectionString: testDatabaseUrl, max: 2 });
    const schema = await readFile(resolve(process.cwd(), 'schema.sql'), 'utf8');
    await pool.query(schema);
    vi.resetModules();
    db = await import('@/lib/db');
  }, 30_000);

  afterAll(async () => {
    await db?.closeDbPoolForTests();
    if (pool) {
      await pool.query('DELETE FROM market_signal.query_aliases WHERE alias_key = $1', [testKey]);
      await pool.query('DELETE FROM market_signal.catalog_heads_dynamic WHERE key = $1', [testKey]);
      await pool.query('DELETE FROM market_signal.sessions WHERE session_id LIKE $1', [`${sessionPrefix}%`]);
      await pool.query('DELETE FROM market_signal.monitors WHERE name LIKE $1', [`${sessionPrefix}%`]);
      await pool.query('DELETE FROM market_signal.raw_documents WHERE url LIKE $1', [`${integrationUrlPrefix}%`]);
      await pool.query('DELETE FROM market_signal.serp_snapshots WHERE query_text LIKE $1', [`${sessionPrefix}%`]);
      await pool.query('DELETE FROM market_signal.asset_daily_metrics WHERE asset_key LIKE $1', [`${sessionPrefix}%`]);
      await pool.query('DELETE FROM market_signal.rate_limit_counters WHERE bucket LIKE $1', [`${sessionPrefix}%`]);
      await pool.end();
    }
  });

  it('round-trips approved dynamic catalog heads and aliases', async () => {
    const dbClient = db!;
    const item = await dbClient.upsertDynamicCatalogHead({
      key: testKey,
      label: 'Integration Dynamic Head',
      assetKey: testKey,
      reportKey: `${testKey}-general`,
      aliases: ['integration dynamic head'],
      status: 'approved',
      score: 9,
      meta: { test: true },
    });
    await dbClient.upsertQueryAlias({
      aliasKey: testKey,
      aliasLabel: 'Integration Dynamic Head',
      targetType: 'asset',
      assetKey: testKey,
      source: 'manual',
      confidence: 0.99,
    });

    const approved = await dbClient.listApprovedDynamicCatalogHeads(20);
    const found = await dbClient.findApprovedDynamicCatalogHeadForTopic('Integration Dynamic Head');
    const aliases = await dbClient.listQueryAliases(20);

    expect(item).toMatchObject({
      key: testKey,
      label: 'Integration Dynamic Head',
      assetKey: testKey,
      reportKey: `${testKey}-general`,
      status: 'approved',
    });
    expect(approved.some((head) => head.key === testKey)).toBe(true);
    expect(found).toMatchObject({
      key: testKey,
      assetKey: testKey,
    });
    expect(aliases.some((alias) => alias.aliasKey === testKey && alias.assetKey === testKey)).toBe(true);
  });

  it('deletes only expired unpublished sessions while preserving published and recent monitor-linked rows', async () => {
    const dbClient = db!;
    const oldReady = `${sessionPrefix}-old-ready`;
    const oldRunning = `${sessionPrefix}-old-running`;
    const oldPublished = `${sessionPrefix}-old-published`;
    const freshReady = `${sessionPrefix}-fresh-ready`;
    const monitorProtected = `${sessionPrefix}-monitor-protected`;
    const monitorExpired = `${sessionPrefix}-monitor-expired`;

    await pool!.query(
      `INSERT INTO market_signal.sessions
        (session_id, topic, status, step, progress, meta, published, slug, created_at, updated_at)
       VALUES
        ($1, 'Old ready', 'ready', 'ready', 1, '{}'::jsonb, false, NULL, NOW() - INTERVAL '31 days', NOW() - INTERVAL '31 days'),
        ($2, 'Old running', 'running', 'search', 0.4, '{}'::jsonb, false, NULL, NOW() - INTERVAL '25 hours', NOW() - INTERVAL '25 hours'),
        ($3, 'Published ready', 'ready', 'ready', 1, '{}'::jsonb, true, $7, NOW() - INTERVAL '31 days', NOW() - INTERVAL '31 days'),
        ($4, 'Fresh ready', 'ready', 'ready', 1, '{}'::jsonb, false, NULL, NOW() - INTERVAL '29 days', NOW() - INTERVAL '29 days'),
        ($5, 'Monitor protected', 'error', 'search', 0.2, '{}'::jsonb, false, NULL, NOW() - INTERVAL '25 hours', NOW() - INTERVAL '25 hours'),
        ($6, 'Monitor expired', 'error', 'search', 0.2, '{}'::jsonb, false, NULL, NOW() - INTERVAL '25 hours', NOW() - INTERVAL '25 hours')`,
      [
        oldReady,
        oldRunning,
        oldPublished,
        freshReady,
        monitorProtected,
        monitorExpired,
        `${sessionPrefix}-published-slug`,
      ],
    );

    const { rows } = await pool!.query<{ id: string }>(
      `INSERT INTO market_signal.monitors (name, topic, mode, run_intent, cadence_minutes, active)
       VALUES ($1, 'Cleanup monitor', 'deep', 'monitor', 60, false)
       RETURNING id`,
      [`${sessionPrefix}-monitor`],
    );
    const monitorId = rows[0]!.id;
    await pool!.query(
      `INSERT INTO market_signal.monitor_runs (monitor_id, session_id, status, created_at)
       VALUES
        ($1, $2, 'error', NOW() - INTERVAL '6 days'),
        ($1, $3, 'error', NOW() - INTERVAL '8 days')`,
      [monitorId, monitorProtected, monitorExpired],
    );

    await expect(dbClient.deleteExpired()).resolves.toBe(3);

    const remaining = await pool!.query<{ session_id: string }>(
      `SELECT session_id
       FROM market_signal.sessions
       WHERE session_id LIKE $1
       ORDER BY session_id`,
      [`${sessionPrefix}%`],
    );

    expect(remaining.rows.map((row) => row.session_id)).toEqual([
      freshReady,
      monitorProtected,
      oldPublished,
    ].sort());
  });

  it('round-trips session meta merges and cursor pagination', async () => {
    const dbClient = db!;
    const first = `${sessionPrefix}-page-a`;
    const second = `${sessionPrefix}-page-b`;
    const third = `${sessionPrefix}-page-c`;

    await dbClient.createSession(first, 'Cursor A', 'running', 'plan', 0.1, { seed: 'a' }, `${sessionPrefix}-report`);
    await dbClient.createSession(second, 'Cursor B', 'running', 'plan', 0.1, { seed: 'b' }, `${sessionPrefix}-report`);
    await dbClient.createSession(third, 'Cursor C', 'running', 'plan', 0.1, { seed: 'c' }, `${sessionPrefix}-report`);
    await pool!.query(
      `UPDATE market_signal.sessions
       SET created_at = CASE session_id
         WHEN $1 THEN NOW() - INTERVAL '3 minutes'
         WHEN $2 THEN NOW() - INTERVAL '2 minutes'
         WHEN $3 THEN NOW() - INTERVAL '1 minute'
       END
       WHERE session_id = ANY($4::text[])`,
      [first, second, third, [first, second, third]],
    );

    await dbClient.updateStep(third, 'ready', 1, { seed: 'updated', nested: { value: 1 } });
    await dbClient.patchMeta(third, { persisted: true });

    const stored = await dbClient.getSession(third);
    expect(stored).toMatchObject({
      sessionId: third,
      reportKey: `${sessionPrefix}-report`,
      step: 'ready',
      progress: 1,
      meta: {
        seed: 'updated',
        nested: { value: 1 },
        persisted: true,
      },
    });

    const pageOne = await dbClient.listSessionsPage({
      limit: 2,
      sessionIds: [first, second, third],
    });
    expect(pageOne.items.map((item) => item.sessionId)).toEqual([third, second]);
    expect(pageOne.hasMore).toBe(true);
    expect(pageOne.nextCursor).toEqual(expect.any(String));

    const pageTwo = await dbClient.listSessionsPage({
      limit: 2,
      sessionIds: [first, second, third],
      cursor: pageOne.nextCursor || undefined,
    });
    expect(pageTwo.items.map((item) => item.sessionId)).toEqual([first]);
    expect(pageTwo.hasMore).toBe(false);
    expect(pageTwo.nextCursor).toBeNull();
  });

  it('enforces published slug uniqueness with the real constraint', async () => {
    const dbClient = db!;
    const first = `${sessionPrefix}-publish-a`;
    const second = `${sessionPrefix}-publish-b`;
    const slug = `${sessionPrefix}-published`;

    await dbClient.createSession(first, 'Publish A', 'ready', 'ready', 1, {});
    await dbClient.createSession(second, 'Publish B', 'ready', 'ready', 1, {});
    await dbClient.publishSession(first, slug, `${sessionPrefix}-asset`, `${sessionPrefix}-report`);

    await expect(
      dbClient.publishSession(second, slug, `${sessionPrefix}-asset`, `${sessionPrefix}-report`),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('reuses raw documents inside the configured freshness window', async () => {
    const dbClient = db!;
    const url = `${integrationUrlPrefix}/raw-document`;

    await dbClient.upsertRawDocument({
      url,
      markdown: '# First capture',
      meta: { source: 'integration' },
    });

    await expect(dbClient.getRecentRawDocument(url, 6)).resolves.toBe('# First capture');

    await pool!.query(
      `UPDATE market_signal.raw_documents
       SET captured_at = NOW() - INTERVAL '7 hours'
       WHERE url = $1`,
      [url],
    );
    await expect(dbClient.getRecentRawDocument(url, 6)).resolves.toBeNull();

    await dbClient.upsertRawDocument({
      url,
      markdown: '# Second capture',
      meta: { source: 'integration', pass: 2 },
    });
    await expect(dbClient.getRecentRawDocument(url, 6)).resolves.toBe('# Second capture');
  });

  it('claims each due monitor once under concurrent workers', async () => {
    const dbClient = db!;
    const monitor = await dbClient.createMonitor({
      name: `${sessionPrefix}-claim-monitor`,
      topic: 'Claim monitor',
      mode: 'deep',
      runIntent: 'monitor',
      cadenceMinutes: 15,
    });
    expect(monitor).not.toBeNull();

    const [firstClaim, secondClaim] = await Promise.all([
      dbClient.claimDueMonitorRuns(1),
      dbClient.claimDueMonitorRuns(1),
    ]);
    const claimed = [...firstClaim, ...secondClaim];

    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.monitor.id).toBe(monitor!.id);
    expect(claimed[0]!.run.status).toBe('queued');
    await expect(dbClient.claimDueMonitorRuns(1)).resolves.toHaveLength(0);
  });

  it('round-trips rate-limit counters and asset daily metric upserts', async () => {
    const dbClient = db!;
    const bucket = `${sessionPrefix}:rate-limit`;
    const assetKey = `${sessionPrefix}-asset-metric`;

    await expect(dbClient.checkRateLimitCounter({ bucket, max: 2, windowMs: 60_000 })).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
      limit: 2,
    });
    await expect(dbClient.checkRateLimitCounter({ bucket, max: 2, windowMs: 60_000 })).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
      limit: 2,
    });
    await expect(dbClient.checkRateLimitCounter({ bucket, max: 2, windowMs: 60_000 })).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
      limit: 2,
    });

    await dbClient.upsertAssetDailyMetric({
      assetKey,
      metricDate: '2026-06-12',
      summary: { headline: 'first' },
      metrics: { count: 1 },
    });
    await dbClient.upsertAssetDailyMetric({
      assetKey,
      metricDate: '2026-06-12',
      summary: { headline: 'second' },
      metrics: { count: 2 },
    });

    const { rows } = await pool!.query<{ summary: { headline: string }; metrics: { count: number } }>(
      `SELECT summary, metrics
       FROM market_signal.asset_daily_metrics
       WHERE asset_key = $1 AND metric_date = $2::date`,
      [assetKey, '2026-06-12'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      summary: { headline: 'second' },
      metrics: { count: 2 },
    });
  });
});
