import { beforeEach, describe, expect, it, vi } from 'vitest';

const completeMonitorRunError = vi.fn();
const completeMonitorRunReady = vi.fn();
const touchMonitorLastRun = vi.fn();
const updateMonitorCheckpoint = vi.fn();
const markMonitorRunRunning = vi.fn();
const getLatestReadyMonitorRun = vi.fn();
const getSession = vi.fn();
const listConfirmedSubscribersByAsset = vi.fn();
const patchMeta = vi.fn();
const markMonitorAlertSent = vi.fn();
const executeRun = vi.fn();
const promoteReadySessionToPublicHead = vi.fn();
const getCanonicalHeadByKey = vi.fn();
const deriveTopicVisibility = vi.fn();
const isSubscriptionEmailConfigured = vi.fn();
const sendMonitorAlertEmail = vi.fn();
const fetchMock = vi.fn();

vi.mock('@/lib/db', () => ({
  claimDueMonitorRuns: vi.fn(),
  completeMonitorRunError,
  completeMonitorRunReady,
  createManualMonitorRun: vi.fn(),
  getLatestReadyMonitorRun,
  getMonitor: vi.fn(),
  getSession,
  listConfirmedSubscribersByAsset,
  markMonitorAlertSent,
  markMonitorRunRunning,
  patchMeta,
  touchMonitorLastRun,
  updateMonitorCheckpoint,
}));

vi.mock('@/lib/run-pipeline/execute', () => ({
  executeRun,
}));

vi.mock('@/lib/publish-session', () => ({
  promoteReadySessionToPublicHead,
}));

vi.mock('@/lib/topic-catalog', () => ({
  getCanonicalHeadByKey,
}));

vi.mock('@/lib/topic-resolution', () => ({
  deriveTopicVisibility,
}));

vi.mock('@/lib/email', () => ({
  isSubscriptionEmailConfigured,
  sendMonitorAlertEmail,
}));

vi.mock('@/lib/ai', () => ({
  chatJson: vi.fn(),
  getAIConfig: vi.fn(() => null),
}));

vi.mock('@/lib/log', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function buildSession(sessionId: string, topic: string, url: string) {
  return {
    sessionId,
    topic,
    reportKey: null,
    status: 'ready',
    step: 'ready',
    progress: 1,
    published: false,
    slug: null,
    assetKey: 'bitcoin',
    _creationTime: Date.UTC(2026, 2, 31, 10, 0),
    meta: {
      mode: 'deep',
      artifacts: {
        evidence: [
          {
            id: `${sessionId}-ev-1`,
            title: `${topic} evidence`,
            url,
            source: 'Reuters',
            publishedAt: Date.UTC(2026, 2, 31, 9, 0),
            observedAt: Date.UTC(2026, 2, 31, 9, 5),
            timeKind: 'published',
            aiSummary: {
              bullets: ['Catalyst moved the market.'],
              catalysts: ['macro'],
              sentiment: 'bullish',
              confidence: 0.8,
            },
          },
        ],
        tape: [],
        nodes: [],
        edges: [],
        clusters: [],
      },
    },
  };
}

function buildHighChangeSession(sessionId: string, topic: string) {
  return {
    ...buildSession(sessionId, topic, 'https://www.reuters.com/world/us/bitcoin-current-1'),
    meta: {
      mode: 'deep',
      artifacts: {
        evidence: Array.from({ length: 4 }, (_, index) => ({
          id: `${sessionId}-ev-${index + 1}`,
          title: `${topic} evidence ${index + 1}`,
          url: `https://www.reuters.com/world/us/bitcoin-current-${index + 1}`,
          source: 'Reuters',
          publishedAt: Date.UTC(2026, 2, 31, 9, index),
          observedAt: Date.UTC(2026, 2, 31, 9, index),
          timeKind: 'published',
          aiSummary: {
            bullets: ['Catalyst moved the market.'],
            catalysts: [`macro-${index + 1}`],
            sentiment: 'bullish',
            confidence: 0.8,
          },
        })),
        tape: [],
        nodes: [],
        edges: [],
        clusters: [],
      },
    },
  };
}

const baseClaim = {
  monitor: {
    id: 'monitor-1',
    name: 'BTC monitor',
    topic: 'BTC',
    mode: 'deep' as const,
    runIntent: 'monitor' as const,
    cadenceMinutes: 360 as const,
    active: true,
    notifyWebhookUrl: null,
    lastRunAt: null,
    lastReadySessionId: null,
    lastChangeScore: null,
    lastAlertAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  run: {
    id: 'run-1',
    monitorId: 'monitor-1',
    sessionId: null,
    baselineSessionId: null,
    status: 'queued' as const,
    changeScore: null,
    significant: null,
    summary: {},
    error: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date().toISOString(),
  },
};

describe('executeClaimedMonitorRun', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.NEXT_PUBLIC_SITE_URL;
    vi.stubGlobal('fetch', fetchMock);
    markMonitorRunRunning.mockResolvedValue(undefined);
    completeMonitorRunError.mockResolvedValue(undefined);
    completeMonitorRunReady.mockResolvedValue(undefined);
    touchMonitorLastRun.mockResolvedValue(undefined);
    updateMonitorCheckpoint.mockResolvedValue(undefined);
    patchMeta.mockResolvedValue(undefined);
    markMonitorAlertSent.mockResolvedValue(undefined);
    listConfirmedSubscribersByAsset.mockResolvedValue([]);
    isSubscriptionEmailConfigured.mockReturnValue(false);
    sendMonitorAlertEmail.mockResolvedValue(undefined);
    getLatestReadyMonitorRun.mockResolvedValue(null);
    getCanonicalHeadByKey.mockReturnValue({
      key: 'bitcoin',
      priorityTier: 'v1',
      seedEnabled: true,
    });
    deriveTopicVisibility.mockReturnValue({
      visibility: 'public',
      subjectKey: 'bitcoin',
      assetKey: 'bitcoin',
    });
    promoteReadySessionToPublicHead.mockResolvedValue({
      ok: true,
      alreadyPublished: false,
      slug: 'bitcoin-2026-03-31-sess',
      assetKey: 'bitcoin',
      reportKey: 'bitcoin-price-move',
      canonicalLabel: 'Bitcoin price move',
      subjectKey: 'bitcoin',
      previousHead: {
        reportKey: 'bitcoin-price-move',
        canonicalLabel: 'Bitcoin price move',
        subjectKey: 'bitcoin',
        currentSessionId: 'baseline-session',
        currentSlug: 'bitcoin-old',
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
      },
    });
    executeRun.mockResolvedValue({
      ok: false,
      sessionId: 'sess-1',
      perfSummary: {
        status: 'error',
        generatedAt: Date.now(),
        totalMs: 10,
        stepDurationsMs: {},
        api: [],
        marksStored: 0,
      },
      error: 'provider down',
    });
    fetchMock.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(''),
    });
  });

  it('advances monitor cadence when a claimed run ends in error', async () => {
    const { executeClaimedMonitorRun } = await import('@/lib/monitoring');

    await executeClaimedMonitorRun({ claim: baseClaim });

    expect(markMonitorRunRunning).toHaveBeenCalledTimes(1);
    expect(completeMonitorRunError).toHaveBeenCalledWith('run-1', 'provider down');
    expect(touchMonitorLastRun).toHaveBeenCalledWith('monitor-1');
    expect(updateMonitorCheckpoint).not.toHaveBeenCalled();
  });

  it('auto-promotes seeded priority heads after a successful monitor run', async () => {
    executeRun.mockResolvedValueOnce({
      ok: true,
      sessionId: 'current-session',
      perfSummary: {
        status: 'ready',
        generatedAt: Date.now(),
        totalMs: 12,
        stepDurationsMs: {},
        api: [],
        marksStored: 0,
      },
    });
    getSession
      .mockResolvedValueOnce(buildSession('current-session', 'BTC', 'https://www.reuters.com/world/us/bitcoin-current'))
      .mockResolvedValueOnce(buildSession('baseline-session', 'BTC', 'https://www.reuters.com/world/us/bitcoin-baseline'));

    const { executeClaimedMonitorRun } = await import('@/lib/monitoring');

    await executeClaimedMonitorRun({ claim: baseClaim });

    expect(completeMonitorRunReady).toHaveBeenCalledTimes(1);
    expect(updateMonitorCheckpoint).toHaveBeenCalledWith({
      monitorId: 'monitor-1',
      lastReadySessionId: 'current-session',
      lastChangeScore: expect.any(Number),
    });
    expect(promoteReadySessionToPublicHead).toHaveBeenCalledTimes(1);
    expect(promoteReadySessionToPublicHead).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'current-session', topic: 'BTC' }),
    );
    expect(patchMeta).toHaveBeenCalledWith(
      'current-session',
      expect.objectContaining({
        monitorDiff: expect.any(Object),
      }),
    );
    expect(patchMeta).toHaveBeenCalledWith(
      'current-session',
      expect.objectContaining({
        refreshDiff: expect.objectContaining({
          previousSessionId: 'baseline-session',
        }),
      }),
    );
  });

  it('keeps the monitor run ready when auto-promote throws', async () => {
    executeRun.mockResolvedValueOnce({
      ok: true,
      sessionId: 'current-session',
      perfSummary: {
        status: 'ready',
        generatedAt: Date.now(),
        totalMs: 12,
        stepDurationsMs: {},
        api: [],
        marksStored: 0,
      },
    });
    getSession
      .mockResolvedValueOnce(buildSession('current-session', 'BTC', 'https://www.reuters.com/world/us/bitcoin-current'))
      .mockResolvedValueOnce(buildSession('baseline-session', 'BTC', 'https://www.reuters.com/world/us/bitcoin-baseline'));
    promoteReadySessionToPublicHead.mockRejectedValueOnce(new Error('promote exploded'));

    const { executeClaimedMonitorRun } = await import('@/lib/monitoring');

    await expect(executeClaimedMonitorRun({ claim: baseClaim })).resolves.toBeUndefined();

    expect(completeMonitorRunReady).toHaveBeenCalledTimes(1);
    expect(updateMonitorCheckpoint).toHaveBeenCalledWith({
      monitorId: 'monitor-1',
      lastReadySessionId: 'current-session',
      lastChangeScore: expect.any(Number),
    });
  });

  it('sends significant monitor alerts with the promoted report url', async () => {
    executeRun.mockResolvedValueOnce({
      ok: true,
      sessionId: 'current-session',
      perfSummary: {
        status: 'ready',
        generatedAt: Date.now(),
        totalMs: 12,
        stepDurationsMs: {},
        api: [],
        marksStored: 0,
      },
    });
    getLatestReadyMonitorRun.mockResolvedValueOnce({
      id: 'run-previous',
      monitorId: 'monitor-1',
      sessionId: 'baseline-session',
      baselineSessionId: null,
      status: 'ready',
      changeScore: 82,
      significant: true,
      summary: {},
      error: null,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date().toISOString(),
    });
    getSession
      .mockResolvedValueOnce({
        ...buildHighChangeSession('current-session', 'BTC'),
        slug: null,
      })
      .mockResolvedValueOnce({
        ...buildSession('baseline-session', 'BTC', 'https://www.reuters.com/world/us/bitcoin-baseline'),
        meta: {
          mode: 'deep',
          artifacts: {
            evidence: [],
            tape: [],
            nodes: [],
            edges: [],
            clusters: [],
          },
        },
      });

    const claim = {
      ...baseClaim,
      monitor: {
        ...baseClaim.monitor,
        notifyWebhookUrl: 'https://hooks.example/monitor',
      },
    };

    const { executeClaimedMonitorRun } = await import('@/lib/monitoring');

    await executeClaimedMonitorRun({ claim });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hooks.example/monitor',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('/report/bitcoin-2026-03-31-sess'),
      }),
    );
    expect(markMonitorAlertSent).toHaveBeenCalledWith('monitor-1');
  });

  it('emails confirmed subscribers for significant monitor changes', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://trendanalysis.ai';
    isSubscriptionEmailConfigured.mockReturnValue(true);
    listConfirmedSubscribersByAsset.mockResolvedValueOnce([
      { email: 'reader@example.com', assetKey: 'bitcoin', tokenHash: 'a'.repeat(64) },
    ]);
    executeRun.mockResolvedValueOnce({
      ok: true,
      sessionId: 'current-session',
      perfSummary: {
        status: 'ready',
        generatedAt: Date.now(),
        totalMs: 12,
        stepDurationsMs: {},
        api: [],
        marksStored: 0,
      },
    });
    getLatestReadyMonitorRun.mockResolvedValueOnce({
      id: 'run-previous',
      monitorId: 'monitor-1',
      sessionId: 'baseline-session',
      baselineSessionId: null,
      status: 'ready',
      changeScore: 82,
      significant: true,
      summary: {},
      error: null,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date().toISOString(),
    });
    getSession
      .mockResolvedValueOnce({
        ...buildHighChangeSession('current-session', 'BTC'),
        slug: 'bitcoin-2026-03-31-sess',
      })
      .mockResolvedValueOnce({
        ...buildSession('baseline-session', 'BTC', 'https://www.reuters.com/world/us/bitcoin-baseline'),
        meta: {
          mode: 'deep',
          artifacts: {
            evidence: [],
            tape: [],
            nodes: [],
            edges: [],
            clusters: [],
          },
        },
      });

    const { executeClaimedMonitorRun } = await import('@/lib/monitoring');

    await executeClaimedMonitorRun({ claim: baseClaim });

    expect(listConfirmedSubscribersByAsset).toHaveBeenCalledWith('bitcoin');
    expect(sendMonitorAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'reader@example.com',
        assetKey: 'bitcoin',
        reportUrl: 'https://trendanalysis.ai/report/bitcoin-2026-03-31-sess',
        unsubscribeUrl: 'https://trendanalysis.ai/api/subscribe/unsubscribe?hash=' + 'a'.repeat(64),
      }),
    );
    expect(markMonitorAlertSent).toHaveBeenCalledWith('monitor-1');
  });
});
