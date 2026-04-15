import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { PageBackground } from '@/components/layout/page-background';
import { PageContainer } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { SectionLabel } from '@/components/ui/section-label';
import { SentimentBadge } from '@/components/ui/sentiment-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/Button';
import { getTrendingProjection } from '@/lib/public-read-model';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const canonical = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/trending`;

  return {
    title: t('trendingTitle'),
    description: t('trendingDesc'),
    keywords: [
      'trending market topics',
      'market analysis today',
      'stock market trends',
      'crypto analysis',
      'trend analysis',
    ],
    openGraph: {
      title: t('trendingTitle'),
      description: t('trendingDesc'),
      type: 'website',
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('trendingTitle'),
      description: t('trendingDesc'),
    },
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}/trending`,
        es: `${baseUrl}/es/trending`,
        zh: `${baseUrl}/zh/trending`,
        'x-default': `${baseUrl}/trending`,
      },
    },
  };
}

function mapSentiment(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  if (s === 'bullish') return 'positive';
  if (s === 'bearish') return 'negative';
  return s;
}

const LOCALE_MAP: Record<string, string> = { en: 'en-US', es: 'es-MX', zh: 'zh-CN' };

export default async function TrendingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const dateFmt = LOCALE_MAP[locale] ?? 'en-US';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const localePrefix = locale === 'en' ? '' : `/${locale}`;
  const { loadError, assets, recentReports } = await getTrendingProjection();
  const pageTitle = t('trendingTitle');
  const pageDescription = t('trendingDesc');
  const listItems = recentReports.length > 0
    ? recentReports.slice(0, 20).map((report, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: report.topic,
        url: `${baseUrl}${localePrefix}/report/${report.slug}`,
      }))
    : assets.slice(0, 20).map((asset, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: asset.label.charAt(0).toUpperCase() + asset.label.slice(1),
        url: `${baseUrl}${localePrefix}/asset/${asset.assetKey}`,
      }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: pageTitle,
    description: pageDescription,
    url: `${baseUrl}${localePrefix}/trending`,
    inLanguage: locale,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: listItems,
    },
  };

  return (
    <div className="min-h-screen">
      <PageBackground />
      <SiteHeader />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageContainer className="py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white/90 sm:text-3xl">{pageTitle}</h1>
            <p className="mt-1 text-sm text-white/50">{pageDescription}</p>
          </div>
          <Button asChild>
            <Link href="/asset">
              Browse asset hubs &rarr;
            </Link>
          </Button>
        </div>

        {loadError ? (
          <Card className="p-12">
            <EmptyState
              title="Trending data is temporarily unavailable"
              description="Published reports could not be loaded right now. You can still browse asset hubs or launch a deeper run from the terminal."
              action={
                <Link
                  href="/asset"
                  className="inline-flex items-center gap-1.5 text-sm text-[rgba(120,196,255,0.85)] transition hover:text-white/80"
                >
                  Browse asset hubs &rarr;
                </Link>
              }
            />
          </Card>
        ) : assets.length === 0 && recentReports.length === 0 ? (
          <Card className="p-12">
            <EmptyState
              title="No published analyses yet. Be the first!"
              action={
                <Link
                  href="/terminal"
                  className="inline-flex items-center gap-1.5 text-sm text-[rgba(120,196,255,0.85)] transition hover:text-white/80"
                >
                  Run your first analysis &rarr;
                </Link>
              }
            />
          </Card>
        ) : (
          <>
            {/* Most Analyzed Section */}
            {assets.length > 0 && (
              <section className="mb-10">
                <SectionLabel className="mb-4 text-lg font-semibold text-white/80 normal-case tracking-normal">Active Asset Hubs</SectionLabel>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {assets.map((asset) => (
                    <Link
                      key={asset.assetKey}
                      href={`/asset/${asset.assetKey}`}
                      className="block"
                    >
                      <Card className="group p-5 transition hover:border-white/20 hover:bg-white/[0.06]">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-semibold text-white/85 group-hover:text-white/95">
                            {asset.label.charAt(0).toUpperCase() + asset.label.slice(1)}
                          </h3>
                          {asset.latestSentiment && (
                            <SentimentBadge sentiment={mapSentiment(asset.latestSentiment)} />
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-3 text-xs text-white/45">
                          <span>{asset.count} {asset.count === 1 ? 'analysis' : 'analyses'}</span>
                          <span className="text-white/20">|</span>
                          <span>{new Date(asset.latestDate).toLocaleDateString(dateFmt)}</span>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-white/56">
                          {asset.summary || 'Open the asset hub for the current baseline, recurring catalysts, and report archive.'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/42">
                          <span>{asset.evidenceCount} evidence</span>
                          <span className="text-white/20">&middot;</span>
                          <span>{asset.domainCount} domains</span>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Analyses Section */}
            {recentReports.length > 0 && (
              <section>
                <SectionLabel className="mb-4 text-lg font-semibold text-white/80 normal-case tracking-normal">Fresh Reports</SectionLabel>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {recentReports.map((report) => (
                    <Link
                      key={report.slug}
                      href={`/report/${report.slug}`}
                      className="block"
                    >
                      <Card className="group p-4 transition hover:border-white/20 hover:bg-white/[0.06]">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-white/85 group-hover:text-white/95">
                            {report.topic}
                          </h3>
                          {report.sentiment && (
                            <SentimentBadge sentiment={mapSentiment(report.sentiment)} />
                          )}
                        </div>
                        <div className="mt-2 text-xs text-white/45">
                          {new Date(report.date).toLocaleDateString(dateFmt)}
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-white/56">
                          {report.summary || 'Open the report for the full evidence-backed explanation.'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/42">
                          <span>{report.evidenceCount} evidence</span>
                          <span className="text-white/20">&middot;</span>
                          <span>{report.domainCount} domains</span>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </PageContainer>

      <SiteFooter />
    </div>
  );
}
