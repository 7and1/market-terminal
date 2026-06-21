import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { PageBackground } from '@/components/layout/page-background';
import { PageContainer } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/Badge';
import { SentimentBadge } from '@/components/ui/sentiment-badge';
import { getAssetArchiveProjection } from '@/lib/public-read-model';

type Props = { params: Promise<{ locale: string; key: string; date: string }> };

const LOCALE_MAP: Record<string, string> = { en: 'en-US', es: 'es-MX', zh: 'zh-CN' };

function mapSentiment(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  if (s === 'bullish') return 'positive';
  if (s === 'bearish') return 'negative';
  return s;
}

function formatDate(dateFmt: string, value: number) {
  return new Date(value).toLocaleDateString(dateFmt, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, key, date } = await params;
  setRequestLocale(locale);
  const projection = await getAssetArchiveProjection(key, date, locale);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';

  if (projection.status !== 'ok') {
    return {
      title: `${projection.capitalizedLabel} archive unavailable`,
      description: `No published archive snapshot is available for ${projection.label} on ${date}.`,
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const title = `${projection.capitalizedLabel} Trend Archive — ${projection.date}`;
  const description = `Historical TrendAnalysis.ai snapshot for ${projection.capitalizedLabel} on ${projection.date}, including archived reports, recurring catalysts, and sentiment history.`;
  const path = `/asset/${key}/archive/${date}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${baseUrl}${locale === 'en' ? '' : `/${locale}`}${path}`,
      languages: {
        en: `${baseUrl}${path}`,
        es: `${baseUrl}/es${path}`,
        zh: `${baseUrl}/zh${path}`,
        'x-default': `${baseUrl}${path}`,
      },
    },
  };
}

export default async function AssetArchivePage({ params }: Props) {
  const { locale, key, date } = await params;
  setRequestLocale(locale);
  const dateFmt = LOCALE_MAP[locale] ?? 'en-US';
  const projection = await getAssetArchiveProjection(key, date, locale);
  const commonT = await getTranslations({ locale, namespace: 'common' });

  if (projection.status === 'missing_db' || projection.status === 'unavailable') {
    return (
      <div className="min-h-screen">
        <PageBackground />
        <SiteHeader />
        <PageContainer size="narrow" className="py-10">
          <Card className="p-12">
            <EmptyState
              title={`${projection.capitalizedLabel} archive is temporarily unavailable`}
              description="The stored archive snapshot could not be loaded right now."
              action={
                <Link href={`/asset/${key}`} className="text-sm text-[rgba(120,196,255,0.86)] hover:text-white">
                  Open current asset hub &rarr;
                </Link>
              }
            />
          </Card>
        </PageContainer>
        <SiteFooter />
      </div>
    );
  }

  if (projection.status !== 'ok') notFound();

  const { aggregation } = projection;
  const reports = aggregation.reports.slice(0, 12);

  return (
    <div className="min-h-screen">
      <PageBackground />
      <SiteHeader />
      <PageContainer size="narrow" className="space-y-6 py-10">
        {projection.structuredData.map((item, index) => (
          <script
            key={index}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
          />
        ))}

        <nav className="flex items-center gap-1.5 text-xs text-white/50">
          <Link href="/" className="transition hover:text-white/70">{commonT('home')}</Link>
          <span>&rsaquo;</span>
          <Link href="/asset" className="transition hover:text-white/70">Assets</Link>
          <span>&rsaquo;</span>
          <Link href={`/asset/${key}`} className="transition hover:text-white/70">{projection.capitalizedLabel}</Link>
          <span>&rsaquo;</span>
          <span className="text-white/35">{projection.date}</span>
        </nav>

        <Card className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">Archive snapshot</div>
              <h1 className="mt-3 text-2xl font-semibold text-white/90 sm:text-4xl">
                {projection.capitalizedLabel} on {projection.date}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/58">
                A stored daily snapshot of the public asset archive. Use it to compare how reports, catalysts, and sentiment changed over time.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{aggregation.totalAnalyses} analyses</Badge>
                {aggregation.latestAnalysisDate ? (
                  <Badge variant="blue">Latest report {formatDate(dateFmt, aggregation.latestAnalysisDate)}</Badge>
                ) : null}
                {aggregation.latestSentiment ? <SentimentBadge sentiment={mapSentiment(aggregation.latestSentiment)} /> : null}
              </div>
            </div>

            <Link
              href={`/asset/${key}`}
              className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/84 transition hover:bg-white/[0.08]"
            >
              Current asset hub &rarr;
            </Link>
          </div>
        </Card>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white/88">Reports in this snapshot</h2>
            <span className="text-xs text-white/45">{reports.length} shown</span>
          </div>
          <div className="grid gap-3">
            {reports.map((report) => (
              <Link
                key={report.sessionId}
                href={`/report/${report.slug}`}
                className="block rounded-lg border border-white/10 bg-white/[0.035] p-4 transition hover:border-white/18 hover:bg-white/[0.055]"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white/88">{report.topic}</div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/55">
                      {report.summary || report.topClusterTitle || 'Published analysis snapshot.'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {report.dominantSentiment ? <SentimentBadge sentiment={mapSentiment(report.dominantSentiment)} /> : null}
                    <Badge variant="neutral">{report.evidenceCount} evidence</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </PageContainer>
      <SiteFooter />
    </div>
  );
}
