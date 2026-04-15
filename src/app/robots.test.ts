import { beforeEach, describe, expect, it, vi } from 'vitest';

import robots from '@/app/robots';

const setRequestLocale = vi.fn();
const getAssetHubProjection = vi.fn();
const getReportProjection = vi.fn();
const getPublishedReportBySlug = vi.fn();
const hasDb = vi.fn();
const summarizeReportQuality = vi.fn();

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(),
  setRequestLocale,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: unknown }) => children,
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/lib/public-read-model', () => ({
  getAssetHubProjection,
  getReportProjection,
}));

vi.mock('@/lib/db', () => ({
  getPublishedReportBySlug,
  hasDb,
}));

vi.mock('@/lib/report-quality', () => ({
  summarizeReportQuality,
}));

describe('robots', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = 'https://trendanalysis.ai';
    hasDb.mockReturnValue(true);
    summarizeReportQuality.mockReturnValue({
      publishable: true,
      evidenceCount: 6,
      uniqueDomainCount: 3,
    });
  });

  it('blocks internal and supporting control-plane surfaces from crawl', () => {
    const result = robots();
    const disallow = Array.isArray(result.rules) ? result.rules[0]?.disallow || [] : [];

    expect(disallow).toContain('/api/');
    expect(disallow).toContain('/dashboard');
    expect(disallow).toContain('/terminal');
    expect(disallow).toContain('/tools');
    expect(disallow).toContain('/en/dashboard');
    expect(disallow).toContain('/zh/terminal');
    expect(result.sitemap).toContain('/sitemap.xml');
  });

  it('marks unavailable asset hubs as noindex in metadata', async () => {
    getAssetHubProjection.mockResolvedValue({
      status: 'unavailable',
      label: 'bitcoin',
      capitalizedLabel: 'Bitcoin',
    });

    const { generateMetadata } = await import('@/app/[locale]/asset/[key]/page');
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'en', key: 'bitcoin' }),
    });

    expect(metadata.robots).toEqual({
      index: false,
      follow: false,
    });
    expect(metadata.title).toBe('Bitcoin asset hub temporarily unavailable');
  });

  it('keeps missing reports out of the index', async () => {
    getPublishedReportBySlug.mockResolvedValue(null);

    const { generateMetadata } = await import('@/app/[locale]/report/[slug]/page');
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'en', slug: 'missing-report' }),
    });

    expect(metadata.robots).toEqual({
      index: false,
      follow: false,
    });
    expect(metadata.title).toBe('Report not found');
  });

  it('canonicalizes superseded reports to the current public slug and keeps them noindex', async () => {
    getPublishedReportBySlug.mockResolvedValue({
      isCurrent: false,
      head: {
        canonicalLabel: 'Bitcoin price move',
        currentSlug: 'bitcoin-price-move-current',
      },
      session: {
        topic: 'Bitcoin price move',
        meta: {
          mode: 'deep',
          artifacts: {
            evidence: [
              {
                id: 'e1',
                title: 'Headline',
                url: 'https://example.com/headline',
                source: 'example.com',
                publishedAt: Date.UTC(2026, 2, 26),
                observedAt: Date.UTC(2026, 2, 26),
                timeKind: 'published',
              },
            ],
            clusters: [{ id: 'c1' }],
          },
        },
      },
    });
    summarizeReportQuality.mockReturnValue({
      publishable: true,
      evidenceCount: 1,
      uniqueDomainCount: 1,
    });

    const { generateMetadata } = await import('@/app/[locale]/report/[slug]/page');
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'en', slug: 'bitcoin-price-move-old' }),
    });

    expect(metadata.alternates?.canonical).toBe('https://trendanalysis.ai/report/bitcoin-price-move-current');
    expect(metadata.robots).toEqual({
      index: false,
      follow: true,
    });
  });
});
