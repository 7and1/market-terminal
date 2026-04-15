import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSnapshotAuthCookie } from '@/lib/session-write-auth';

const hasDb = vi.fn();
const getSession = vi.fn();
const patchMeta = vi.fn();
const buildSessionDiffSummary = vi.fn();
const promoteReadySessionToPublicHead = vi.fn();

vi.mock('@/lib/db', () => ({
  hasDb,
  getSession,
  patchMeta,
}));

vi.mock('@/lib/monitoring', () => ({
  buildSessionDiffSummary,
}));

vi.mock('@/lib/publish-session', () => ({
  promoteReadySessionToPublicHead,
}));

const publishableMeta = {
  artifacts: {
    evidence: [
      { id: 'ev_1', title: 'Reuters', url: 'https://www.reuters.com/world/us/markets-story', source: 'Reuters', publishedAt: Date.UTC(2026, 2, 19, 11, 0), observedAt: Date.UTC(2026, 2, 19, 11, 5), timeKind: 'published' as const },
      { id: 'ev_2', title: 'CNBC', url: 'https://www.cnbc.com/2026/03/19/market-story.html', source: 'CNBC', publishedAt: Date.UTC(2026, 2, 19, 11, 0), observedAt: Date.UTC(2026, 2, 19, 11, 5), timeKind: 'published' as const },
    ],
  },
};

describe('/api/sessions/publish POST', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-19T11:00:00.000Z'));
    process.env.DATABASE_URL = 'postgres://snapshot:test@localhost:5432/app';
    hasDb.mockReturnValue(true);
    patchMeta.mockResolvedValue(undefined);
    promoteReadySessionToPublicHead.mockResolvedValue({
      ok: true,
      alreadyPublished: false,
      slug: 'bitcoin-2026-03-19-8d0e2f3d',
      assetKey: 'bitcoin',
      reportKey: 'bitcoin-price-move',
      canonicalLabel: 'Bitcoin price move',
      subjectKey: 'bitcoin',
      previousHead: null,
    });
    buildSessionDiffSummary.mockResolvedValue({
      changeScore: 0,
      headline: 'Stable',
      summary: 'No prior baseline.',
      sentimentShift: 'flat',
      newEvidence: [],
      newCatalysts: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 400 for invalid request bodies', async () => {
    const { POST } = await import('@/app/api/sessions/publish/route');
    const response = await POST(
      new Request('http://x/p', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 'bad-id' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(promoteReadySessionToPublicHead).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller does not own the session', async () => {
    const { POST } = await import('@/app/api/sessions/publish/route');
    const response = await POST(
      new Request('http://x/p', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f' }),
      }),
    );

    expect(response.status).toBe(403);
    expect(getSession).not.toHaveBeenCalled();
    expect(promoteReadySessionToPublicHead).not.toHaveBeenCalled();
  });

  it('returns alreadyPublished when a session already has a slug', async () => {
    const sessionId = '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f';
    getSession.mockResolvedValue({
      sessionId,
      topic: 'Bitcoin',
      status: 'ready',
      meta: { locale: 'es' },
      published: true,
      slug: 'bitcoin-2026-03-19-8d0e',
    });

    const { POST } = await import('@/app/api/sessions/publish/route');
    const response = await POST(
      new Request('http://x/p', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: createSnapshotAuthCookie(sessionId) || '',
        },
        body: JSON.stringify({ sessionId }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.alreadyPublished).toBe(true);
    expect(json.slug).toBe('bitcoin-2026-03-19-8d0e');
    expect(json.locale).toBe('es');
    expect(promoteReadySessionToPublicHead).not.toHaveBeenCalled();
  });

  it('returns slug plus locale for successful publishes', async () => {
    const sessionId = '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f';
    getSession.mockResolvedValue({
      sessionId,
      topic: 'Bitcoin',
      status: 'ready',
      meta: publishableMeta,
      published: false,
      slug: null,
    });

    const { POST } = await import('@/app/api/sessions/publish/route');
    const response = await POST(
      new Request('http://x/p', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: createSnapshotAuthCookie(sessionId) || '',
        },
        body: JSON.stringify({ sessionId, locale: 'zh' }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.slug).toBe('bitcoin-2026-03-19-8d0e2f3d');
    expect(json.locale).toBe('zh');
    expect(json.alreadyPublished).toBe(false);
    expect(json.reportKey).toBe('bitcoin-price-move');
    expect(promoteReadySessionToPublicHead).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'Bitcoin' }),
      { locale: 'zh' },
    );
    expect(promoteReadySessionToPublicHead).toHaveBeenCalledTimes(1);
  });

  it('publishes curated comparison heads as public reports', async () => {
    const sessionId = '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f';
    promoteReadySessionToPublicHead.mockResolvedValueOnce({
      ok: true,
      alreadyPublished: false,
      slug: 'bitcoin-vs-gold-today-2026-03-19-8d0e',
      assetKey: 'gold',
      reportKey: 'gold-vs-bitcoin-comparison',
      canonicalLabel: 'Gold vs Bitcoin',
      subjectKey: 'gold-vs-bitcoin',
      previousHead: null,
    });
    getSession.mockResolvedValue({
      sessionId,
      topic: 'Bitcoin vs Gold today',
      status: 'ready',
      meta: publishableMeta,
      published: false,
      slug: null,
    });

    const { POST } = await import('@/app/api/sessions/publish/route');
    const response = await POST(
      new Request('http://x/p', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: createSnapshotAuthCookie(sessionId) || '',
        },
        body: JSON.stringify({ sessionId }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.reportKey).toBe('gold-vs-bitcoin-comparison');
    expect(json.canonicalLabel).toBe('Gold vs Bitcoin');
  });

  it('rejects publication when evidence quality is below the public threshold', async () => {
    const sessionId = '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f';
    getSession.mockResolvedValue({
      sessionId,
      topic: 'Bitcoin',
      status: 'ready',
      meta: publishableMeta,
      published: false,
      slug: null,
    });
    promoteReadySessionToPublicHead.mockResolvedValueOnce({
      ok: false,
      status: 422,
      error: 'This run does not meet the public report threshold yet.',
      code: 'INSUFFICIENT_REPORT_QUALITY',
      quality: {
        evidenceCount: 2,
        uniqueDomainCount: 1,
        latestEvidenceAt: null,
        officialCount: 0,
        primaryCount: 0,
        secondaryCount: 2,
        primaryLikeCount: 0,
        topDomains: ['example.com'],
        publishable: false,
        issues: ['Need at least 5 evidence items; found 2.'],
      },
    });

    const { POST } = await import('@/app/api/sessions/publish/route');
    const response = await POST(
      new Request('http://x/p', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: createSnapshotAuthCookie(sessionId) || '',
        },
        body: JSON.stringify({ sessionId }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.code).toBe('INSUFFICIENT_REPORT_QUALITY');
    expect(promoteReadySessionToPublicHead).toHaveBeenCalledTimes(1);
  });

  it('rejects publication for private-only composite queries', async () => {
    const sessionId = '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f';
    getSession.mockResolvedValue({
      sessionId,
      topic: 'Gold vs Ethereum today',
      status: 'ready',
      meta: publishableMeta,
      published: false,
      slug: null,
    });
    promoteReadySessionToPublicHead.mockResolvedValueOnce({
      ok: false,
      status: 422,
      error: 'This analysis remains a private saved session because the query does not map to a canonical public asset head.',
      code: 'PRIVATE_ONLY_SESSION',
      visibility: 'private',
      canonicalLabel: 'Gold vs Ethereum',
    });

    const { POST } = await import('@/app/api/sessions/publish/route');
    const response = await POST(
      new Request('http://x/p', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: createSnapshotAuthCookie(sessionId) || '',
        },
        body: JSON.stringify({ sessionId }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.code).toBe('PRIVATE_ONLY_SESSION');
    expect(promoteReadySessionToPublicHead).toHaveBeenCalledTimes(1);
  });
});
