import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, on } = vi.hoisted(() => ({
  query: vi.fn(),
  on: vi.fn(),
}));

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(() => ({
      query,
      on,
    })),
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    budget: {
      dailyBrightDataCallLimit: 2,
      dailyOpenRouterCallLimit: 3,
    },
  },
}));

describe('budget-guard', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.DATABASE_URL;
  });

  it('fails open when DATABASE_URL is not configured', async () => {
    const { getProviderUsage } = await import('@/lib/budget-guard');

    await expect(getProviderUsage('brightdata')).resolves.toMatchObject({
      ok: true,
      calls: 0,
      limit: 2,
      warn: 'database unavailable for budget guard',
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('marks provider usage exhausted when calls reach the configured daily limit', async () => {
    process.env.DATABASE_URL = 'postgres://budget:test@localhost:5432/app';
    query.mockResolvedValueOnce({ rows: [{ calls: '3' }] });

    const { getProviderUsage } = await import('@/lib/budget-guard');
    const usage = await getProviderUsage('openrouter');

    expect(usage).toEqual({
      ok: false,
      calls: 3,
      limit: 3,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM market_signal.provider_usage_daily'),
      ['openrouter'],
    );
  });

  it('caches successful provider usage reads briefly', async () => {
    process.env.DATABASE_URL = 'postgres://budget:test@localhost:5432/app';
    query.mockResolvedValueOnce({ rows: [{ calls: '1' }] });

    const { getProviderUsage } = await import('@/lib/budget-guard');
    const first = await getProviderUsage('brightdata');
    const second = await getProviderUsage('brightdata');

    expect(first).toEqual({
      ok: true,
      calls: 1,
      limit: 2,
    });
    expect(second).toEqual(first);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('fails open when the budget table cannot be read', async () => {
    process.env.DATABASE_URL = 'postgres://budget:test@localhost:5432/app';
    query.mockRejectedValueOnce(new Error('relation does not exist'));

    const { getProviderUsage } = await import('@/lib/budget-guard');
    const usage = await getProviderUsage('brightdata');

    expect(usage).toMatchObject({
      ok: true,
      calls: 0,
      limit: 2,
      warn: 'budget table unavailable',
    });
  });

  it('invalidates cached provider usage after recording a provider call', async () => {
    process.env.DATABASE_URL = 'postgres://budget:test@localhost:5432/app';
    query
      .mockResolvedValueOnce({ rows: [{ calls: '1' }] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ calls: '2' }] });

    const { getProviderUsage, recordProviderCall } = await import('@/lib/budget-guard');
    await expect(getProviderUsage('brightdata')).resolves.toMatchObject({ calls: 1 });
    await recordProviderCall('brightdata', { ok: true, operation: 'search' });
    await expect(getProviderUsage('brightdata')).resolves.toMatchObject({ calls: 2 });

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0]?.[1]).toEqual(['brightdata']);
    expect(query.mock.calls[2]?.[1]).toEqual(['brightdata']);
  });

  it('records calls, failures, tokens, and operation metadata with an idempotent upsert', async () => {
    process.env.DATABASE_URL = 'postgres://budget:test@localhost:5432/app';
    query.mockResolvedValueOnce({ rowCount: 1 });

    const { recordProviderCall } = await import('@/lib/budget-guard');
    await recordProviderCall('brightdata', {
      ok: false,
      operation: 'markdown',
      tokens: 12.8,
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT (usage_date, provider) DO UPDATE');
    expect(sql).toContain('calls = market_signal.provider_usage_daily.calls + 1');
    expect(params).toEqual([
      'brightdata',
      1,
      12,
      JSON.stringify({ lastOperation: 'markdown' }),
    ]);
  });
});
