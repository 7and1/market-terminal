import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hasDb = vi.fn();
const getSession = vi.fn();
const publishSession = vi.fn();

vi.mock('@/lib/db', () => ({
  hasDb,
  getSession,
  publishSession,
}));

function buildEvidence(url: string, source = 'Reuters') {
  return {
    id: `ev_${Buffer.from(url).toString('base64').slice(0, 8)}`,
    title: `Evidence for ${url}`,
    url,
    source,
    publishedAt: Date.UTC(2026, 2, 19, 11, 0),
    observedAt: Date.UTC(2026, 2, 19, 11, 5),
    timeKind: 'published' as const,
  };
}

const publishableMeta = {
  artifacts: {
    evidence: [
      buildEvidence('https://www.reuters.com/world/us/markets-story', 'Reuters'),
      buildEvidence('https://www.cnbc.com/2026/03/19/market-story.html', 'CNBC'),
      buildEvidence('https://investor.nvidia.com/financial-reports/default.aspx', 'NVIDIA Investor Relations'),
      buildEvidence('https://www.marketwatch.com/story/market-story', 'MarketWatch'),
      buildEvidence('https://www.wsj.com/finance/markets/story', 'WSJ'),
    ],
  },
};

describe('/api/sessions/publish POST', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-19T11:00:00.000Z'));
    hasDb.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 400 for invalid request bodies', async () => {
    const { POST } = await import('@/app/api/sessions/publish/route');
    const response = await POST(
      new Request('http://localhost/api/sessions/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 'bad-id' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(publishSession).not.toHaveBeenCalled();
  });

  it('returns alreadyPublished when a session already has a slug', async () => {
    getSession.mockResolvedValue({
      sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f',
      topic: 'Bitcoin',
      status: 'ready',
      meta: {},
      published: true,
      slug: 'bitcoin-2026-03-19-8d0e',
    });

    const { POST } = await import('@/app/api/sessions/publish/route');
    const response = await POST(
      new Request('http://localhost/api/sessions/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f' }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.alreadyPublished).toBe(true);
    expect(json.slug).toBe('bitcoin-2026-03-19-8d0e');
    expect(publishSession).not.toHaveBeenCalled();
  });

  it('retries with a longer suffix when the first slug collides', async () => {
    getSession.mockResolvedValue({
      sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f',
      topic: 'Bitcoin',
      status: 'ready',
      meta: publishableMeta,
      published: false,
      slug: null,
    });
    publishSession
      .mockRejectedValueOnce(
        Object.assign(new Error('duplicate key value violates unique constraint'), {
          code: '23505',
          constraint: 'sessions_slug_key',
        }),
      )
      .mockResolvedValueOnce(undefined);

    const { POST } = await import('@/app/api/sessions/publish/route');
    const response = await POST(
      new Request('http://localhost/api/sessions/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f' }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(publishSession).toHaveBeenNthCalledWith(
      1,
      '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f',
      'bitcoin-2026-03-19-8d0e',
      'bitcoin',
    );
    expect(publishSession).toHaveBeenNthCalledWith(
      2,
      '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f',
      'bitcoin-2026-03-19-8d0e2f3d',
      'bitcoin',
    );
    expect(json.slug).toBe('bitcoin-2026-03-19-8d0e2f3d');
  });

  it('rejects publication when evidence quality is below the public threshold', async () => {
    getSession.mockResolvedValue({
      sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f',
      topic: 'Bitcoin',
      status: 'ready',
      meta: {
        artifacts: {
          evidence: [
            buildEvidence('https://example.com/a', 'Example'),
            buildEvidence('https://example.com/b', 'Example'),
          ],
        },
      },
      published: false,
      slug: null,
    });

    const { POST } = await import('@/app/api/sessions/publish/route');
    const response = await POST(
      new Request('http://localhost/api/sessions/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f' }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.code).toBe('INSUFFICIENT_REPORT_QUALITY');
    expect(publishSession).not.toHaveBeenCalled();
  });
});
