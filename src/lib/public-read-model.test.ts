import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAssetDailyMetric = vi.fn();
const getPublishedReportBySlug = vi.fn();
const hasDb = vi.fn();
const listAssetDailyMetrics = vi.fn();
const listByAsset = vi.fn();
const listCurrentPublished = vi.fn();
const listCurrentPublishedByAsset = vi.fn();
const listPublicMonitorTimelineByAsset = vi.fn();
const listPublished = vi.fn();
const filterPublishableSessions = vi.fn();
const summarizeSessionQuality = vi.fn();

vi.mock('@/lib/db', () => ({
  getAssetDailyMetric,
  getPublishedReportBySlug,
  hasDb,
  listAssetDailyMetrics,
  listByAsset,
  listCurrentPublished,
  listCurrentPublishedByAsset,
  listPublicMonitorTimelineByAsset,
  listPublished,
}));

vi.mock('@/lib/report-quality', async () => ({
  ...(await vi.importActual<typeof import('@/lib/report-quality')>('@/lib/report-quality')),
  filterPublishableSessions,
  summarizeSessionQuality,
}));

vi.mock('@/lib/topic-catalog', () => ({
  getComparisonByKey: vi.fn(() => null),
  isSeededAssetKey: vi.fn(() => true),
  isSeededCanonicalHeadKey: vi.fn(() => true),
  listComparisonsForAssetKey: vi.fn(() => []),
  listRelatedComparisons: vi.fn(() => []),
}));

const materializedAggregation = {
  assetKey: 'bitcoin',
  totalAnalyses: 42,
  latestAnalysisDate: Date.UTC(2026, 2, 26),
  latestSentiment: 'bullish',
  sentimentTrend: [],
  topCatalysts: [],
  topEntities: [],
  latestClusters: [],
  reports: [
    {
      slug: 'bitcoin-current-2026-03-26-abcd',
      sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f',
      topic: 'Bitcoin current',
      date: Date.UTC(2026, 2, 26),
      dominantSentiment: 'bullish',
      summary: 'Materialized snapshot summary.',
      topClusterTitle: null,
      evidenceCount: 6,
      domainCount: 4,
    },
  ],
  peerAssets: [],
  faq: [],
};

function sessionFixture() {
  return {
    sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f',
    topic: 'Bitcoin current',
    reportKey: 'bitcoin-general',
    status: 'ready',
    step: 'ready',
    progress: 1,
    published: true,
    slug: 'bitcoin-current-2026-03-26-abcd',
    assetKey: 'bitcoin',
    _creationTime: Date.UTC(2026, 2, 26),
    meta: {
      artifacts: {
        evidence: [],
        clusters: [],
        nodes: [],
      },
    },
  };
}

describe('public-read-model asset metrics', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = 'https://trendanalysis.ai';
    hasDb.mockReturnValue(true);
    filterPublishableSessions.mockImplementation((items) => items);
    summarizeSessionQuality.mockReturnValue({ publishable: true });
    listByAsset.mockResolvedValue([sessionFixture()]);
    listCurrentPublishedByAsset.mockResolvedValue([]);
    listCurrentPublished.mockResolvedValue([]);
    listPublicMonitorTimelineByAsset.mockResolvedValue([]);
    listPublished.mockResolvedValue([]);
    getPublishedReportBySlug.mockResolvedValue(null);
    listAssetDailyMetrics.mockResolvedValue([
      {
        assetKey: 'bitcoin',
        metricDate: '2026-03-26',
        summary: materializedAggregation,
        metrics: {},
        updatedAt: '2026-03-26T12:00:00.000Z',
      },
    ]);
    getAssetDailyMetric.mockResolvedValue({
      assetKey: 'bitcoin',
      metricDate: '2026-03-26',
      summary: materializedAggregation,
      metrics: {},
      updatedAt: '2026-03-26T12:00:00.000Z',
    });
  });

  it('prefers the latest materialized asset metric for asset hubs', async () => {
    const { getAssetHubProjection } = await import('@/lib/public-read-model');
    const projection = await getAssetHubProjection('bitcoin', 'en');

    expect(projection.status).toBe('ok');
    if (projection.status !== 'ok') return;
    expect(projection.aggregation.totalAnalyses).toBe(42);
    expect(projection.archiveDates).toEqual([
      {
        date: '2026-03-26',
        updatedAt: '2026-03-26T12:00:00.000Z',
      },
    ]);
  });

  it('loads dated archive projections from asset_daily_metrics', async () => {
    const { getAssetArchiveProjection } = await import('@/lib/public-read-model');
    const projection = await getAssetArchiveProjection('bitcoin', '2026-03-26', 'en');

    expect(projection.status).toBe('ok');
    if (projection.status !== 'ok') return;
    expect(projection.pageUrl).toBe('https://trendanalysis.ai/asset/bitcoin/archive/2026-03-26');
    expect(projection.aggregation.reports[0]?.slug).toBe('bitcoin-current-2026-03-26-abcd');
  });
});
