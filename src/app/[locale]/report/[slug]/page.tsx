import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getPublishedReportBySlug, hasDb } from '@/lib/db';
import { summarizeReportQuality } from '@/lib/report-quality';
import {
  ClustersSummary,
  EvidenceList,
  ReportHeader,
  ShareBar,
  StaticMindMap,
  StaticTimeline,
} from '@/components/report';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { PageBackground } from '@/components/layout/page-background';
import { PageContainer } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { getReportProjection } from '@/lib/public-read-model';

export const revalidate = 3600;
const LOCALE_MAP: Record<string, string> = { en: 'en-US', es: 'es-MX', zh: 'zh-CN' };

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

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
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!hasDb()) {
    return {
      title: 'TrendAnalysis report temporarily unavailable',
      description: 'This published report could not be loaded because the report database is currently unavailable.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }
  const report = await getPublishedReportBySlug(slug);
  if (!report) {
    return {
      title: 'Report not found',
      description: 'This published report is not available.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const session = report.session;
  const topic = report.head?.canonicalLabel || session.topic;
  const resolvedSlug = report.isCurrent ? slug : (report.head?.currentSlug || slug);
  const localizedPath = `${locale === 'en' ? '' : `/${locale}`}/report/${resolvedSlug}`;
  const pageUrl = `${baseUrl}${localizedPath}`;
  const arts = ((session.meta as Record<string, unknown>)?.artifacts ?? {}) as Record<string, unknown>;
  const evidence = (arts.evidence as { id: string; title: string; url: string; source: string; publishedAt: number; observedAt: number; timeKind: 'published' | 'observed' }[]) ?? [];
  const quality = summarizeReportQuality(evidence);
  const evCount = quality.evidenceCount;
  const clusterCount = Array.isArray(arts.clusters) ? arts.clusters.length : 0;
  const description = quality.publishable
    ? `TrendAnalysis report for ${topic} with ${evCount} evidence items across ${quality.uniqueDomainCount} domains.`
    : `Legacy TrendAnalysis report for ${topic}. This page remains accessible, but it does not meet the current public evidence threshold.`;

  const ogParams = new URLSearchParams({
    topic,
    evidence: String(evCount),
    clusters: String(clusterCount),
    mode: String((session.meta as Record<string, unknown>)?.mode ?? 'fast'),
  });
  const ogImageUrl = `${baseUrl}/api/og?${ogParams}`;

  return {
    title: `${topic} — TrendAnalysis Report`,
    description,
    openGraph: {
      title: `${topic} — TrendAnalysis Report`,
      description,
      type: 'article',
      url: pageUrl,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${topic} — TrendAnalysis Report` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${topic} — TrendAnalysis Report`,
      description,
      images: [ogImageUrl],
    },
    robots:
      quality.publishable && report.isCurrent
        ? undefined
        : {
            index: false,
            follow: true,
          },
    alternates: {
      canonical: pageUrl,
      languages: {
        en: `${baseUrl}/report/${resolvedSlug}`,
        es: `${baseUrl}/es/report/${resolvedSlug}`,
        zh: `${baseUrl}/zh/report/${resolvedSlug}`,
        'x-default': `${baseUrl}/report/${resolvedSlug}`,
      },
    },
  };
}

export default async function ReportPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const dateFmt = LOCALE_MAP[locale] ?? 'en-US';
  const projection = await getReportProjection(slug, locale);
  if (projection.status === 'missing_db') {
    return (
      <div className="min-h-screen">
        <PageBackground />
        <SiteHeader />
        <PageContainer size="narrow" className="space-y-6 py-8">
          <Card className="p-12">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold text-white/88">Report temporarily unavailable</h1>
              <p className="text-sm leading-relaxed text-white/55">
                Published report storage is currently unavailable, so this report cannot be loaded right now.
              </p>
              <div className="pt-3">
                <Link
                  href="/terminal"
                  className="inline-flex items-center gap-1.5 text-sm text-[rgba(120,196,255,0.85)] transition hover:text-white/80"
                >
                  Open terminal instead &rarr;
                </Link>
              </div>
            </div>
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
    assetKey,
    assetLabel,
    breadcrumbJsonLd,
    changeSummary,
    comparisonCards,
    currentComparison,
    currentSummary,
    date,
    displayTopic,
    edges,
    jumpLinks,
    jsonLd,
    mode,
    nodes,
    pageUrl,
    quality,
    relatedReports,
    report,
    sortedEvidence,
    tape,
  } = projection;
  const session = report.session;
  const clusters = currentSummary.clusters;
  const whatMoved = currentSummary.whatMoved;
  const whyItMatters = currentSummary.whyItMatters;
  const peerAssets = currentSummary.peerAssets;
  const localizedBreadcrumbJsonLd = {
    ...breadcrumbJsonLd,
    itemListElement: renameBreadcrumbItems(
      breadcrumbJsonLd.itemListElement,
      assetKey && assetLabel
        ? [commonT('home'), metadataT('assetIndexTitle'), assetLabel, displayTopic]
        : [commonT('home'), displayTopic],
    ),
  };

  return (
    <div className="min-h-screen">
      <PageBackground />
      <SiteHeader />

      <PageContainer size="narrow" className="space-y-6 py-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localizedBreadcrumbJsonLd) }}
        />

        {!report.isCurrent && report.head?.currentSlug ? (
          <Card className="border-[rgba(255,180,120,0.24)] bg-[rgba(255,180,120,0.06)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgba(255,210,170,0.85)]">
                  Historical Version
                </div>
                <p className="mt-1 text-sm text-white/72">
                  You are viewing a superseded report. A newer current report is available for this semantic head.
                </p>
              </div>
              <Link
                href={`/report/${report.head.currentSlug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white/84 transition hover:bg-white/[0.08]"
              >
                View current report &rarr;
              </Link>
            </div>
          </Card>
        ) : null}

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-white/50">
          <Link href="/" className="transition hover:text-white/70">{commonT('home')}</Link>
          <span>&rsaquo;</span>
          {assetKey && assetLabel ? (
            <>
              <Link href="/asset" className="transition hover:text-white/70">{metadataT('assetIndexTitle')}</Link>
              <span>&rsaquo;</span>
              <Link href={`/asset/${assetKey}`} className="transition hover:text-white/70">{assetLabel}</Link>
              <span>&rsaquo;</span>
            </>
          ) : null}
          <span className="text-white/35">{displayTopic}</span>
        </nav>

        <ReportHeader
          topic={displayTopic}
          date={date}
          mode={mode}
          stats={{
            evidence: quality.evidenceCount,
            domains: quality.uniqueDomainCount,
            latestEvidenceAt: quality.latestEvidenceAt,
            officialCount: quality.officialCount,
            primaryCount: quality.primaryCount,
            secondaryCount: quality.secondaryCount,
          }}
        />

        {jumpLinks.length > 0 ? (
          <Card className="p-4">
            <div className="flex flex-wrap gap-2">
              {jumpLinks.map((link) => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/72 transition hover:border-white/18 hover:bg-white/[0.06] hover:text-white/88"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </Card>
        ) : null}

        {!quality.publishable ? (
          <Card className="border-amber-400/20 bg-amber-400/5 p-5">
            <h2 className="text-sm font-semibold text-white/88">Legacy report below the current publish threshold</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              This page is still available by direct link, but it is excluded from indexing and public discovery until
              the evidence set meets the current report standard.
            </p>
            <div className="mt-3 space-y-1 text-xs text-white/55">
              {quality.issues.map((issue) => (
                <div key={issue}>{issue}</div>
              ))}
            </div>
          </Card>
        ) : null}

        <div id="summary" className="grid gap-4 lg:grid-cols-3 scroll-mt-28">
          <Card className="p-5 lg:col-span-1">
            <h2 className="text-sm font-semibold text-white/84">What moved</h2>
            <div className="mt-3 space-y-2">
              {whatMoved.length ? (
                whatMoved.map((item) => (
                  <div key={item} className="flex gap-2 text-sm leading-relaxed text-white/68">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[rgba(120,196,255,0.9)]" />
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/55">No concise market narrative could be extracted from this run.</p>
              )}
            </div>
          </Card>

          <Card className="p-5 lg:col-span-1">
            <h2 className="text-sm font-semibold text-white/84">Why it matters</h2>
            <div className="mt-3 space-y-2">
              {whyItMatters.length ? (
                whyItMatters.map((item) => (
                  <div key={item} className="flex gap-2 text-sm leading-relaxed text-white/68">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[rgba(255,179,102,0.9)]" />
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/55">The evidence set is still too thin to support a strong market read-through.</p>
              )}
            </div>
          </Card>

          <Card className="p-5 lg:col-span-1">
            <h2 className="text-sm font-semibold text-white/84">Asset hub context</h2>
            <div className="mt-3 space-y-3 text-sm text-white/62">
              {assetKey && assetLabel ? (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">Canonical hub</div>
                  <div className="mt-2">
                    <Link
                      href={`/asset/${assetKey}`}
                      className="inline-flex items-center gap-1.5 text-sm text-[rgba(120,196,255,0.85)] transition hover:text-white/82"
                    >
                      Open {assetLabel} asset hub &rarr;
                    </Link>
                  </div>
                </div>
              ) : null}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">Recurring catalysts</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentSummary.topCatalysts.length ? (
                    currentSummary.topCatalysts.slice(0, 4).map((label) => (
                      <span key={label} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/70">
                        {label}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-white/50">No recurring catalysts extracted from this report.</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">Top domains</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {quality.topDomains.length ? (
                    quality.topDomains.map((domain) => (
                      <span key={domain} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/70">
                        {domain}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-white/50">No source domains recorded</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">Peer assets and spillovers</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {peerAssets.length ? (
                    peerAssets.map((label) => (
                      <span key={label} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/70">
                        {label}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-white/50">No peer assets surfaced strongly enough in this run.</span>
                  )}
                </div>
              </div>
              {relatedReports.length > 0 ? (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">Recent sibling analyses</div>
                  <div className="mt-2 space-y-2">
                    {relatedReports.slice(0, 2).map((item) => (
                      <Link
                        key={item.slug}
                        href={`/report/${item.slug}`}
                        className="block rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 transition hover:border-white/15 hover:bg-white/[0.04]"
                      >
                        <div className="text-xs font-medium text-white/78">{item.topic}</div>
                        <div className="mt-1 text-[11px] text-white/42">{new Date(item.date).toLocaleDateString(dateFmt)}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        {changeSummary ? (
          <Card id="changes" className="scroll-mt-28 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-white/85">{changeSummary.title}</h3>
              {typeof changeSummary.changeScore === 'number' ? (
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  Score {changeSummary.changeScore}
                </span>
              ) : null}
              {changeSummary.sentimentShift ? (
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  {changeSummary.sentimentShift}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm font-semibold text-white/82">{changeSummary.headline}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{changeSummary.summary}</p>
            {Array.isArray(changeSummary.newEvidence) && changeSummary.newEvidence.length > 0 ? (
              <div className="mt-4 space-y-2">
                {changeSummary.newEvidence.slice(0, 3).map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 transition hover:border-white/15 hover:bg-white/[0.04]"
                  >
                    <div className="text-xs font-medium text-white/78">{item.title}</div>
                    <div className="mt-1 text-[11px] text-white/42">{item.source}</div>
                  </a>
                ))}
              </div>
            ) : null}
          </Card>
        ) : null}

        <section id="evidence" className="scroll-mt-28">
          <EvidenceList evidence={sortedEvidence} />
        </section>

        {clusters.length > 0 ? (
          <section id="clusters" className="scroll-mt-28">
            <ClustersSummary clusters={clusters} />
          </section>
        ) : null}

        {tape.length > 2 ? (
          <section id="timeline" className="scroll-mt-28">
            <StaticTimeline items={tape} />
          </section>
        ) : null}

        {nodes.length > 0 ? (
          <section id="mind-map" className="scroll-mt-28">
            <StaticMindMap topic={displayTopic} nodes={nodes} edges={edges} />
          </section>
        ) : null}

        {comparisonCards.length > 0 ? (
          <Card id="comparison-context" className="scroll-mt-28 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/80">
                {currentComparison ? 'Related Comparison Heads' : 'Comparison Heads For This Asset'}
              </h3>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {comparisonCards.map((item) => (
                <Link
                  key={item.definition.key}
                  href={item.href}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:border-white/15 hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white/82">{item.definition.label}</div>
                      <p className="mt-2 text-xs leading-relaxed text-white/56">{item.definition.buyerIntentSummary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.definition.aliasesZh.slice(0, 2).map((alias) => (
                          <span key={alias} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/70">
                            {alias}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-[rgba(120,196,255,0.85)]">
                      <div>{item.ctaLabel} &rarr;</div>
                      {item.lastUpdatedAt ? (
                        <div className="mt-1 text-white/42">{new Date(item.lastUpdatedAt).toLocaleDateString(dateFmt)}</div>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        ) : null}

        {/* Related reports for same asset */}
        {assetKey && assetLabel && (
          <Card id="asset-context" className="scroll-mt-28 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/80">More {assetLabel} Analyses</h3>
              <Link
                href={`/asset/${assetKey}`}
                className="text-xs text-[rgba(120,196,255,0.85)] transition hover:text-white/80"
              >
                View all &rarr;
              </Link>
            </div>
            {relatedReports.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {relatedReports.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/report/${r.slug}`}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 transition hover:border-white/15 hover:bg-white/[0.04]"
                  >
                    <div className="text-xs font-medium text-white/75">{r.topic}</div>
                    <div className="mt-1 text-[10px] text-white/40">{new Date(r.date).toLocaleDateString(dateFmt)}</div>
                    {r.summary ? (
                      <div className="mt-2 text-[11px] leading-relaxed text-white/52">{r.summary}</div>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-white/40">This is the only analysis for this asset so far.</p>
            )}
          </Card>
        )}

        <ShareBar
          url={pageUrl}
          title={`${displayTopic} — TrendAnalysis Report`}
          topic={displayTopic}
        />

        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white/80">Continue in Terminal</h3>
              <p className="mt-1 text-xs text-white/45">
                Open the stored session snapshot or launch a fresh run from the same topic.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {assetKey ? (
                <Link
                  href={`/asset/${assetKey}`}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/78 transition hover:bg-white/[0.06]"
                >
                  Open asset hub
                </Link>
              ) : null}
              <Link
                href={`/terminal?sessionId=${encodeURIComponent(session.sessionId)}`}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/78 transition hover:bg-white/[0.06]"
              >
                Open snapshot
              </Link>
              <Link
                href={`/terminal?q=${encodeURIComponent(session.topic)}`}
                className="rounded-full border border-[rgba(0,102,255,0.35)] bg-[rgba(0,102,255,0.12)] px-3 py-2 text-xs text-[rgba(173,212,255,0.96)] transition hover:bg-[rgba(0,102,255,0.18)]"
              >
                Run latest analysis
              </Link>
            </div>
          </div>
        </Card>
      </PageContainer>

      <SiteFooter />
    </div>
  );
}
