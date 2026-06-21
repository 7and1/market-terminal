import { beforeEach, describe, expect, it, vi } from 'vitest';

const listPublished = vi.fn();
const listCurrentPublished = vi.fn();
const listAssetArchiveDates = vi.fn();
const filterPublishableSessions = vi.fn();
const summarizeSessionQuality = vi.fn();
const isSeededAssetKey = vi.fn();
const isSeededCanonicalHeadKey = vi.fn();

vi.mock('@/lib/db', () => ({
  listAssetArchiveDates,
  listPublished,
  listCurrentPublished,
}));

vi.mock('@/lib/report-quality', () => ({
  filterPublishableSessions,
  summarizeSessionQuality,
}));

vi.mock('@/lib/topic-catalog', () => ({
  isSeededAssetKey,
  isSeededCanonicalHeadKey,
}));

describe('sitemap', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = 'https://trendanalysis.ai';
    filterPublishableSessions.mockImplementation((items) => items);
    summarizeSessionQuality.mockReturnValue({ publishable: true });
    isSeededAssetKey.mockImplementation((key) => key === 'bitcoin');
    isSeededCanonicalHeadKey.mockImplementation((key) => key === 'bitcoin');
    listPublished.mockResolvedValue([
      {
        sessionId: 'session-1',
        topic: 'Bitcoin price move',
        published: true,
        slug: 'bitcoin-price-move-2026-03-26-abcd',
        assetKey: 'bitcoin',
        _creationTime: Date.UTC(2026, 2, 26),
      },
      {
        sessionId: 'session-2',
        topic: 'Obscure asset move',
        published: true,
        slug: 'obscure-asset-move-2026-03-27-efgh',
        assetKey: 'obscure-asset',
        _creationTime: Date.UTC(2026, 2, 27),
      },
    ]);
    listAssetArchiveDates.mockResolvedValue([
      {
        assetKey: 'bitcoin',
        metricDate: '2026-03-26',
        updatedAt: '2026-03-26T12:00:00.000Z',
      },
      {
        assetKey: 'obscure-asset',
        metricDate: '2026-03-27',
        updatedAt: '2026-03-27T12:00:00.000Z',
      },
    ]);
    listCurrentPublished.mockResolvedValue([
      {
        session: {
          sessionId: 'session-1',
          topic: 'Bitcoin price move',
          published: true,
          slug: 'bitcoin-price-move-2026-03-26-abcd',
          assetKey: 'bitcoin',
          _creationTime: Date.UTC(2026, 2, 26),
        },
        head: {
          subjectKey: 'bitcoin',
        },
      },
      {
        session: {
          sessionId: 'session-2',
          topic: 'Obscure asset move',
          published: true,
          slug: 'obscure-asset-move-2026-03-27-efgh',
          assetKey: 'obscure-asset',
          _creationTime: Date.UTC(2026, 2, 27),
        },
        head: {
          subjectKey: 'obscure-asset',
        },
      },
    ]);
  });

  it('includes only the indexed public surfaces and preserves locale alternates', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const result = await sitemap();
    const urls = result.map((entry) => entry.url);
    const trendingEntry = result.find((entry) => entry.url === 'https://trendanalysis.ai/trending');

    expect(urls).toContain('https://trendanalysis.ai');
    expect(urls).toContain('https://trendanalysis.ai/report/bitcoin-price-move-2026-03-26-abcd');
    expect(urls).toContain('https://trendanalysis.ai/asset/bitcoin');
    expect(urls).toContain('https://trendanalysis.ai/asset/bitcoin/archive/2026-03-26');
    expect(urls).not.toContain('https://trendanalysis.ai/how-it-works');
    expect(urls).not.toContain('https://trendanalysis.ai/tools');
    expect(urls).not.toContain('https://trendanalysis.ai/report/obscure-asset-move-2026-03-27-efgh');
    expect(urls).not.toContain('https://trendanalysis.ai/asset/obscure-asset');
    expect(urls).not.toContain('https://trendanalysis.ai/asset/obscure-asset/archive/2026-03-27');
    expect(trendingEntry?.alternates?.languages?.zh).toBe('https://trendanalysis.ai/zh/trending');
    expect(trendingEntry?.alternates?.languages?.['x-default']).toBe('https://trendanalysis.ai/trending');
  });
});
