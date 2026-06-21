import { createHash } from 'node:crypto';

import pg from 'pg';

const { Pool } = pg;

let _pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  _pool = new Pool({
    connectionString: url,
    max: 6,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  _pool.on('error', (err) => {
    console.error('[db] pool error', err.message);
  });
  return _pool;
}

export async function closeDbPoolForTests(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') return;
  const pool = _pool;
  _pool = null;
  await pool?.end();
}

export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionRow = {
  sessionId: string;
  topic: string;
  reportKey: string | null;
  status: string;
  step: string;
  progress: number;
  meta: Record<string, unknown>;
  published: boolean;
  slug: string | null;
  assetKey: string | null;
  _creationTime: number; // epoch ms — backwards compat with Convex consumers
};

export type ReportHeadRow = {
  reportKey: string;
  canonicalLabel: string;
  subjectKey: string;
  currentSessionId: string;
  currentSlug: string;
  createdAt: string;
  updatedAt: string;
};

export type QueryAliasTargetType = 'report' | 'asset';
export type QueryAliasSource = 'catalog' | 'report' | 'manual';

export type QueryAliasRow = {
  aliasKey: string;
  aliasLabel: string;
  targetType: QueryAliasTargetType;
  reportKey: string | null;
  assetKey: string | null;
  source: QueryAliasSource;
  confidence: number;
  createdAt: string;
  updatedAt: string;
};

export type PublishedReportRecord = {
  session: SessionRow;
  head: ReportHeadRow | null;
  isCurrent: boolean;
};

export type AssetDailyMetricRow = {
  assetKey: string;
  metricDate: string;
  summary: Record<string, unknown>;
  metrics: Record<string, unknown>;
  updatedAt: string;
};

export type CurrentPublishedReportRow = {
  session: SessionRow;
  head: ReportHeadRow;
};

export type MonitorMode = 'fast' | 'deep';
export type MonitorRunIntent = 'general' | 'monitor';
export type MonitorCadenceMinutes = 15 | 60 | 360 | 1440;
export type MonitorRunStatus = 'queued' | 'running' | 'ready' | 'error' | 'noop';

export type MonitorRow = {
  id: string;
  name: string;
  topic: string;
  mode: MonitorMode;
  runIntent: MonitorRunIntent;
  cadenceMinutes: MonitorCadenceMinutes;
  active: boolean;
  notifyWebhookUrl: string | null;
  lastRunAt: string | null;
  lastReadySessionId: string | null;
  lastChangeScore: number | null;
  lastAlertAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicMonitorRow = Omit<MonitorRow, 'notifyWebhookUrl'> & {
  notifyWebhookUrl: null;
  hasNotifyWebhook: boolean;
};

export type MonitorRunRow = {
  id: string;
  monitorId: string;
  sessionId: string | null;
  baselineSessionId: string | null;
  status: MonitorRunStatus;
  changeScore: number | null;
  significant: boolean | null;
  summary: Record<string, unknown>;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

export type PublicMonitorTimelineRow = {
  monitorId: string;
  monitorName: string;
  topic: string;
  sessionId: string | null;
  slug: string | null;
  changeScore: number | null;
  significant: boolean | null;
  summary: Record<string, unknown>;
  createdAt: string;
};

export type ConfirmedSubscriberRow = {
  email: string;
  assetKey: string;
  tokenHash: string;
};

export type QueryDemandRow = {
  normalized: string;
  sampleInput: string;
  count: number;
  rejectCount: number;
  privateCount: number;
  ambiguousCount: number;
  surfaces: string[];
  locales: string[];
  firstSeenAt: string;
  latestSeenAt: string;
};

export type CatalogPublicSurface = 'asset_hub' | 'report';
export type CatalogPriorityTier = 'v1' | 'secondary';
export type DynamicCatalogHeadStatus = 'candidate' | 'approved' | 'disabled';

export type DynamicCatalogHeadRow = {
  key: string;
  label: string;
  assetKey: string | null;
  reportKey: string | null;
  publicSurface: CatalogPublicSurface;
  priorityTier: CatalogPriorityTier;
  aliases: string[];
  status: DynamicCatalogHeadStatus;
  score: number;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ClaimedMonitorRun = {
  run: MonitorRunRow;
  monitor: MonitorRow;
};

export type EventRow = {
  id: number;
  sessionId: string;
  type: string;
  payload: unknown;
  created_at: string;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type DbSchemaProbe = {
  ok: boolean;
  latencyMs: number;
  missing: string[];
  present: string[];
  error?: string;
};

type SessionCursor = {
  createdAt: string;
  sessionId: string;
};

function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor<T>(value: string | undefined | null): T | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

function toSession(row: Record<string, unknown>): SessionRow {
  return {
    sessionId: row.session_id as string,
    topic: row.topic as string,
    reportKey: typeof row.report_key === 'string' ? row.report_key : null,
    status: row.status as string,
    step: row.step as string,
    progress: row.progress as number,
    meta: (row.meta ?? {}) as Record<string, unknown>,
    published: row.published as boolean,
    slug: (row.slug as string) ?? null,
    assetKey: (row.asset_key as string) ?? null,
    _creationTime: new Date(row.created_at as string).getTime(),
  };
}

function toReportHead(row: Record<string, unknown>): ReportHeadRow {
  return {
    reportKey: String(row.report_key || ''),
    canonicalLabel: String(row.canonical_label || ''),
    subjectKey: String(row.subject_key || ''),
    currentSessionId: String(row.current_session_id || ''),
    currentSlug: String(row.current_slug || ''),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function toQueryAlias(row: Record<string, unknown>): QueryAliasRow {
  const targetType = String(row.target_type || 'asset') === 'report' ? 'report' : 'asset';
  const source = ['catalog', 'report', 'manual'].includes(String(row.source || 'catalog'))
    ? (String(row.source || 'catalog') as QueryAliasSource)
    : 'catalog';
  return {
    aliasKey: String(row.alias_key || ''),
    aliasLabel: String(row.alias_label || ''),
    targetType,
    reportKey: typeof row.report_key === 'string' ? row.report_key : null,
    assetKey: typeof row.asset_key === 'string' ? row.asset_key : null,
    source,
    confidence: typeof row.confidence === 'number' ? row.confidence : Number(row.confidence || 0),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function toDynamicCatalogHead(row: Record<string, unknown>): DynamicCatalogHeadRow {
  const publicSurface = String(row.public_surface || 'asset_hub') === 'report' ? 'report' : 'asset_hub';
  const priorityTier = String(row.priority_tier || 'secondary') === 'v1' ? 'v1' : 'secondary';
  const status = ['candidate', 'approved', 'disabled'].includes(String(row.status || 'candidate'))
    ? (String(row.status || 'candidate') as DynamicCatalogHeadStatus)
    : 'candidate';
  return {
    key: String(row.key || ''),
    label: String(row.label || ''),
    assetKey: typeof row.asset_key === 'string' ? row.asset_key : null,
    reportKey: typeof row.report_key === 'string' ? row.report_key : null,
    publicSurface,
    priorityTier,
    aliases: Array.isArray(row.aliases) ? row.aliases.map(String).filter(Boolean) : [],
    status,
    score: typeof row.score === 'number' ? row.score : Number(row.score || 0),
    meta: (row.meta ?? {}) as Record<string, unknown>,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function toEvent(row: Record<string, unknown>): EventRow {
  return {
    id: row.id as number,
    sessionId: row.session_id as string,
    type: row.type as string,
    payload: row.payload ?? {},
    created_at: new Date(row.created_at as string).toISOString(),
  };
}

export function normalizeDynamicCatalogKey(raw: string): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96) || 'market';
}

function toMonitor(row: Record<string, unknown>): MonitorRow {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    topic: String(row.topic || ''),
    mode: String(row.mode || 'deep') === 'fast' ? 'fast' : 'deep',
    runIntent: String(row.run_intent || 'monitor') === 'general' ? 'general' : 'monitor',
    cadenceMinutes: Number(row.cadence_minutes) as MonitorCadenceMinutes,
    active: Boolean(row.active),
    notifyWebhookUrl: typeof row.notify_webhook_url === 'string' ? row.notify_webhook_url : null,
    lastRunAt: row.last_run_at ? new Date(String(row.last_run_at)).toISOString() : null,
    lastReadySessionId: typeof row.last_ready_session_id === 'string' ? row.last_ready_session_id : null,
    lastChangeScore: typeof row.last_change_score === 'number' ? row.last_change_score : row.last_change_score == null ? null : Number(row.last_change_score),
    lastAlertAt: row.last_alert_at ? new Date(String(row.last_alert_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export function toPublicMonitor(monitor: MonitorRow | null): PublicMonitorRow | null {
  if (!monitor) return null;

  return {
    ...monitor,
    notifyWebhookUrl: null,
    hasNotifyWebhook: Boolean(monitor.notifyWebhookUrl),
  };
}

function toMonitorRun(row: Record<string, unknown>): MonitorRunRow {
  return {
    id: String(row.id),
    monitorId: String(row.monitor_id),
    sessionId: typeof row.session_id === 'string' ? row.session_id : null,
    baselineSessionId: typeof row.baseline_session_id === 'string' ? row.baseline_session_id : null,
    status: String(row.status || 'queued') as MonitorRunStatus,
    changeScore: typeof row.change_score === 'number' ? row.change_score : row.change_score == null ? null : Number(row.change_score),
    significant: typeof row.significant === 'boolean' ? row.significant : row.significant == null ? null : Boolean(row.significant),
    summary: (row.summary ?? {}) as Record<string, unknown>,
    error: typeof row.error === 'string' ? row.error : null,
    startedAt: row.started_at ? new Date(String(row.started_at)).toISOString() : null,
    finishedAt: row.finished_at ? new Date(String(row.finished_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function toAssetDailyMetric(row: Record<string, unknown>): AssetDailyMetricRow {
  return {
    assetKey: String(row.asset_key || ''),
    metricDate: toDateKey(row.metric_date),
    summary: (row.summary ?? {}) as Record<string, unknown>,
    metrics: (row.metrics ?? {}) as Record<string, unknown>,
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function stableHash(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function domainFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function toIsoOrNull(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value).toISOString();
}

function toDateKey(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : raw;
}

// ---------------------------------------------------------------------------
// Session mutations
// ---------------------------------------------------------------------------

export async function createSession(
  sessionId: string,
  topic: string,
  status: string,
  step: string,
  progress: number,
  meta: Record<string, unknown>,
  reportKey?: string | null,
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO market_signal.sessions (session_id, topic, report_key, status, step, progress, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (session_id) DO NOTHING`,
    [sessionId, topic, reportKey || null, status, step, progress, JSON.stringify(meta)],
  );
}

export async function updateStep(
  sessionId: string,
  step: string,
  progress: number,
  meta?: Record<string, unknown>,
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  if (meta !== undefined) {
    await pool.query(
      `UPDATE market_signal.sessions
       SET step = $2, progress = $3, meta = $4, updated_at = NOW()
       WHERE session_id = $1`,
      [sessionId, step, progress, JSON.stringify(meta)],
    );
  } else {
    await pool.query(
      `UPDATE market_signal.sessions
       SET step = $2, progress = $3, updated_at = NOW()
       WHERE session_id = $1`,
      [sessionId, step, progress],
    );
  }
}

export async function updateStatus(sessionId: string, status: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `UPDATE market_signal.sessions SET status = $2, updated_at = NOW() WHERE session_id = $1`,
    [sessionId, status],
  );
}

export async function patchMeta(
  sessionId: string,
  metaPatch: Record<string, unknown>,
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `UPDATE market_signal.sessions
     SET meta = meta || $2::jsonb, updated_at = NOW()
     WHERE session_id = $1`,
    [sessionId, JSON.stringify(metaPatch)],
  );
}

export async function updateSessionReportKey(sessionId: string, reportKey: string | null): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `UPDATE market_signal.sessions
     SET report_key = $2, updated_at = NOW()
     WHERE session_id = $1`,
    [sessionId, reportKey],
  );
}

export async function publishSession(
  sessionId: string,
  slug: string,
  assetKey: string,
  reportKey?: string | null,
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `UPDATE market_signal.sessions
     SET published = TRUE,
         slug = $2,
         asset_key = $3,
         report_key = COALESCE($4, report_key),
         updated_at = NOW()
     WHERE session_id = $1`,
    [sessionId, slug, assetKey, reportKey || null],
  );
}

// ---------------------------------------------------------------------------
// Session queries
// ---------------------------------------------------------------------------

export async function getSession(sessionId: string): Promise<SessionRow | null> {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT * FROM market_signal.sessions WHERE session_id = $1`,
    [sessionId],
  );
  return rows.length ? toSession(rows[0]) : null;
}

export async function getBySlug(slug: string): Promise<SessionRow | null> {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT * FROM market_signal.sessions WHERE slug = $1 AND published = TRUE`,
    [slug],
  );
  return rows.length ? toSession(rows[0]) : null;
}

export async function getPublishedReportBySlug(slug: string): Promise<PublishedReportRecord | null> {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT s.*,
            rh.report_key AS head_report_key,
            rh.canonical_label,
            rh.subject_key,
            rh.current_session_id,
            rh.current_slug,
            rh.created_at AS head_created_at,
            rh.updated_at AS head_updated_at
     FROM market_signal.sessions s
     LEFT JOIN market_signal.report_heads rh
       ON rh.report_key = s.report_key
     WHERE s.slug = $1 AND s.published = TRUE
     LIMIT 1`,
    [slug],
  );
  if (!rows.length) return null;
  const row = rows[0] as Record<string, unknown>;
  const hasHead = typeof row.head_report_key === 'string' && row.head_report_key.length > 0;
  const head = hasHead
    ? toReportHead({
        report_key: row.head_report_key,
        canonical_label: row.canonical_label,
        subject_key: row.subject_key,
        current_session_id: row.current_session_id,
        current_slug: row.current_slug,
        created_at: row.head_created_at,
        updated_at: row.head_updated_at,
      })
    : null;

  return {
    session: toSession(row),
    head,
    isCurrent: !head || head.currentSlug === slug,
  };
}

export async function listSessions(
  limit = 50,
  status?: string,
  q?: string,
): Promise<SessionRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }
  if (q && q.trim()) {
    conditions.push(`topic ILIKE $${idx++}`);
    params.push(`%${q.trim()}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  const { rows } = await pool.query(
    `SELECT * FROM market_signal.sessions ${where} ORDER BY created_at DESC LIMIT $${idx}`,
    params,
  );
  return rows.map(toSession);
}

export async function listSessionsPage({
  limit = 50,
  status,
  q,
  cursor,
  sessionIds,
}: {
  limit?: number;
  status?: string;
  q?: string;
  cursor?: string;
  sessionIds?: string[];
}): Promise<CursorPage<SessionRow>> {
  const pool = getPool();
  if (!pool) return { items: [], nextCursor: null, hasMore: false };

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }
  if (q && q.trim()) {
    conditions.push(`topic ILIKE $${idx++}`);
    params.push(`%${q.trim()}%`);
  }
  if (sessionIds?.length) {
    conditions.push(`session_id = ANY($${idx++}::text[])`);
    params.push(sessionIds);
  }

  const parsedCursor = decodeCursor<SessionCursor>(cursor);
  if (parsedCursor?.createdAt && parsedCursor.sessionId) {
    conditions.push(`(created_at, session_id) < ($${idx++}::timestamptz, $${idx++})`);
    params.push(parsedCursor.createdAt, parsedCursor.sessionId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit + 1);

  const { rows } = await pool.query(
    `SELECT * FROM market_signal.sessions
     ${where}
     ORDER BY created_at DESC, session_id DESC
     LIMIT $${idx}`,
    params,
  );

  const mapped = rows.map(toSession);
  const hasMore = mapped.length > limit;
  const items = hasMore ? mapped.slice(0, limit) : mapped;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last
    ? encodeCursor({
        createdAt: new Date(last._creationTime).toISOString(),
        sessionId: last.sessionId,
      })
    : null;

  return { items, nextCursor, hasMore };
}

export async function listPublished(limit = 200): Promise<SessionRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT * FROM market_signal.sessions WHERE published = TRUE ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(toSession);
}

export async function listCurrentPublished(limit = 200): Promise<CurrentPublishedReportRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT s.*,
            rh.report_key AS head_report_key,
            rh.canonical_label,
            rh.subject_key,
            rh.current_session_id,
            rh.current_slug,
            rh.created_at AS head_created_at,
            rh.updated_at AS head_updated_at
     FROM market_signal.report_heads rh
     JOIN market_signal.sessions s
       ON s.session_id = rh.current_session_id
     WHERE s.published = TRUE
     ORDER BY s.created_at DESC
     LIMIT $1`,
    [limit],
  );

  return rows.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      session: toSession(record),
      head: toReportHead({
        report_key: record.head_report_key,
        canonical_label: record.canonical_label,
        subject_key: record.subject_key,
        current_session_id: record.current_session_id,
        current_slug: record.current_slug,
        created_at: record.head_created_at,
        updated_at: record.head_updated_at,
      }),
    };
  });
}

export async function listCurrentPublishedByAsset(assetKey: string, limit = 50): Promise<CurrentPublishedReportRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT s.*,
            rh.report_key AS head_report_key,
            rh.canonical_label,
            rh.subject_key,
            rh.current_session_id,
            rh.current_slug,
            rh.created_at AS head_created_at,
            rh.updated_at AS head_updated_at
     FROM market_signal.report_heads rh
     JOIN market_signal.sessions s
       ON s.session_id = rh.current_session_id
     WHERE s.published = TRUE
       AND s.asset_key = $1
     ORDER BY s.created_at DESC
     LIMIT $2`,
    [assetKey, limit],
  );

  return rows.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      session: toSession(record),
      head: toReportHead({
        report_key: record.head_report_key,
        canonical_label: record.canonical_label,
        subject_key: record.subject_key,
        current_session_id: record.current_session_id,
        current_slug: record.current_slug,
        created_at: record.head_created_at,
        updated_at: record.head_updated_at,
      }),
    };
  });
}

export async function listByAsset(assetKey: string, limit = 50): Promise<SessionRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT * FROM market_signal.sessions
     WHERE asset_key = $1
       AND status = 'ready'
       AND published = TRUE
     ORDER BY created_at DESC LIMIT $2`,
    [assetKey, limit],
  );
  return rows.map(toSession);
}

export async function getAssetDailyMetric(assetKey: string, metricDate: string): Promise<AssetDailyMetricRow | null> {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT *
     FROM market_signal.asset_daily_metrics
     WHERE asset_key = $1
       AND metric_date = $2::date
     LIMIT 1`,
    [assetKey, metricDate],
  );
  return rows.length ? toAssetDailyMetric(rows[0]) : null;
}

export async function listAssetDailyMetrics(assetKey: string, limit = 120): Promise<AssetDailyMetricRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT *
     FROM market_signal.asset_daily_metrics
     WHERE asset_key = $1
     ORDER BY metric_date DESC
     LIMIT $2`,
    [assetKey, limit],
  );
  return rows.map(toAssetDailyMetric);
}

export async function listAssetArchiveDates(limit = 5000): Promise<Array<{ assetKey: string; metricDate: string; updatedAt: string }>> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT asset_key, metric_date, updated_at
     FROM market_signal.asset_daily_metrics
     ORDER BY metric_date DESC, asset_key ASC
     LIMIT $1`,
    [limit],
  );
  return rows.map((row) => ({
    assetKey: String(row.asset_key || ''),
    metricDate: toDateKey(row.metric_date),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  }));
}

export async function getReportHead(reportKey: string): Promise<ReportHeadRow | null> {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT * FROM market_signal.report_heads WHERE report_key = $1 LIMIT 1`,
    [reportKey],
  );
  return rows.length ? toReportHead(rows[0]) : null;
}

export async function listReportHeads(limit = 300): Promise<ReportHeadRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT * FROM market_signal.report_heads ORDER BY updated_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(toReportHead);
}

export async function listQueryAliases(limit = 600): Promise<QueryAliasRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT * FROM market_signal.query_aliases ORDER BY updated_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(toQueryAlias);
}

// ---------------------------------------------------------------------------
// Monitors
// ---------------------------------------------------------------------------

export async function listMonitors(): Promise<MonitorRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT * FROM market_signal.monitors
     ORDER BY active DESC, created_at DESC`,
  );
  return rows.map(toMonitor);
}

export async function getMonitor(id: string): Promise<MonitorRow | null> {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT * FROM market_signal.monitors WHERE id = $1`,
    [id],
  );
  return rows.length ? toMonitor(rows[0]) : null;
}

export async function createMonitor({
  name,
  topic,
  mode,
  runIntent,
  cadenceMinutes,
  notifyWebhookUrl,
}: {
  name: string;
  topic: string;
  mode: MonitorMode;
  runIntent: MonitorRunIntent;
  cadenceMinutes: MonitorCadenceMinutes;
  notifyWebhookUrl?: string | null;
}): Promise<MonitorRow | null> {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `INSERT INTO market_signal.monitors (name, topic, mode, run_intent, cadence_minutes, notify_webhook_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, topic, mode, runIntent, cadenceMinutes, notifyWebhookUrl || null],
  );
  return rows.length ? toMonitor(rows[0]) : null;
}

export async function updateMonitor(
  id: string,
  patch: {
    name?: string;
    topic?: string;
    mode?: MonitorMode;
    cadenceMinutes?: MonitorCadenceMinutes;
    active?: boolean;
    notifyWebhookUrl?: string | null;
  },
): Promise<MonitorRow | null> {
  const pool = getPool();
  if (!pool) return null;

  const updates: string[] = [];
  const params: unknown[] = [id];
  let idx = 2;

  if (patch.name !== undefined) {
    updates.push(`name = $${idx++}`);
    params.push(patch.name);
  }
  if (patch.topic !== undefined) {
    updates.push(`topic = $${idx++}`);
    params.push(patch.topic);
  }
  if (patch.mode !== undefined) {
    updates.push(`mode = $${idx++}`);
    params.push(patch.mode);
  }
  if (patch.cadenceMinutes !== undefined) {
    updates.push(`cadence_minutes = $${idx++}`);
    params.push(patch.cadenceMinutes);
  }
  if (patch.active !== undefined) {
    updates.push(`active = $${idx++}`);
    params.push(patch.active);
  }
  if (patch.notifyWebhookUrl !== undefined) {
    updates.push(`notify_webhook_url = $${idx++}`);
    params.push(patch.notifyWebhookUrl || null);
  }

  if (!updates.length) {
    return getMonitor(id);
  }

  updates.push('updated_at = NOW()');

  const { rows } = await pool.query(
    `UPDATE market_signal.monitors
     SET ${updates.join(', ')}
     WHERE id = $1
     RETURNING *`,
    params,
  );
  return rows.length ? toMonitor(rows[0]) : null;
}

export async function listMonitorRuns(monitorId: string, limit = 20): Promise<MonitorRunRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT * FROM market_signal.monitor_runs
     WHERE monitor_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [monitorId, limit],
  );
  return rows.map(toMonitorRun);
}

export async function listPublicMonitorTimelineByAsset(assetKey: string, limit = 8): Promise<PublicMonitorTimelineRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT
        m.id AS monitor_id,
        m.name AS monitor_name,
        m.topic,
        mr.session_id,
        s.slug,
        mr.change_score,
        mr.significant,
        mr.summary,
        mr.created_at
       FROM market_signal.monitor_runs mr
       JOIN market_signal.monitors m ON m.id = mr.monitor_id
       LEFT JOIN market_signal.sessions s ON s.session_id = mr.session_id
      WHERE mr.status = 'ready'
        AND s.asset_key = $1
      ORDER BY mr.created_at DESC
      LIMIT $2`,
    [assetKey, limit],
  );
  return rows.map((row) => ({
    monitorId: String(row.monitor_id),
    monitorName: String(row.monitor_name || ''),
    topic: String(row.topic || ''),
    sessionId: typeof row.session_id === 'string' ? row.session_id : null,
    slug: typeof row.slug === 'string' ? row.slug : null,
    changeScore: typeof row.change_score === 'number' ? row.change_score : row.change_score == null ? null : Number(row.change_score),
    significant: typeof row.significant === 'boolean' ? row.significant : row.significant == null ? null : Boolean(row.significant),
    summary: (row.summary ?? {}) as Record<string, unknown>,
    createdAt: new Date(String(row.created_at)).toISOString(),
  }));
}

export async function getMonitorRun(id: string): Promise<MonitorRunRow | null> {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT * FROM market_signal.monitor_runs WHERE id = $1`,
    [id],
  );
  return rows.length ? toMonitorRun(rows[0]) : null;
}

export async function getLatestReadyMonitorRun(
  monitorId: string,
  excludeRunId?: string,
): Promise<MonitorRunRow | null> {
  const pool = getPool();
  if (!pool) return null;
  const params: unknown[] = [monitorId];
  let excludeSql = '';
  if (excludeRunId) {
    params.push(excludeRunId);
    excludeSql = `AND id <> $2`;
  }
  const { rows } = await pool.query(
    `SELECT * FROM market_signal.monitor_runs
     WHERE monitor_id = $1
       AND status = 'ready'
       ${excludeSql}
     ORDER BY created_at DESC
     LIMIT 1`,
    params,
  );
  return rows.length ? toMonitorRun(rows[0]) : null;
}

export async function createManualMonitorRun(monitorId: string): Promise<MonitorRunRow | null> {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `WITH eligible AS (
       SELECT id
       FROM market_signal.monitors
       WHERE id = $1
         AND NOT EXISTS (
           SELECT 1
           FROM market_signal.monitor_runs
           WHERE monitor_id = $1
             AND status IN ('queued', 'running')
             AND created_at >= NOW() - INTERVAL '30 minutes'
         )
     )
     INSERT INTO market_signal.monitor_runs (monitor_id, status)
     SELECT id, 'queued'
     FROM eligible
     RETURNING *`,
    [monitorId],
  );
  return rows.length ? toMonitorRun(rows[0]) : null;
}

export async function claimDueMonitorRuns(limit = 2): Promise<ClaimedMonitorRun[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `WITH due AS (
       SELECT *
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
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     ),
     inserted AS (
       INSERT INTO market_signal.monitor_runs (monitor_id, status)
       SELECT id, 'queued'
       FROM due
       RETURNING *
     )
     SELECT inserted.*, due.name, due.topic, due.mode, due.run_intent, due.cadence_minutes,
            due.active, due.notify_webhook_url, due.last_run_at, due.last_ready_session_id,
            due.last_change_score, due.last_alert_at, due.created_at AS monitor_created_at,
            due.updated_at AS monitor_updated_at
     FROM inserted
     JOIN due ON due.id = inserted.monitor_id`,
    [limit],
  );

  return rows.map((row) => ({
    run: toMonitorRun(row),
    monitor: toMonitor({
      id: row.monitor_id,
      name: row.name,
      topic: row.topic,
      mode: row.mode,
      run_intent: row.run_intent,
      cadence_minutes: row.cadence_minutes,
      active: row.active,
      notify_webhook_url: row.notify_webhook_url,
      last_run_at: row.last_run_at,
      last_ready_session_id: row.last_ready_session_id,
      last_change_score: row.last_change_score,
      last_alert_at: row.last_alert_at,
      created_at: row.monitor_created_at,
      updated_at: row.monitor_updated_at,
    }),
  }));
}

export async function markMonitorRunRunning(runId: string, sessionId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `UPDATE market_signal.monitor_runs
     SET status = 'running', session_id = $2, started_at = NOW()
     WHERE id = $1`,
    [runId, sessionId],
  );
}

export async function completeMonitorRunReady({
  runId,
  baselineSessionId,
  changeScore,
  significant,
  summary,
}: {
  runId: string;
  baselineSessionId: string | null;
  changeScore: number;
  significant: boolean;
  summary: Record<string, unknown>;
}): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `UPDATE market_signal.monitor_runs
     SET status = 'ready',
         baseline_session_id = $2,
         change_score = $3,
         significant = $4,
         summary = $5,
         finished_at = NOW()
     WHERE id = $1`,
    [runId, baselineSessionId, changeScore, significant, JSON.stringify(summary)],
  );
}

export async function completeMonitorRunError(runId: string, error: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `UPDATE market_signal.monitor_runs
     SET status = 'error', error = $2, finished_at = NOW()
     WHERE id = $1`,
    [runId, error],
  );
}

export async function touchMonitorLastRun(monitorId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `UPDATE market_signal.monitors
     SET last_run_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [monitorId],
  );
}

export async function updateMonitorCheckpoint({
  monitorId,
  lastReadySessionId,
  lastChangeScore,
}: {
  monitorId: string;
  lastReadySessionId: string;
  lastChangeScore: number;
}): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `UPDATE market_signal.monitors
     SET last_run_at = NOW(),
         last_ready_session_id = $2,
         last_change_score = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [monitorId, lastReadySessionId, lastChangeScore],
  );
}

export async function markMonitorAlertSent(monitorId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `UPDATE market_signal.monitors
     SET last_alert_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [monitorId],
  );
}

export async function upsertReportHead({
  reportKey,
  canonicalLabel,
  subjectKey,
  currentSessionId,
  currentSlug,
}: {
  reportKey: string;
  canonicalLabel: string;
  subjectKey: string;
  currentSessionId: string;
  currentSlug: string;
}): Promise<ReportHeadRow | null> {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `INSERT INTO market_signal.report_heads (
       report_key,
       canonical_label,
       subject_key,
       current_session_id,
       current_slug
     )
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (report_key) DO UPDATE
       SET canonical_label = COALESCE(NULLIF(EXCLUDED.canonical_label, ''), market_signal.report_heads.canonical_label),
           subject_key = EXCLUDED.subject_key,
           current_session_id = EXCLUDED.current_session_id,
           current_slug = EXCLUDED.current_slug,
           updated_at = NOW()
     RETURNING *`,
    [reportKey, canonicalLabel, subjectKey, currentSessionId, currentSlug],
  );
  return rows.length ? toReportHead(rows[0]) : null;
}

export async function upsertQueryAlias({
  aliasKey,
  aliasLabel,
  targetType,
  reportKey,
  assetKey,
  source,
  confidence,
}: {
  aliasKey: string;
  aliasLabel: string;
  targetType: QueryAliasTargetType;
  reportKey?: string | null;
  assetKey?: string | null;
  source: QueryAliasSource;
  confidence: number;
}): Promise<QueryAliasRow | null> {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `INSERT INTO market_signal.query_aliases (
       alias_key,
       alias_label,
       target_type,
       report_key,
       asset_key,
       source,
       confidence
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (alias_key) DO UPDATE
       SET alias_label = EXCLUDED.alias_label,
           target_type = EXCLUDED.target_type,
           report_key = EXCLUDED.report_key,
           asset_key = EXCLUDED.asset_key,
           source = EXCLUDED.source,
           confidence = EXCLUDED.confidence,
           updated_at = NOW()
     RETURNING *`,
    [aliasKey, aliasLabel, targetType, reportKey || null, assetKey || null, source, confidence],
  );
  return rows.length ? toQueryAlias(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Accumulated assets and source material
// ---------------------------------------------------------------------------

export async function getRecentRawDocument(url: string, reuseHours: number): Promise<string | null> {
  const pool = getPool();
  if (!pool) return null;
  const hours = Math.max(1, Math.min(168, Math.floor(reuseHours || 1)));
  const { rows } = await pool.query<{ markdown: string }>(
    `SELECT markdown
     FROM market_signal.raw_documents
     WHERE url_hash = $1
       AND captured_at >= NOW() - ($2::text || ' hours')::interval
     ORDER BY captured_at DESC
     LIMIT 1`,
    [stableHash(url), hours],
  );
  return rows[0]?.markdown || null;
}

export async function upsertRawDocument({
  url,
  markdown,
  meta = {},
}: {
  url: string;
  markdown: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const pool = getPool();
  if (!pool || !url || !markdown.trim()) return;
  await pool.query(
    `INSERT INTO market_signal.raw_documents (url, url_hash, domain, markdown, meta)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (url) DO UPDATE
       SET url_hash = EXCLUDED.url_hash,
           domain = EXCLUDED.domain,
           markdown = EXCLUDED.markdown,
           meta = EXCLUDED.meta,
           captured_at = NOW()`,
    [url, stableHash(url), domainFromUrl(url), markdown, JSON.stringify(meta)],
  );
}

export async function insertSerpSnapshot({
  query,
  provider = 'brightdata',
  results,
}: {
  query: string;
  provider?: string;
  results: unknown[];
}): Promise<void> {
  const pool = getPool();
  if (!pool || !query.trim()) return;
  await pool.query(
    `INSERT INTO market_signal.serp_snapshots (query_hash, query_text, provider, results)
     VALUES ($1, $2, $3, $4)`,
    [stableHash(query), query, provider, JSON.stringify(results || [])],
  );
}

export async function insertQueryLog({
  input,
  normalized,
  locale,
  surface,
  decision,
  result,
}: {
  input: string;
  normalized?: string | null;
  locale?: string | null;
  surface?: string | null;
  decision?: string | null;
  result?: unknown;
}): Promise<void> {
  const pool = getPool();
  if (!pool || !input.trim()) return;
  await pool.query(
    `INSERT INTO market_signal.query_log (input, normalized, locale, surface, decision, result)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input,
      normalized || null,
      locale || null,
      surface || null,
      decision || null,
      JSON.stringify(result || {}),
    ],
  );
}

export async function listQueryDemand({
  days = 30,
  limit = 50,
}: {
  days?: number;
  limit?: number;
} = {}): Promise<QueryDemandRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const safeDays = Math.max(1, Math.min(365, Math.round(days)));
  const safeLimit = Math.max(1, Math.min(200, Math.round(limit)));
  const { rows } = await pool.query(
    `WITH scoped AS (
       SELECT
         COALESCE(NULLIF(TRIM(normalized), ''), LOWER(TRIM(input))) AS normalized_key,
         input,
         locale,
         surface,
         decision,
         created_at
       FROM market_signal.query_log
       WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
         AND decision IN ('reject', 'run_private', 'ambiguous')
     )
     SELECT
       normalized_key AS normalized,
       (ARRAY_AGG(input ORDER BY created_at DESC))[1] AS sample_input,
       COUNT(*)::int AS count,
       COUNT(*) FILTER (WHERE decision = 'reject')::int AS reject_count,
       COUNT(*) FILTER (WHERE decision = 'run_private')::int AS private_count,
       COUNT(*) FILTER (WHERE decision = 'ambiguous')::int AS ambiguous_count,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT surface), NULL) AS surfaces,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT locale), NULL) AS locales,
       MIN(created_at) AS first_seen_at,
       MAX(created_at) AS latest_seen_at
      FROM scoped
      WHERE normalized_key IS NOT NULL
      GROUP BY normalized_key
      ORDER BY COUNT(*) DESC, MAX(created_at) DESC
      LIMIT $2`,
    [safeDays, safeLimit],
  );

  return rows.map((row) => ({
    normalized: String(row.normalized || ''),
    sampleInput: String(row.sample_input || row.normalized || ''),
    count: Number(row.count || 0),
    rejectCount: Number(row.reject_count || 0),
    privateCount: Number(row.private_count || 0),
    ambiguousCount: Number(row.ambiguous_count || 0),
    surfaces: Array.isArray(row.surfaces) ? row.surfaces.map(String).filter(Boolean) : [],
    locales: Array.isArray(row.locales) ? row.locales.map(String).filter(Boolean) : [],
    firstSeenAt: new Date(String(row.first_seen_at)).toISOString(),
    latestSeenAt: new Date(String(row.latest_seen_at)).toISOString(),
  }));
}

export async function listApprovedDynamicCatalogHeads(limit = 300): Promise<DynamicCatalogHeadRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const safeLimit = Math.max(1, Math.min(1000, Math.round(limit)));
  const { rows } = await pool.query(
    `SELECT *
     FROM market_signal.catalog_heads_dynamic
     WHERE status = 'approved'
     ORDER BY score DESC, updated_at DESC
     LIMIT $1`,
    [safeLimit],
  );
  return rows.map(toDynamicCatalogHead);
}

export async function findApprovedDynamicCatalogHeadForTopic(raw: string): Promise<DynamicCatalogHeadRow | null> {
  const pool = getPool();
  if (!pool || !raw.trim()) return null;
  const key = normalizeDynamicCatalogKey(raw);
  const label = raw.trim().toLowerCase();
  const { rows } = await pool.query(
    `SELECT *
     FROM market_signal.catalog_heads_dynamic
     WHERE status = 'approved'
       AND (
         key = $1
         OR asset_key = $1
         OR report_key = $1
         OR LOWER(label) = $2
         OR EXISTS (
           SELECT 1
           FROM jsonb_array_elements_text(COALESCE(aliases, '[]'::jsonb)) AS alias(value)
           WHERE LOWER(alias.value) = $2 OR alias.value = $1
         )
       )
     ORDER BY score DESC, updated_at DESC
     LIMIT 1`,
    [key, label],
  );
  return rows.length ? toDynamicCatalogHead(rows[0]) : null;
}

export async function upsertDynamicCatalogHead({
  key,
  label,
  assetKey,
  reportKey,
  publicSurface = 'asset_hub',
  priorityTier = 'secondary',
  aliases = [],
  status = 'approved',
  score = 1,
  meta = {},
}: {
  key: string;
  label: string;
  assetKey?: string | null;
  reportKey?: string | null;
  publicSurface?: CatalogPublicSurface;
  priorityTier?: CatalogPriorityTier;
  aliases?: string[];
  status?: DynamicCatalogHeadStatus;
  score?: number;
  meta?: Record<string, unknown>;
}): Promise<DynamicCatalogHeadRow | null> {
  const pool = getPool();
  if (!pool) return null;
  const normalizedKey = normalizeDynamicCatalogKey(key || label);
  const normalizedAssetKey = assetKey ? normalizeDynamicCatalogKey(assetKey) : normalizedKey;
  const normalizedReportKey = reportKey ? normalizeDynamicCatalogKey(reportKey) : `${normalizedAssetKey}-general`;
  const cleanAliases = Array.from(
    new Set(
      [label, key, normalizedKey, normalizedAssetKey, ...aliases]
        .map((alias) => alias.trim())
        .filter(Boolean),
    ),
  ).slice(0, 50);
  const { rows } = await pool.query(
    `INSERT INTO market_signal.catalog_heads_dynamic (
       key,
       label,
       asset_key,
       report_key,
       public_surface,
       priority_tier,
       aliases,
       status,
       score,
       meta
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (key) DO UPDATE
       SET label = EXCLUDED.label,
           asset_key = EXCLUDED.asset_key,
           report_key = EXCLUDED.report_key,
           public_surface = EXCLUDED.public_surface,
           priority_tier = EXCLUDED.priority_tier,
           aliases = EXCLUDED.aliases,
           status = EXCLUDED.status,
           score = EXCLUDED.score,
           meta = market_signal.catalog_heads_dynamic.meta || EXCLUDED.meta,
           updated_at = NOW()
     RETURNING *`,
    [
      normalizedKey,
      label.trim(),
      normalizedAssetKey,
      normalizedReportKey,
      publicSurface,
      priorityTier,
      JSON.stringify(cleanAliases),
      status,
      score,
      JSON.stringify(meta),
    ],
  );
  return rows.length ? toDynamicCatalogHead(rows[0]) : null;
}

export async function materializeSessionEvidence({
  sessionId,
  assetKey,
  evidence,
}: {
  sessionId: string;
  assetKey?: string | null;
  evidence: Array<{
    title: string;
    url: string;
    source: string;
    publishedAt: number;
    observedAt: number;
    excerpt?: string;
    excerptSource?: string;
    aiSummary?: unknown;
  }>;
}): Promise<void> {
  const pool = getPool();
  if (!pool || !evidence.length) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [rank, item] of evidence.entries()) {
      if (!item.url) continue;
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO market_signal.evidence_documents (
           url,
           url_hash,
           title,
           source,
           published_at,
           observed_at,
           excerpt,
           meta
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (url_hash) DO UPDATE
           SET title = COALESCE(EXCLUDED.title, market_signal.evidence_documents.title),
               source = COALESCE(EXCLUDED.source, market_signal.evidence_documents.source),
               published_at = COALESCE(EXCLUDED.published_at, market_signal.evidence_documents.published_at),
               observed_at = COALESCE(EXCLUDED.observed_at, market_signal.evidence_documents.observed_at),
               excerpt = COALESCE(EXCLUDED.excerpt, market_signal.evidence_documents.excerpt),
               meta = market_signal.evidence_documents.meta || EXCLUDED.meta
         RETURNING id`,
        [
          item.url,
          stableHash(item.url),
          item.title || null,
          item.source || domainFromUrl(item.url),
          toIsoOrNull(item.publishedAt),
          toIsoOrNull(item.observedAt),
          item.excerpt || null,
          JSON.stringify({
            assetKey: assetKey || null,
            excerptSource: item.excerptSource || null,
            aiSummary: item.aiSummary || null,
          }),
        ],
      );
      const evidenceId = rows[0]?.id;
      if (!evidenceId) continue;
      await client.query(
        `INSERT INTO market_signal.session_evidence (session_id, evidence_id, rank, meta)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id, evidence_id) DO UPDATE
           SET rank = EXCLUDED.rank,
               meta = EXCLUDED.meta`,
        [
          sessionId,
          evidenceId,
          rank,
          JSON.stringify({
            assetKey: assetKey || null,
            source: item.source,
          }),
        ],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function checkRateLimitCounter({
  bucket,
  max,
  windowMs,
}: {
  bucket: string;
  max: number;
  windowMs: number;
}): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  resetMs: number;
}> {
  const pool = getPool();
  if (!pool) throw new Error('Database not configured');
  const { rows } = await pool.query<{ hits: number; reset_at: string }>(
    `INSERT INTO market_signal.rate_limit_counters (bucket, hits, reset_at)
     VALUES ($1, 1, NOW() + ($2::text || ' milliseconds')::interval)
     ON CONFLICT (bucket) DO UPDATE
       SET hits = CASE
             WHEN market_signal.rate_limit_counters.reset_at <= NOW() THEN 1
             WHEN market_signal.rate_limit_counters.hits < $3 THEN market_signal.rate_limit_counters.hits + 1
             ELSE market_signal.rate_limit_counters.hits
           END,
           reset_at = CASE
             WHEN market_signal.rate_limit_counters.reset_at <= NOW()
             THEN NOW() + ($2::text || ' milliseconds')::interval
             ELSE market_signal.rate_limit_counters.reset_at
           END,
           updated_at = NOW()
     RETURNING hits, reset_at`,
    [bucket, windowMs, max],
  );
  const row = rows[0];
  const hits = Number(row?.hits || 0);
  const resetAt = row?.reset_at ? new Date(row.reset_at).getTime() : Date.now() + windowMs;
  return {
    allowed: hits <= max,
    remaining: Math.max(0, max - hits),
    limit: max,
    resetMs: Math.max(0, resetAt - Date.now()),
  };
}

export async function upsertSubscriber({
  email,
  assetKey,
  tokenHash,
}: {
  email: string;
  assetKey: string;
  tokenHash: string;
}): Promise<{ status: string } | null> {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query<{ status: string }>(
    `INSERT INTO market_signal.subscribers (email, asset_key, status, token_hash)
     VALUES ($1, $2, 'pending', $3)
     ON CONFLICT (email, asset_key) DO UPDATE
       SET token_hash = EXCLUDED.token_hash,
           status = CASE
             WHEN market_signal.subscribers.status = 'confirmed' THEN 'confirmed'
             ELSE 'pending'
           END,
           unsubscribed_at = NULL
     RETURNING status`,
    [email.trim().toLowerCase(), assetKey, tokenHash],
  );
  return rows[0] || null;
}

export async function listConfirmedSubscribersByAsset(assetKey: string): Promise<ConfirmedSubscriberRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT email, asset_key, token_hash
       FROM market_signal.subscribers
      WHERE asset_key = $1
        AND status = 'confirmed'
        AND unsubscribed_at IS NULL
      ORDER BY confirmed_at DESC NULLS LAST, created_at DESC`,
    [assetKey],
  );
  return rows.map((row) => ({
    email: String(row.email || ''),
    assetKey: String(row.asset_key || ''),
    tokenHash: String(row.token_hash || ''),
  })).filter((row) => row.email && row.tokenHash);
}

export async function upsertAssetDailyMetric({
  assetKey,
  metricDate,
  summary,
  metrics,
}: {
  assetKey: string;
  metricDate: string;
  summary: Record<string, unknown>;
  metrics?: Record<string, unknown>;
}): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO market_signal.asset_daily_metrics (asset_key, metric_date, summary, metrics)
     VALUES ($1, $2::date, $3, $4)
     ON CONFLICT (asset_key, metric_date) DO UPDATE
       SET summary = EXCLUDED.summary,
           metrics = EXCLUDED.metrics,
           updated_at = NOW()`,
    [assetKey, metricDate, JSON.stringify(summary), JSON.stringify(metrics || {})],
  );
}

export async function confirmSubscriber(tokenHash: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  const { rowCount } = await pool.query(
    `UPDATE market_signal.subscribers
     SET status = 'confirmed',
         confirmed_at = COALESCE(confirmed_at, NOW()),
         unsubscribed_at = NULL
     WHERE token_hash = $1
       AND status <> 'unsubscribed'`,
    [tokenHash],
  );
  return Boolean(rowCount);
}

export async function unsubscribeSubscriber(tokenHash: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  const { rowCount } = await pool.query(
    `UPDATE market_signal.subscribers
     SET status = 'unsubscribed',
         unsubscribed_at = NOW()
     WHERE token_hash = $1`,
    [tokenHash],
  );
  return Boolean(rowCount);
}

// ---------------------------------------------------------------------------
// Event mutations
// ---------------------------------------------------------------------------

export async function insertEvent(
  sessionId: string,
  type: string,
  payload: unknown,
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO market_signal.session_events (session_id, type, payload) VALUES ($1, $2, $3)`,
    [sessionId, type, JSON.stringify(payload ?? {})],
  );
}

export async function insertEventBatch(
  events: Array<{ sessionId: string; type: string; payload: unknown }>,
): Promise<void> {
  const pool = getPool();
  if (!pool || events.length === 0) return;

  const values: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  for (const ev of events) {
    values.push(`($${idx++}, $${idx++}, $${idx++})`);
    params.push(ev.sessionId, ev.type, JSON.stringify(ev.payload ?? {}));
  }
  await pool.query(
    `INSERT INTO market_signal.session_events (session_id, type, payload) VALUES ${values.join(', ')}`,
    params,
  );
}

// ---------------------------------------------------------------------------
// Event queries
// ---------------------------------------------------------------------------

export async function listEvents(sessionId: string, limit = 250): Promise<EventRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT * FROM market_signal.session_events WHERE session_id = $1 ORDER BY id ASC LIMIT $2`,
    [sessionId, limit],
  );
  return rows.map(toEvent);
}

export async function listEventsPage({
  sessionId,
  limit = 250,
  cursor,
}: {
  sessionId: string;
  limit?: number;
  cursor?: string;
}): Promise<CursorPage<EventRow>> {
  const pool = getPool();
  if (!pool) return { items: [], nextCursor: null, hasMore: false };

  const parsedCursor = decodeCursor<{ id: number }>(cursor);
  const params: unknown[] = [sessionId];
  let where = `WHERE session_id = $1`;
  if (parsedCursor?.id && Number.isFinite(parsedCursor.id)) {
    params.push(parsedCursor.id);
    where += ` AND id > $2`;
  }
  params.push(limit + 1);
  const limitParam = params.length;

  const { rows } = await pool.query(
    `SELECT * FROM market_signal.session_events
     ${where}
     ORDER BY id ASC
     LIMIT $${limitParam}`,
    params,
  );

  const mapped = rows.map(toEvent);
  const hasMore = mapped.length > limit;
  const items = hasMore ? mapped.slice(0, limit) : mapped;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ id: last.id }) : null;

  return { items, nextCursor, hasMore };
}

// ---------------------------------------------------------------------------
// Cleanup (replaces Convex scheduler TTL)
// ---------------------------------------------------------------------------

export async function deleteExpired(): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  const { rowCount } = await pool.query(
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
  return rowCount ?? 0;
}

// ---------------------------------------------------------------------------
// Health probe
// ---------------------------------------------------------------------------

export async function probeDb(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const pool = getPool();
  if (!pool) return { ok: false, latencyMs: 0, error: 'missing-url' };
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function probeDbSchema(): Promise<DbSchemaProbe> {
  const pool = getPool();
  if (!pool) return { ok: false, latencyMs: 0, missing: ['database_url'], present: [], error: 'missing-url' };

  const requiredRelations = [
    'market_signal.sessions',
    'market_signal.session_events',
    'market_signal.monitors',
    'market_signal.monitor_runs',
    'market_signal.report_heads',
    'market_signal.query_aliases',
    'market_signal.provider_usage_daily',
    'market_signal.raw_documents',
    'market_signal.serp_snapshots',
    'market_signal.evidence_documents',
    'market_signal.session_evidence',
    'market_signal.asset_daily_metrics',
    'market_signal.query_log',
    'market_signal.catalog_heads_dynamic',
    'market_signal.subscribers',
    'market_signal.rate_limit_counters',
    'market_signal.idx_sessions_slug',
    'market_signal.idx_sessions_asset',
    'market_signal.idx_sessions_report_key',
    'market_signal.idx_sessions_created_session',
    'market_signal.idx_sessions_status_created_session',
    'market_signal.idx_events_session',
    'market_signal.idx_events_session_id',
    'market_signal.idx_monitors_active_last_run',
    'market_signal.idx_monitor_runs_monitor_created',
    'market_signal.idx_monitor_runs_status_created',
    'market_signal.idx_report_heads_subject_updated',
    'market_signal.idx_report_heads_current_slug',
    'market_signal.idx_query_aliases_target_type',
    'market_signal.idx_query_aliases_report_key',
    'market_signal.idx_query_aliases_asset_key',
    'market_signal.idx_provider_usage_daily_provider',
    'market_signal.idx_raw_documents_url_captured',
    'market_signal.idx_raw_documents_domain',
    'market_signal.idx_serp_snapshots_query',
    'market_signal.idx_evidence_documents_url',
    'market_signal.idx_session_evidence_session',
    'market_signal.idx_asset_daily_metrics_asset_date',
    'market_signal.idx_query_log_created',
    'market_signal.idx_query_log_decision_created',
    'market_signal.idx_query_log_normalized_created',
    'market_signal.idx_catalog_heads_dynamic_status',
    'market_signal.idx_catalog_heads_dynamic_asset',
    'market_signal.idx_catalog_heads_dynamic_report',
    'market_signal.idx_subscribers_asset',
    'market_signal.idx_rate_limit_counters_expires',
  ];

  const startedAt = Date.now();
  try {
    const { rows } = await pool.query<{ name: string; exists: string | null }>(
      `SELECT item.name, to_regclass(item.name) AS exists
       FROM unnest($1::text[]) AS item(name)`,
      [requiredRelations],
    );

    const present = rows.filter((row) => row.exists).map((row) => row.name);
    const missing = rows.filter((row) => !row.exists).map((row) => row.name);

    return {
      ok: missing.length === 0,
      latencyMs: Date.now() - startedAt,
      missing,
      present,
    };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      missing: requiredRelations,
      present: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
