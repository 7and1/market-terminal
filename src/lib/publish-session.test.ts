import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getReportHead = vi.fn();
const findApprovedDynamicCatalogHeadForTopic = vi.fn();
const listByAsset = vi.fn();
const publishSession = vi.fn();
const upsertAssetDailyMetric = vi.fn();
const filterPublishableSessions = vi.fn();
const summarizeSessionQuality = vi.fn();
const deriveReportKeyFromTopic = vi.fn();
const deriveTopicVisibility = vi.fn();
const syncPublishedSessionTargets = vi.fn();
const normalizeAssetKeyFromTopic = vi.fn();
const deriveCanonicalLabelFromTopic = vi.fn();

vi.mock('@/lib/db', () => ({
  findApprovedDynamicCatalogHeadForTopic,
  getReportHead,
  listByAsset,
  publishSession,
  upsertAssetDailyMetric,
}));

vi.mock('@/lib/report-quality', async () => ({
  ...(await vi.importActual<typeof import('@/lib/report-quality')>('@/lib/report-quality')),
  filterPublishableSessions,
  summarizeSessionQuality,
}));

vi.mock('@/lib/topic-resolution', () => ({
  deriveCanonicalLabelFromTopic,
  deriveReportKeyFromTopic,
  deriveTopicVisibility,
  normalizeAssetKeyFromTopic,
  syncPublishedSessionTargets,
}));

function sessionFixture() {
  return {
    sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f',
    topic: 'Bitcoin',
    reportKey: null,
    status: 'ready',
    step: 'ready',
    progress: 1,
    published: false,
    slug: null,
    assetKey: null,
    _creationTime: Date.UTC(2026, 2, 26, 10, 0),
    meta: {
      artifacts: {
        evidence: [
          {
            id: 'ev_1',
            title: 'Bitcoin evidence',
            url: 'https://www.reuters.com/markets/bitcoin',
            source: 'Reuters',
            publishedAt: Date.UTC(2026, 2, 26, 9, 0),
            observedAt: Date.UTC(2026, 2, 26, 9, 5),
            timeKind: 'published',
            aiSummary: {
              bullets: ['ETF flows lifted sentiment.'],
              catalysts: ['ETF flows'],
              entities: ['Bitcoin'],
              sentiment: 'bullish',
            },
          },
        ],
        clusters: [],
        nodes: [],
      },
    },
  };
}

describe('promoteReadySessionToPublicHead', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-26T12:00:00.000Z'));

    getReportHead.mockResolvedValue(null);
    findApprovedDynamicCatalogHeadForTopic.mockResolvedValue(null);
    publishSession.mockResolvedValue(undefined);
    filterPublishableSessions.mockImplementation((items) => items);
    summarizeSessionQuality.mockReturnValue({ publishable: true, issues: [] });
    deriveReportKeyFromTopic.mockReturnValue('bitcoin-general');
    deriveCanonicalLabelFromTopic.mockReturnValue('Bitcoin');
    normalizeAssetKeyFromTopic.mockReturnValue('bitcoin');
    deriveTopicVisibility.mockReturnValue({
      visibility: 'public',
      canonicalLabel: 'Bitcoin',
      assetKey: 'bitcoin',
      reportKey: 'bitcoin-general',
      subjectKey: 'bitcoin',
    });
    syncPublishedSessionTargets.mockResolvedValue({
      reportKey: 'bitcoin-general',
      canonicalLabel: 'Bitcoin',
      subjectKey: 'bitcoin',
    });
    listByAsset.mockResolvedValue([
      {
        ...sessionFixture(),
        published: true,
        slug: 'bitcoin-general-2026-03-26-8d0e',
        assetKey: 'bitcoin',
      },
    ]);
    upsertAssetDailyMetric.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('materializes an asset daily metric after publishing', async () => {
    const { promoteReadySessionToPublicHead } = await import('@/lib/publish-session');
    const result = await promoteReadySessionToPublicHead(sessionFixture());

    expect(result).toMatchObject({
      ok: true,
      slug: 'bitcoin-general-2026-03-26-8d0e',
      assetKey: 'bitcoin',
      reportKey: 'bitcoin-general',
    });
    expect(upsertAssetDailyMetric).toHaveBeenCalledWith({
      assetKey: 'bitcoin',
      metricDate: '2026-03-26',
      summary: expect.objectContaining({
        assetKey: 'bitcoin',
        totalAnalyses: 1,
        reports: expect.any(Array),
      }),
      metrics: expect.objectContaining({
        totalAnalyses: 1,
        reportCount: 1,
      }),
    });
  });

  it('publishes a session when an approved dynamic head overrides private static visibility', async () => {
    deriveTopicVisibility.mockReturnValue({
      visibility: 'private',
      canonicalLabel: 'AI Healthcare Stocks',
      assetKey: 'ai-healthcare-stocks',
      reportKey: null,
      subjectKey: 'ai-healthcare-stocks',
    });
    deriveReportKeyFromTopic.mockReturnValue('ai-healthcare-stocks-general');
    normalizeAssetKeyFromTopic.mockReturnValue('ai-healthcare-stocks');
    findApprovedDynamicCatalogHeadForTopic.mockResolvedValue({
      key: 'ai-healthcare-stocks',
      label: 'AI Healthcare Stocks',
      assetKey: 'ai-healthcare-stocks',
      reportKey: 'ai-healthcare-stocks-general',
      publicSurface: 'asset_hub',
      priorityTier: 'secondary',
      aliases: ['AI healthcare stocks'],
      status: 'approved',
      score: 3,
      meta: {},
      createdAt: '2026-03-26T10:00:00.000Z',
      updatedAt: '2026-03-26T10:00:00.000Z',
    });
    syncPublishedSessionTargets.mockResolvedValue({
      reportKey: 'ai-healthcare-stocks-general',
      canonicalLabel: 'AI Healthcare Stocks',
      subjectKey: 'ai-healthcare-stocks',
    });

    const { promoteReadySessionToPublicHead } = await import('@/lib/publish-session');
    const result = await promoteReadySessionToPublicHead({
      ...sessionFixture(),
      topic: 'AI healthcare stocks',
    });

    expect(result).toMatchObject({
      ok: true,
      assetKey: 'ai-healthcare-stocks',
      reportKey: 'ai-healthcare-stocks-general',
      canonicalLabel: 'AI Healthcare Stocks',
    });
    expect(publishSession).toHaveBeenCalledWith(
      '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f',
      'ai-healthcare-stocks-general-2026-03-26-8d0e',
      'ai-healthcare-stocks',
      'ai-healthcare-stocks-general',
    );
  });
});
