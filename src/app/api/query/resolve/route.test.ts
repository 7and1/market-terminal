import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveTopicQuery = vi.fn();

vi.mock('@/lib/topic-resolution', () => ({
  resolveTopicQuery,
}));

describe('/api/query/resolve POST', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
