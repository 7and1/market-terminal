import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { PageBackground } from '@/components/layout/page-background';
import { PageContainer } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { SentimentBadge } from '@/components/ui/sentiment-badge';
import { MomentumBadge } from '@/components/ui/momentum-badge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SubscribeBox } from '@/components/public/SubscribeBox';
import { isSubscriptionEmailConfigured } from '@/lib/email';
import { getAssetHubProjection } from '@/lib/public-read-model';

type Props = { params: Promise<{ locale: string; key: string }> };

function renameBreadcrumbItems(itemListElement: unknown, labels: string[]) {
  if (!Array.isArray(itemListElement)) return itemListElement;
  return itemListElement.map((item, index) => {
    if (!item || typeof item !== 'object' || index >= labels.length) return item;
    return {
      ...(item as Record<string, unknown>),
      name: labels[index],
    };
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, key } = await params;
  setRequestLocale(locale);
  const projection = await getAssetHubProjection(key, locale);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const canonical = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/asset/${key}`;

  if (projection.status !== 'ok') {
    const isNotFound = projection.status === 'not_found';
    return {
      title: isNotFound
        ? `${projection.capitalizedLabel} asset hub not found`
        : `${projection.capitalizedLabel} asset hub temporarily unavailable`,
      description: isNotFound
        ? `No publishable public asset hub is available for ${projection.label}.`
        : `The public asset hub for ${projection.label} is temporarily unavailable.`,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const assetName = projection.capitalizedLabel;
  const title = `${assetName} Trend Analysis & History`;
  const description =
    projection.currentSummary.summary ||
    `Start here for the current baseline, recurring catalysts, source footing, and archive of published analyses for ${assetName}.`;

  return {
    title,
    description,
    keywords: [
      `${assetName} trend analysis`,
      `${assetName} sentiment`,
      `${assetName} catalysts`,
      `${assetName} market research`,
      `${assetName} analysis history`,
    ],
    openGraph: {
      title,
      description,
      type: 'website',
      url: projection.pageUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}/asset/${key}`,
        es: `${baseUrl}/es/asset/${key}`,
        zh: `${baseUrl}/zh/asset/${key}`,
        'x-default': `${baseUrl}/asset/${key}`,
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

function formatDate(dateFmt: string, value: number) {
  return new Date(value).toLocaleDateString(dateFmt, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateFmt: string, value: number | null) {
  if (!value) return 'No source timestamps yet';
  return new Date(value).toLocaleString(dateFmt, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const LOCALE_MAP: Record<string, string> = { en: 'en-US', es: 'es-MX', zh: 'zh-CN' };

export default async function AssetPage({ params }: Props) {
  const { locale, key } = await params;
  setRequestLocale(locale);
  const dateFmt = LOCALE_MAP[locale] ?? 'en-US';
  const projection = await getAssetHubProjection(key, locale);
  const { capitalizedLabel } = projection;

  if (projection.status === 'missing_db') {
    return (
      <div className="min-h-screen">
        <PageBackground />
        <SiteHeader />
        <PageContainer size="narrow" className="py-10">
          <Link
            href="/asset"
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-white/50 transition hover:text-white/80"
          >
            &larr; All assets
          </Link>
          <Card className="p-12">
            <EmptyState
              title={`${capitalizedLabel} is temporarily unavailable`}
              description="We could not load the published history for this asset right now. You can still start a fresh run from the terminal."
              action={
                <Link
                  href={`/terminal?q=${encodeURIComponent(projection.label)}`}
                  className="inline-flex items-center gap-1.5 text-sm text-[rgba(120,196,255,0.85)] transition hover:text-white/80"
                >
                  Run a fresh analysis &rarr;
                </Link>
              }
            />
          </Card>
        </PageContainer>
        <SiteFooter />
      </div>
    );
  }

  if (projection.status === 'unavailable') {
    return (
      <div className="min-h-screen">
        <PageBackground />
        <SiteHeader />
        <PageContainer size="narrow" className="py-10">
          <Link
            href="/asset"
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-white/50 transition hover:text-white/80"
          >
            &larr; All assets
          </Link>
          <Card className="p-12">
            <EmptyState
              title={`${capitalizedLabel} is temporarily unavailable`}
              description="Published reports for this asset could not be loaded right now. Try again shortly or open the terminal for a fresh run."
              action={
                <Link
                  href={`/terminal?q=${encodeURIComponent(projection.label)}`}
                  className="inline-flex items-center gap-1.5 text-sm text-[rgba(120,196,255,0.85)] transition hover:text-white/80"
                >
                  Run latest analysis &rarr;
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

  const [commonT, metadataT] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'metadata' }),
  ]);

  const {
    aggregation: agg,
    archiveDates,
    comparisonCards,
    currentLabel,
    currentSummary,
    latestPublishedAt,
    latestReportHref,
    monitorTimeline,
    structuredData,
    terminalSnapshotHref,
  } = projection;
  const subscriptionsEnabled = isSubscriptionEmailConfigured();
  const intro =
    `Start here for the current baseline, recurring catalysts, source footing, and archive of published analyses for ${capitalizedLabel}.`;
  const localizedStructuredData = structuredData.map((item) => {
    const itemType = item['@type'];
    if (itemType === 'CollectionPage') {
      return {
        ...item,
        name: capitalizedLabel,
        description: intro,
      };
    }
    if (itemType === 'BreadcrumbList') {
      return {
        ...item,
        itemListElement: renameBreadcrumbItems(item.itemListElement, [
          commonT('home'),
          metadataT('assetIndexTitle'),
          capitalizedLabel,
        ]),
      };
    }
    return item;
  });

  return (
    <div className="min-h-screen">
      <PageBackground />
      <SiteHeader />

      <PageContainer size="narrow" className="space-y-6 py-10">
        {localizedStructuredData.map((item, index) => (
          <script
            key={index}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
          />
        ))}

        <nav className="flex items-center gap-1.5 text-xs text-white/50">
          <Link href="/" className="transition hover:text-white/70">{commonT('home')}</Link>
          <span>&rsaquo;</span>
          <Link href="/asset" className="transition hover:text-white/70">{metadataT('assetIndexTitle')}</Link>
          <span>&rsaquo;</span>
          <span className="text-white/35">{capitalizedLabel}</span>
        </nav>

        <Card className="overflow-hidden p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">Canonical asset hub</div>
              <h1 className="mt-3 text-2xl font-semibold text-white/90 sm:text-4xl">{capitalizedLabel}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/58">{intro}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{agg.totalAnalyses} {agg.totalAnalyses === 1 ? 'analysis' : 'analyses'}</Badge>
                {agg.latestAnalysisDate ? (
                  <Badge variant="blue">Latest {formatDate(dateFmt, agg.latestAnalysisDate)}</Badge>
                ) : null}
                {agg.latestSentiment ? (
                  <SentimentBadge sentiment={mapSentiment(agg.latestSentiment)} />
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {latestReportHref ? (
                <Button asChild>
                  <Link href={latestReportHref}>Open current report &rarr;</Link>
                </Button>
              ) : null}
              <Button variant="outline" asChild>
                <Link href={`/terminal?q=${encodeURIComponent(projection.label)}`}>Run latest analysis &rarr;</Link>
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">Current baseline</div>
              <h2 className="mt-2 text-lg font-semibold text-white/88">{currentLabel}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/58">
                {currentSummary.summary || `Use the latest published ${capitalizedLabel} report as the baseline before comparing recurring catalysts and prior runs.`}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/48">
                <span>Updated {formatDate(dateFmt, latestPublishedAt)}</span>
                <span className="text-white/20">&middot;</span>
                <span>Latest evidence {formatDateTime(dateFmt, currentSummary.quality.latestEvidenceAt)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {latestReportHref ? (
                <Button size="sm" asChild>
                  <Link href={latestReportHref}>Read baseline report &rarr;</Link>
                </Button>
              ) : null}
              <Button size="sm" variant="outline" asChild>
                <Link href={terminalSnapshotHref}>Open snapshot &rarr;</Link>
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-1">
            <h2 className="text-sm font-semibold text-white/84">What moved now</h2>
            <div className="mt-3 space-y-2">
              {currentSummary.whatMoved.length ? (
                currentSummary.whatMoved.map((item) => (
                  <div key={item} className="flex gap-2 text-sm leading-relaxed text-white/68">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[rgba(120,196,255,0.9)]" />
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/55">No concise current narrative could be extracted from the latest publishable run.</p>
              )}
            </div>
          </Card>

          <Card className="p-5 lg:col-span-1">
            <h2 className="text-sm font-semibold text-white/84">Why it matters</h2>
            <div className="mt-3 space-y-2">
              {currentSummary.whyItMatters.length ? (
                currentSummary.whyItMatters.map((item) => (
                  <div key={item} className="flex gap-2 text-sm leading-relaxed text-white/68">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[rgba(255,179,102,0.9)]" />
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/55">The latest evidence set is still too thin to support a stronger read-through.</p>
              )}
            </div>
          </Card>

          <Card className="p-5 lg:col-span-1">
            <h2 className="text-sm font-semibold text-white/84">Source footing</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { label: 'Evidence', value: currentSummary.quality.evidenceCount },
                { label: 'Domains', value: currentSummary.quality.uniqueDomainCount },
                { label: 'Official', value: currentSummary.quality.officialCount },
                { label: 'Primary', value: currentSummary.quality.primaryCount },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                  <div className="text-base font-semibold text-white/84">{item.value}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/42">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {currentSummary.quality.topDomains.length ? (
                currentSummary.quality.topDomains.map((domain) => (
                  <Badge key={domain} variant="neutral">{domain}</Badge>
                ))
              ) : (
                <span className="text-xs text-white/45">No source domains recorded yet.</span>
              )}
            </div>
          </Card>
        </div>

        {currentSummary.clusters.length > 0 ? (
          <section>
            <SectionLabel className="mb-3">Current Narrative Clusters</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              {currentSummary.clusters.map((cluster) => (
                <Card key={cluster.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-white/82">{cluster.title}</h3>
                    <MomentumBadge momentum={cluster.momentum} />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/56">{cluster.summary}</p>
                  <div className="mt-3 text-[11px] text-white/40">
                    {cluster.evidenceIds.length} evidence items in this cluster
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {agg.topCatalysts.length > 0 ? (
            <section>
              <SectionLabel className="mb-3">Recurring Catalysts</SectionLabel>
              <div className="grid gap-3">
                {agg.topCatalysts.slice(0, 8).map((item) => (
                  <Card key={item.name} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-white/84">{item.name}</div>
                        <div className="mt-1 text-xs text-white/48">
                          Seen in {item.sessionCoverage} {item.sessionCoverage === 1 ? 'analysis' : 'analyses'}
                        </div>
                      </div>
                      <Badge variant="orange">{item.count} mentions</Badge>
                    </div>
                    <div className="mt-3 text-[11px] text-white/42">
                      Last seen {formatDate(dateFmt, item.lastSeenAt)}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          {agg.topEntities.length > 0 ? (
            <section>
              <SectionLabel className="mb-3">Recurring Entities</SectionLabel>
              <div className="grid gap-3">
                {agg.topEntities.slice(0, 8).map((item) => (
                  <Card key={item.name} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-white/84">{item.name}</div>
                        <div className="mt-1 text-xs text-white/48">
                          Seen in {item.sessionCoverage} {item.sessionCoverage === 1 ? 'analysis' : 'analyses'}
                        </div>
                      </div>
                      <Badge variant="blue">{item.count} mentions</Badge>
                    </div>
                    <div className="mt-3 text-[11px] text-white/42">
                      Last seen {formatDate(dateFmt, item.lastSeenAt)}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
          <section>
            <SectionLabel className="mb-3">Narrative Evolution</SectionLabel>
            <div className="space-y-3">
              {agg.reports.map((report) => (
                <Link key={report.slug} href={`/report/${report.slug}`} className="block">
                  <Card className="p-4 transition hover:border-white/20 hover:bg-white/[0.05]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-white/84">{report.topic}</div>
                          {report.dominantSentiment ? (
                            <SentimentBadge sentiment={mapSentiment(report.dominantSentiment)} />
                          ) : null}
                        </div>
                        {report.summary ? (
                          <p className="mt-2 text-sm leading-relaxed text-white/58">{report.summary}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/42">
                          <span>{formatDate(dateFmt, report.date)}</span>
                          <span className="text-white/20">&middot;</span>
                          <span>{report.evidenceCount} evidence</span>
                          <span className="text-white/20">&middot;</span>
                          <span>{report.domainCount} domains</span>
                          {report.topClusterTitle ? (
                            <>
                              <span className="text-white/20">&middot;</span>
                              <span>{report.topClusterTitle}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-xs text-[rgba(120,196,255,0.85)]">Open report &rarr;</div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          <div className="space-y-4">
            {subscriptionsEnabled ? (
              <section>
                <SectionLabel className="mb-3">Email Alerts</SectionLabel>
                <SubscribeBox assetKey={key} assetLabel={capitalizedLabel} />
              </section>
            ) : null}

            {monitorTimeline.length > 0 ? (
              <section>
                <SectionLabel className="mb-3">Change Timeline</SectionLabel>
                <Card className="p-4">
                  <div className="space-y-3">
                    {monitorTimeline.map((item) => (
                      <div key={`${item.monitorId}-${item.date}`} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white/82">
                              {item.headline || item.monitorName || item.topic}
                            </div>
                            <div className="mt-1 text-[11px] text-white/42">
                              {formatDateTime(dateFmt, item.date)}
                            </div>
                          </div>
                          {typeof item.changeScore === 'number' ? (
                            <Badge variant={item.significant ? 'orange' : 'neutral'}>Score {item.changeScore}</Badge>
                          ) : null}
                        </div>
                        {item.summary ? (
                          <p className="mt-2 text-xs leading-relaxed text-white/56">{item.summary}</p>
                        ) : null}
                        {item.reportHref ? (
                          <Link
                            href={item.reportHref}
                            className="mt-2 inline-flex text-xs text-[rgba(120,196,255,0.85)] transition hover:text-white/80"
                          >
                            Open monitored report &rarr;
                          </Link>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            ) : null}

            {archiveDates.length > 0 ? (
              <section>
                <SectionLabel className="mb-3">Archive</SectionLabel>
                <Card className="p-4">
                  <div className="grid gap-2">
                    {archiveDates.slice(0, 30).map((item) => (
                      <Link
                        key={item.date}
                        href={`/asset/${key}/archive/${item.date}`}
                        className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/76 transition hover:border-white/15 hover:bg-white/[0.05]"
                      >
                        <span>{formatDate(dateFmt, Date.parse(`${item.date}T00:00:00.000Z`))}</span>
                        <span className="text-xs text-[rgba(120,196,255,0.85)]">Open snapshot &rarr;</span>
                      </Link>
                    ))}
                  </div>
                </Card>
              </section>
            ) : null}

            {comparisonCards.length > 0 ? (
              <section>
                <SectionLabel className="mb-3">Related Comparison Heads</SectionLabel>
                <div className="space-y-3">
                  {comparisonCards.map((item) => (
                    <Link key={item.definition.key} href={item.href} className="block">
                      <Card className="p-4 transition hover:border-white/20 hover:bg-white/[0.05]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-white/84">{item.definition.label}</div>
                            <p className="mt-2 text-xs leading-relaxed text-white/56">{item.definition.buyerIntentSummary}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.definition.aliasesZh.slice(0, 2).map((alias) => (
                                <Badge key={alias} variant="neutral">{alias}</Badge>
                              ))}
                            </div>
                          </div>
                          <div className="text-right text-[11px] text-[rgba(120,196,255,0.85)]">
                            <div>{item.ctaLabel} &rarr;</div>
                            {item.lastUpdatedAt ? (
                              <div className="mt-1 text-white/42">Updated {formatDate(dateFmt, item.lastUpdatedAt)}</div>
                            ) : null}
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {agg.peerAssets.length > 0 ? (
              <section>
                <SectionLabel className="mb-3">Peer Assets And Spillovers</SectionLabel>
                <Card className="p-4">
                  <div className="space-y-2">
                    {agg.peerAssets.map((item) =>
                      item.assetKey ? (
                        <Link
                          key={item.label}
                          href={`/asset/${item.assetKey}`}
                          className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/76 transition hover:border-white/15 hover:bg-white/[0.05]"
                        >
                          <span>{item.label}</span>
                          <span className="text-xs text-white/42">{item.count} mentions</span>
                        </Link>
                      ) : (
                        <div
                          key={item.label}
                          className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/76"
                        >
                          <span>{item.label}</span>
                          <span className="text-xs text-white/42">{item.count} mentions</span>
                        </div>
                      ),
                    )}
                  </div>
                </Card>
              </section>
            ) : null}

            {agg.sentimentTrend.length > 0 ? (
              <section>
                <SectionLabel className="mb-3">Sentiment Trend</SectionLabel>
                <Card className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {agg.sentimentTrend.map((point) => (
                      <div
                        key={point.date}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5"
                      >
                        <span className="text-xs font-medium text-white/72">
                          {new Date(point.date).toLocaleDateString(dateFmt, { month: 'short', day: 'numeric' })}
                        </span>
                        <SentimentBadge sentiment={mapSentiment(point.sentiment)} />
                        <span className="text-[10px] text-white/42">{point.count}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            ) : null}
          </div>
        </div>

        {agg.faq.length > 0 ? (
          <section>
            <SectionLabel className="mb-3">FAQ</SectionLabel>
            <div className="grid gap-3">
              {agg.faq.map((item) => (
                <Card key={item.question} className="p-4">
                  <h3 className="text-sm font-semibold text-white/84">{item.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/58">{item.answer}</p>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white/84">Next actions</h3>
              <p className="mt-1 text-xs text-white/45">
                Use the current report as the baseline, launch a fresh run, or compare how the narrative evolves over time.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {latestReportHref ? (
                <Button size="sm" asChild>
                  <Link href={latestReportHref}>Open current report &rarr;</Link>
                </Button>
              ) : null}
              <Button size="sm" variant="outline" asChild>
                <Link href={`/terminal?q=${encodeURIComponent(projection.label)}`}>Run latest analysis &rarr;</Link>
              </Button>
            </div>
          </div>
        </Card>
      </PageContainer>

      <SiteFooter />
    </div>
  );
}
