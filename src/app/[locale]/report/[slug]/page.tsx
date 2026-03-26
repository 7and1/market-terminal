import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { setRequestLocale } from 'next-intl/server';

import { getBySlug, hasDb, listByAsset } from '@/lib/db';
import { ReportHeader } from '@/components/report/ReportHeader';
import { StaticMindMap } from '@/components/report/StaticMindMap';
import { ClustersSummary } from '@/components/report/ClustersSummary';
import { StaticTimeline } from '@/components/report/StaticTimeline';
import { EvidenceList } from '@/components/report/EvidenceList';
import { ShareBar } from '@/components/report/ShareBar';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { PageBackground } from '@/components/layout/page-background';
import { PageContainer } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

async function fetchSession(slug: string) {
  return await getBySlug(slug);
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
  const session = await fetchSession(slug);
  if (!session) return { title: 'Report not found' };

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const topic = session.topic;
  const localizedPath = `${locale === 'en' ? '' : `/${locale}`}/report/${slug}`;
  const pageUrl = `${baseUrl}${localizedPath}`;
  const arts = ((session.meta as Record<string, unknown>)?.artifacts ?? {}) as Record<string, unknown>;
  const evCount = Array.isArray(arts.evidence) ? arts.evidence.length : 0;
  const clusterCount = Array.isArray(arts.clusters) ? arts.clusters.length : 0;
  const description = `TrendAnalysis report for ${topic} — evidence-backed research with ${evCount} sources.`;

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
    alternates: {
      canonical: pageUrl,
      languages: {
        en: `${baseUrl}/report/${slug}`,
        es: `${baseUrl}/es/report/${slug}`,
        zh: `${baseUrl}/zh/report/${slug}`,
        'x-default': `${baseUrl}/report/${slug}`,
      },
    },
  };
}

const LOCALE_MAP: Record<string, string> = { en: 'en-US', es: 'es-MX', zh: 'zh-CN' };

export default async function ReportPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const dateFmt = LOCALE_MAP[locale] ?? 'en-US';
  if (!hasDb()) {
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
  const session = await fetchSession(slug);
  if (!session || !session.published) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const localizedPath = `${locale === 'en' ? '' : `/${locale}`}/report/${slug}`;
  const pageUrl = `${baseUrl}${localizedPath}`;
  const meta = (session.meta ?? {}) as Record<string, unknown>;
  const artifacts = (meta.artifacts ?? {}) as Record<string, unknown>;
  const evidence = (artifacts.evidence as { id: string; title: string; url: string; source: string; publishedAt: number; observedAt: number; timeKind: 'published' | 'observed'; excerpt?: string; aiSummary?: { bullets: string[]; entities?: string[]; catalysts?: string[]; sentiment?: 'bullish' | 'bearish' | 'mixed' | 'neutral'; confidence?: number } }[]) ?? [];
  const tape = (artifacts.tape as { id: string; title: string; source: string; publishedAt: number; tags: string[]; evidenceId: string }[]) ?? [];
  const nodes = (artifacts.nodes as { id: string; type: 'asset' | 'event' | 'entity' | 'source' | 'media'; label: string; meta?: Record<string, unknown> }[]) ?? [];
  const edges = (artifacts.edges as { id: string; from: string; to: string; type: 'mentions' | 'co_moves' | 'hypothesis' | 'same_story'; confidence: number; evidenceIds: string[]; rationale?: string }[]) ?? [];
  const clusters = (artifacts.clusters as { id: string; title: string; summary: string; momentum: 'rising' | 'steady' | 'fading'; evidenceIds: string[]; related: string[] }[]) ?? [];

  const mode = (meta.mode as 'fast' | 'deep') ?? 'fast';
  const monitorDiff = meta.monitorDiff as
    | {
        changeScore?: number;
        significant?: boolean;
        headline?: string;
        summary?: string;
        sentimentShift?: string;
        newEvidence?: Array<{ title: string; url: string; source: string }>;
        newCatalysts?: string[];
      }
    | undefined;
  const createdAt = session._creationTime;
  const date = new Date(createdAt).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assetKey = (session as any).assetKey as string | undefined;
  const assetLabel = assetKey
    ? decodeURIComponent(assetKey).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  // Fetch related reports for the same asset
  let relatedReports: { slug: string; topic: string; date: number }[] = [];
  if (assetKey) {
    try {
      const siblings = await listByAsset(assetKey, 4);
      relatedReports = siblings
        .filter((s) => s.slug && s.slug !== slug)
        .slice(0, 3)
        .map((s) => ({ slug: s.slug!, topic: s.topic, date: s._creationTime }));
    } catch {
      // Non-critical — skip related reports
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${session.topic} — TrendAnalysis Report`,
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    datePublished: date,
    description: `TrendAnalysis report for ${session.topic} with ${evidence.length} evidence sources.`,
    inLanguage: locale,
    author: {
      '@type': 'Organization',
      name: 'TrendAnalysis.ai',
    },
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

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-white/50">
          <Link href="/" className="transition hover:text-white/70">Home</Link>
          <span>&rsaquo;</span>
          {assetKey && assetLabel ? (
            <>
              <Link href={`/asset/${assetKey}`} className="transition hover:text-white/70">{assetLabel}</Link>
              <span>&rsaquo;</span>
            </>
          ) : null}
          <span className="text-white/35">Report</span>
        </nav>

        <ReportHeader
          topic={session.topic}
          date={date}
          mode={mode}
          stats={{
            evidence: evidence.length,
            nodes: nodes.length,
            edges: edges.length,
            clusters: clusters.length,
          }}
        />

        {monitorDiff?.headline && monitorDiff?.summary ? (
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-white/85">What Changed Since Last Run</h3>
              {typeof monitorDiff.changeScore === 'number' ? (
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  Score {monitorDiff.changeScore}
                </span>
              ) : null}
              {monitorDiff.sentimentShift ? (
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  {monitorDiff.sentimentShift}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm font-semibold text-white/82">{monitorDiff.headline}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{monitorDiff.summary}</p>
            {Array.isArray(monitorDiff.newEvidence) && monitorDiff.newEvidence.length > 0 ? (
              <div className="mt-4 space-y-2">
                {monitorDiff.newEvidence.slice(0, 3).map((item) => (
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

        {nodes.length > 0 && (
          <StaticMindMap topic={session.topic} nodes={nodes} edges={edges} />
        )}

        {clusters.length > 0 && <ClustersSummary clusters={clusters} />}

        {tape.length > 0 && <StaticTimeline items={tape} />}

        <EvidenceList evidence={evidence} />

        {/* Related reports for same asset */}
        {assetKey && assetLabel && (
          <Card className="p-5">
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
          title={`${session.topic} — TrendAnalysis Report`}
          topic={session.topic}
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
