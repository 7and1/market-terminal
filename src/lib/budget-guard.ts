import pg from 'pg';

import { env } from '@/lib/env';
import { createLogger } from '@/lib/log';

const { Pool } = pg;

type ProviderName = 'brightdata' | 'openrouter';
type ProviderUsage = { ok: boolean; calls: number; limit: number; warn?: string };

let _pool: pg.Pool | null = null;
const PROVIDER_USAGE_CACHE_MS = 30_000;
const usageCache = new Map<ProviderName, { expiresAt: number; value: ProviderUsage }>();

function getBudgetPool(): pg.Pool | null {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  _pool = new Pool({
    connectionString: url,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
  });
  _pool.on('error', (err) => {
    console.error('[budget] pool error', err.message);
  });
  return _pool;
}

export function providerDailyLimit(provider: ProviderName) {
  return provider === 'brightdata'
    ? env.budget.dailyBrightDataCallLimit
    : env.budget.dailyOpenRouterCallLimit;
}

export async function getProviderUsage(provider: ProviderName): Promise<ProviderUsage> {
  const limit = providerDailyLimit(provider);
  const cached = usageCache.get(provider);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pool = getBudgetPool();
  if (!pool) return { ok: true, calls: 0, limit, warn: 'database unavailable for budget guard' };

  try {
    const { rows } = await pool.query<{ calls: string | number }>(
      `SELECT calls
       FROM market_signal.provider_usage_daily
       WHERE provider = $1 AND usage_date = CURRENT_DATE`,
      [provider],
    );
    const calls = Number(rows[0]?.calls || 0);
    const usage = { ok: calls < limit, calls, limit };
    usageCache.set(provider, { expiresAt: Date.now() + PROVIDER_USAGE_CACHE_MS, value: usage });
    return usage;
  } catch (error) {
    createLogger({ route: 'budget-guard' }).warn('budget.usage_read_failed', {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: true, calls: 0, limit, warn: 'budget table unavailable' };
  }
}

export async function assertProviderBudget(provider: ProviderName): Promise<void> {
  const usage = await getProviderUsage(provider);
  if (!usage.ok) {
    throw new Error(`${provider} daily call limit exceeded (${usage.calls}/${usage.limit})`);
  }
}

export async function recordProviderCall(
  provider: ProviderName,
  details: { ok: boolean; operation?: string; tokens?: number } = { ok: true },
): Promise<void> {
  usageCache.delete(provider);
  const pool = getBudgetPool();
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO market_signal.provider_usage_daily
        (usage_date, provider, calls, failures, tokens, meta, updated_at)
       VALUES
        (CURRENT_DATE, $1, 1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (usage_date, provider) DO UPDATE
       SET calls = market_signal.provider_usage_daily.calls + 1,
           failures = market_signal.provider_usage_daily.failures + EXCLUDED.failures,
           tokens = market_signal.provider_usage_daily.tokens + EXCLUDED.tokens,
           meta = market_signal.provider_usage_daily.meta || EXCLUDED.meta,
           updated_at = NOW()`,
      [
        provider,
        details.ok ? 0 : 1,
        Math.max(0, Math.floor(details.tokens || 0)),
        JSON.stringify(details.operation ? { lastOperation: details.operation } : {}),
      ],
    );
  } catch (error) {
    createLogger({ route: 'budget-guard' }).warn('budget.usage_write_failed', {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
