import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { PageBackground } from '@/components/layout/page-background';
import { PageContainer } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { SentimentBadge } from '@/components/ui/sentiment-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/Button';
import { getAssetIndexProjection } from '@/lib/public-read-model';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const canonical = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/asset`;

  return {
    title: t('assetIndexTitle'),
    description: t('assetIndexDesc'),
    keywords: [
      'asset analysis index',
      'market research archive',
      'trend analysis reports',
      'published market analyses',
      'asset sentiment history',
    ],
    openGraph: {
      title: t('assetIndexTitle'),
      description: t('assetIndexDesc'),
      type: 'website',
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('assetIndexTitle'),
      description: t('assetIndexDesc'),
    },
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}/asset`,
        es: `${baseUrl}/es/asset`,
        zh: `${baseUrl}/zh/asset`,
        'x-default': `${baseUrl}/asset`,
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

export default async function AssetIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const dateFmt = LOCALE_MAP[locale] ?? 'en-US';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const localePrefix = locale === 'en' ? '' : `/${locale}`;
  const { loadError, assets } = await getAssetIndexProjection();
  const pageTitle = t('assetIndexTitle');
  const pageDescription = t('assetIndexDesc');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: pageTitle,
    description: pageDescription,
    url: `${baseUrl}${localePrefix}/asset`,
    inLanguage: locale,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: assets.slice(0, 24).map((asset, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: asset.label.charAt(0).toUpperCase() + asset.label.slice(1),
        url: `${baseUrl}${localePrefix}/asset/${asset.assetKey}`,
      })),
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
            <Link href="/trending">
              Read fresh market reports &rarr;
            </Link>
          </Button>
        </div>

        {loadError ? (
          <Card className="p-12">
            <EmptyState
              title="Asset index is temporarily unavailable"
              description="We could not load the published asset hubs right now. You can still browse fresh market reports or open the terminal for a deeper run."
              action={
                <Link
                  href="/trending"
                  className="inline-flex items-center gap-1.5 text-sm text-[rgba(120,196,255,0.85)] transition hover:text-white/80"
                >
                  Read fresh reports &rarr;
                </Link>
              }
            />
          </Card>
        ) : assets.length === 0 ? (
          <Card className="p-12">
            <EmptyState
              title="No published analyses yet"
              action={
                <Link
                  href="/trending"
                  className="inline-flex items-center gap-1.5 text-sm text-[rgba(120,196,255,0.85)] transition hover:text-white/80"
                >
                  Check recent publishing activity &rarr;
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <Link
                key={asset.assetKey}
                href={`/asset/${asset.assetKey}`}
                className="block"
              >
                <Card className="group p-5 transition hover:border-white/20 hover:bg-white/[0.06]">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold text-white/85 group-hover:text-white/95">
                      {asset.label.charAt(0).toUpperCase() + asset.label.slice(1)}
                    </h2>
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
        )}
      </PageContainer>

      <SiteFooter />
    </div>
  );
}
