import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveTopicQuery = vi.fn();
const insertQueryLog = vi.fn();
const checkRateLimitCounter = vi.fn();

vi.mock('@/lib/topic-resolution', () => ({
  resolveTopicQuery,
}));

vi.mock('@/lib/db', () => ({
  insertQueryLog,
  checkRateLimitCounter,
}));

describe('/api/query/resolve POST', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    insertQueryLog.mockResolvedValue(undefined);
    checkRateLimitCounter.mockResolvedValue({ allowed: true, remaining: 29, limit: 30, resetMs: 60_000 });
    delete process.env.DATABASE_URL;
  });

  it('returns 400 for invalid request bodies', async () => {
    const { POST } = await import('@/app/api/query/resolve/route');
    const response = await POST(
      new Request('http://localhost/api/query/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: '' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(resolveTopicQuery).not.toHaveBeenCalled();
  });

  it('returns 429 when the query resolve rate limit is exceeded', async () => {
    process.env.DATABASE_URL = 'postgres://rate-limit:test@localhost:5432/app';
    checkRateLimitCounter.mockResolvedValueOnce({ allowed: false, remaining: 0, limit: 30, resetMs: 42_000 });

    const { POST } = await import('@/app/api/query/resolve/route');
    const response = await POST(
      new Request('http://localhost/api/query/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'NVDA after earnings' }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('30');
    expect(response.headers.get('X-RateLimit-Backend')).toBe('pg');
    expect(json.error).toBe('Too many requests');
    expect(resolveTopicQuery).not.toHaveBeenCalled();
  });

  it('returns resolver payloads for successful requests', async () => {
    resolveTopicQuery.mockResolvedValue({
      decision: 'reuse',
      reuseType: 'report',
      typedQuery: 'NVDA after earnings',
      canonicalLabel: 'NVDA after earnings',
      lastUpdatedAt: '2026-03-26T00:00:00.000Z',
      currentReport: {
        reportKey: 'nvda-earnings-impact-earnings',
        slug: 'nvda-after-earnings-2026-03-26-abcd',
        sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f',
      },
      actions: ['open_current_report', 'scrape_again'],
    });

    const { POST } = await import('@/app/api/query/resolve/route');
    const response = await POST(
      new Request('http://localhost/api/query/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'NVDA after earnings', surface: 'landing' }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(resolveTopicQuery).toHaveBeenCalledWith({
      input: 'NVDA after earnings',
      surface: 'landing',
    });
    expect(json.decision).toBe('reuse');
    expect(json.currentReport.slug).toBe('nvda-after-earnings-2026-03-26-abcd');
    expect(insertQueryLog).toHaveBeenCalledWith({
      input: 'NVDA after earnings',
      normalized: 'NVDA after earnings',
      locale: null,
      surface: 'landing',
      decision: 'reuse',
      result: expect.objectContaining({ decision: 'reuse' }),
    });
  });

  it('forwards locale when provided', async () => {
    resolveTopicQuery.mockResolvedValue({
      decision: 'run_private',
      typedQuery: 'Gold vs Ethereum today',
      canonicalLabel: 'Gold vs Ethereum',
      visibility: 'private',
      message: '这是一个有效的复合市场查询，但在 v1 中只会保留为私有。',
    });

    const { POST } = await import('@/app/api/query/resolve/route');
    const response = await POST(
      new Request('http://localhost/api/query/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'Gold vs Ethereum today', surface: 'landing', locale: 'zh' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(resolveTopicQuery).toHaveBeenCalledWith({
      input: 'Gold vs Ethereum today',
      surface: 'landing',
      locale: 'zh',
    });
  });
});
