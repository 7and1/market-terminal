import {
  getPublishedReportBySlug,
  hasDb,
  listByAsset,
  listCurrentPublished,
  listCurrentPublishedByAsset,
  listPublished,
  type CurrentPublishedReportRow,
  type PublishedReportRecord,
} from '@/lib/db';
import {
  aggregateAssetData,
  buildAssetDirectoryCards,
  summarizePublishedSession,
  type AssetAggregation,
  type AssetDirectoryCard,
} from '@/lib/asset-aggregation';
import { filterPublishableSessions, summarizeReportQuality, summarizeSessionQuality } from '@/lib/report-quality';
import {
  getComparisonByKey,
  isSeededAssetKey,
  isSeededCanonicalHeadKey,
  listComparisonsForAssetKey,
  listRelatedComparisons,
  type ComparisonDefinition,
} from '@/lib/topic-catalog';

export const PUBLIC_LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-MX',
  zh: 'zh-CN',
};

type TrendingTopic = {
  assetKey: string;
  label: string;
  count: number;
  sentiment: string | null;
  summary: string | null;
  evidenceCount: number;
  domainCount: number;
};

type AssetCard = {
  assetKey: string;
  label: string;
  count: number;
  latestDate: number;
  latestSentiment: string | null;
  summary: string | null;
  evidenceCount: number;
  domainCount: number;
};

type RecentReport = {
  slug: string;
  topic: string;
  date: number;
  sentiment: string | null;
  summary: string | null;
  evidenceCount: number;
  domainCount: number;
};

export type ComparisonCard = {
  definition: ComparisonDefinition;
  href: string;
  ctaLabel: string;
  lastUpdatedAt: number | null;
};

export type LandingProjection = {
  trendingTopics: TrendingTopic[];
};

export type AssetIndexProjection = {
  loadError: boolean;
  assets: AssetCard[];
};

export type TrendingProjection = {
  loadError: boolean;
  assets: AssetCard[];
  recentReports: RecentReport[];
};

export type AssetHubProjection =
  | {
      status: 'missing_db' | 'unavailable' | 'not_found';
      label: string;
      capitalizedLabel: string;
    }
  | {
      status: 'ok';
      label: string;
      capitalizedLabel: string;
      pageUrl: string;
      currentLabel: string;
      currentSummary: ReturnType<typeof summarizePublishedSession>;
      aggregation: AssetAggregation;
      latestPublishedAt: number;
      latestReportHref: string | null;
      terminalSnapshotHref: string;
      comparisonCards: ComparisonCard[];
      structuredData: Record<string, unknown>[];
    };

type ReportEvidenceItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: number;
  observedAt: number;
  timeKind: 'published' | 'observed';
  excerpt?: string;
  aiSummary?: {
    bullets: string[];
    entities?: string[];
    catalysts?: string[];
    sentiment?: 'bullish' | 'bearish' | 'mixed' | 'neutral';
    confidence?: number;
  };
};

type ReportTapeItem = {
  id: string;
  title: string;
  source: string;
  publishedAt: number;
  tags: string[];
  evidenceId: string;
};

type ReportNode = {
  id: string;
  type: 'asset' | 'event' | 'entity' | 'source' | 'media';
  label: string;
  meta?: Record<string, unknown>;
};

type ReportEdge = {
  id: string;
  from: string;
  to: string;
  type: 'mentions' | 'co_moves' | 'hypothesis' | 'same_story';
  confidence: number;
  evidenceIds: string[];
  rationale?: string;
};

export type ReportProjection =
  | {
      status: 'missing_db' | 'not_found';
    }
  | {
      status: 'ok';
      report: PublishedReportRecord;
      pageUrl: string;
      localePrefix: string;
      displayTopic: string;
      date: string;
      mode: 'fast' | 'deep';
      evidence: ReportEvidenceItem[];
      tape: ReportTapeItem[];
      nodes: ReportNode[];
      edges: ReportEdge[];
      currentSummary: ReturnType<typeof summarizePublishedSession>;
      quality: ReturnType<typeof summarizeReportQuality>;
      sortedEvidence: ReportEvidenceItem[];
      changeSummary:
        | ({
            title: string;
          } & {
            changeScore?: number;
            headline?: string;
            summary?: string;
            sentimentShift?: string;
            newEvidence?: Array<{ title: string; url: string; source: string }>;
            newCatalysts?: string[];
          })
        | null;
      assetKey: string | undefined;
      assetLabel: string | null;
      relatedReports: Array<{ slug: string; topic: string; date: number; summary: string | null }>;
      currentComparison: ComparisonDefinition | null;
      comparisonCards: ComparisonCard[];
      jsonLd: Record<string, unknown>;
      breadcrumbJsonLd: Record<string, unknown>;
      jumpLinks: Array<{ id: string; label: string }>;
    };

function baseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
}

function localePrefix(locale: string) {
  return locale === 'en' ? '' : `/${locale}`;
}

function titleFromAssetKey(assetKey: string) {
  const label = decodeURIComponent(assetKey).replace(/-/g, ' ');
  return label.replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeAssetCard(item: AssetDirectoryCard): AssetCard {
  return {
    assetKey: item.assetKey,
    label: item.label,
    count: item.count,
    latestDate: item.latestDate,
    latestSentiment: item.latestSentiment,
    summary: item.summary,
    evidenceCount: item.evidenceCount,
    domainCount: item.domainCount,
  };
}

function buildPublishedComparisonCards(
  assetKey: string,
  currentPublished: CurrentPublishedReportRow[],
  currentComparisonKey?: string | null,
) {
  const publishedComparisonByKey = new Map(
    currentPublished
      .filter((item) => summarizeSessionQuality(item.session).publishable)
      .map((item) => [item.head.subjectKey, item] as const),
  );

  return listComparisonsForAssetKey(assetKey)
    .filter((definition) => isSeededCanonicalHeadKey(definition.key))
    .filter((definition) => !currentComparisonKey || definition.key !== currentComparisonKey)
    .map((definition) => {
      const published = publishedComparisonByKey.get(definition.key);
      return {
        definition,
        href: published?.session.slug
          ? `/report/${published.session.slug}`
          : `/terminal?q=${encodeURIComponent(definition.label)}`,
        ctaLabel: published?.session.slug ? 'Open comparison report' : 'Run comparison',
        lastUpdatedAt: published?.session._creationTime || null,
      };
    });
}

export async function getLandingProjection(): Promise<LandingProjection> {
  if (!hasDb()) {
    return { trendingTopics: [] };
  }

  try {
    const sessions = filterPublishableSessions(await listPublished());
    const trendingTopics = buildAssetDirectoryCards(sessions)
      .filter((item) => isSeededAssetKey(item.assetKey))
      .slice(0, 6)
      .map((item) => ({
        assetKey: item.assetKey,
        label: item.label,
        count: item.count,
        sentiment: item.latestSentiment,
        summary: item.summary,
        evidenceCount: item.evidenceCount,
        domainCount: item.domainCount,
      }));

    return { trendingTopics };
  } catch {
    return { trendingTopics: [] };
  }
}

export async function getAssetIndexProjection(): Promise<AssetIndexProjection> {
  if (!hasDb()) {
    return { loadError: true, assets: [] };
  }

  try {
    const sessions = filterPublishableSessions(await listPublished());
    const assets = buildAssetDirectoryCards(sessions)
      .filter((item) => isSeededAssetKey(item.assetKey))
      .sort((left, right) => right.latestDate - left.latestDate || right.count - left.count)
      .map(summarizeAssetCard);

    return {
      loadError: false,
      assets,
    };
  } catch {
    return {
      loadError: true,
      assets: [],
    };
  }
}

export async function getTrendingProjection(): Promise<TrendingProjection> {
  if (!hasDb()) {
    return { loadError: true, assets: [], recentReports: [] };
  }

  try {
    const sessions = filterPublishableSessions(await listPublished());
    const currentReports = (await listCurrentPublished(120)).filter((item) => summarizeSessionQuality(item.session).publishable);
    const assets = buildAssetDirectoryCards(sessions)
      .filter((item) => isSeededAssetKey(item.assetKey))
      .map(summarizeAssetCard);

    const recentReports = (currentReports.length
      ? currentReports
          .filter((item) => isSeededCanonicalHeadKey(item.head.subjectKey))
          .map((item) => ({
            session: item.session,
            title: item.head.canonicalLabel || item.session.topic,
          }))
      : sessions
          .filter((session) => session.assetKey ? isSeededAssetKey(session.assetKey) : false)
          .map((session) => ({ session, title: session.topic })))
      .filter((item) => item.session.slug)
      .sort((a, b) => b.session._creationTime - a.session._creationTime)
      .slice(0, 12)
      .map(({ session, title }) => {
        const summary = summarizePublishedSession(session, { displayTopic: title });
        return {
          slug: session.slug!,
          topic: title,
          date: session._creationTime,
          sentiment: summary.dominantSentiment,
          summary: summary.summary,
          evidenceCount: summary.quality.evidenceCount,
          domainCount: summary.quality.uniqueDomainCount,
        };
      });

    return {
      loadError: false,
      assets,
      recentReports,
    };
  } catch {
    return {
      loadError: true,
      assets: [],
      recentReports: [],
    };
  }
}

export async function getAssetHubProjection(key: string, locale: string): Promise<AssetHubProjection> {
  const label = decodeURIComponent(key).replace(/-/g, ' ');
  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

  if (!hasDb()) {
    return {
      status: 'missing_db',
      label,
      capitalizedLabel,
    };
  }

  const [sessions, currentReports, currentPublished] = await Promise.all([
    listByAsset(key).then(filterPublishableSessions).catch(() => null),
    listCurrentPublishedByAsset(key, 1).catch(() => []),
    listCurrentPublished(240).catch(() => []),
  ]);

  if (sessions === null) {
    return {
      status: 'unavailable',
      label,
      capitalizedLabel,
    };
  }

  if (!sessions || sessions.length === 0) {
    return {
      status: 'not_found',
      label,
      capitalizedLabel,
    };
  }

  const currentRecord = currentReports.find((item) => summarizeSessionQuality(item.session).publishable) || null;
  const latestPublishedSession =
    currentRecord?.session || sessions.find((session) => typeof session.slug === 'string' && session.slug) || sessions[0];
  const currentLabel = currentRecord?.head.canonicalLabel || latestPublishedSession.topic || capitalizedLabel;
  const currentSummary = summarizePublishedSession(latestPublishedSession, {
    displayTopic: currentLabel,
  });
  const aggregation = aggregateAssetData(sessions, key);
  const latestReportHref = latestPublishedSession.slug ? `/report/${latestPublishedSession.slug}` : null;
  const terminalSnapshotHref = `/terminal?sessionId=${encodeURIComponent(latestPublishedSession.sessionId)}`;
  const comparisonCards = buildPublishedComparisonCards(key, currentPublished);
  const pageUrl = `${baseUrl()}${localePrefix(locale)}/asset/${key}`;

  const structuredData: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${capitalizedLabel} Asset Hub`,
      description: `Current baseline, recurring catalysts, peer spillovers, and report history for ${capitalizedLabel}.`,
      url: pageUrl,
      inLanguage: locale,
      isPartOf: {
        '@type': 'WebSite',
        name: 'TrendAnalysis.ai',
        url: baseUrl(),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `${capitalizedLabel} Market Analysis`,
      description: `Aggregated trend analysis, source footing, sentiment history, and report archive for ${capitalizedLabel}.`,
      url: pageUrl,
      inLanguage: locale,
      creator: { '@type': 'Organization', name: 'TrendAnalysis.ai' },
      distribution: [{ '@type': 'DataDownload', contentUrl: pageUrl }],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${baseUrl()}${localePrefix(locale)}`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Asset Hubs',
          item: `${baseUrl()}${localePrefix(locale)}/asset`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: capitalizedLabel,
          item: pageUrl,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${capitalizedLabel} report archive`,
      itemListElement: aggregation.reports.slice(0, 10).map((report, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: report.topic,
        url: `${baseUrl()}${localePrefix(locale)}/report/${report.slug}`,
      })),
    },
  ];

  if (aggregation.faq.length > 0) {
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: aggregation.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    });
  }

  return {
    status: 'ok',
    label,
    capitalizedLabel,
    pageUrl,
    currentLabel,
    currentSummary,
    aggregation,
    latestPublishedAt: latestPublishedSession._creationTime,
    latestReportHref,
    terminalSnapshotHref,
    comparisonCards,
    structuredData,
  };
}

export async function getReportProjection(slug: string, locale: string): Promise<ReportProjection> {
  if (!hasDb()) {
    return { status: 'missing_db' };
  }

  const report = await getPublishedReportBySlug(slug);
  if (!report || !report.session.published) {
    return { status: 'not_found' };
  }

  const localizedPrefix = localePrefix(locale);
  const session = report.session;
  const displayTopic = report.head?.canonicalLabel || session.topic;
  const pageUrl = `${baseUrl()}${localizedPrefix}/report/${slug}`;
  const meta = (session.meta ?? {}) as Record<string, unknown>;
  const artifacts = (meta.artifacts ?? {}) as Record<string, unknown>;
  const evidence = (artifacts.evidence as ReportEvidenceItem[]) ?? [];
  const tape = (artifacts.tape as ReportTapeItem[]) ?? [];
  const nodes = (artifacts.nodes as ReportNode[]) ?? [];
  const edges = (artifacts.edges as ReportEdge[]) ?? [];
  const currentSummary = summarizePublishedSession(session, { displayTopic });
  const quality = currentSummary.quality;
  const sortedEvidence = [...evidence].sort((a, b) => {
    const tsA = Math.max(Number(a.publishedAt || 0), Number(a.observedAt || 0));
    const tsB = Math.max(Number(b.publishedAt || 0), Number(b.observedAt || 0));
    return tsB - tsA;
  });

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
  const refreshDiff = meta.refreshDiff as
    | {
        changeScore?: number;
        headline?: string;
        summary?: string;
        sentimentShift?: string;
        newEvidence?: Array<{ title: string; url: string; source: string }>;
        newCatalysts?: string[];
      }
    | undefined;
  const date = new Date(session._creationTime).toISOString();

  const assetKey = session.assetKey || undefined;
  const assetLabel = assetKey ? titleFromAssetKey(assetKey) : null;
  const assetHubUrl = assetKey ? `${baseUrl()}${localizedPrefix}/asset/${assetKey}` : null;
  const changeSummary =
    monitorDiff?.headline && monitorDiff?.summary
      ? { title: 'What Changed Since Last Run', ...monitorDiff }
      : refreshDiff?.headline && refreshDiff?.summary
        ? { title: 'What Changed Since Previous Published Run', ...refreshDiff }
        : null;

  let relatedReports: Array<{ slug: string; topic: string; date: number; summary: string | null }> = [];
  let currentPublishedReports: CurrentPublishedReportRow[] = [];
  if (assetKey) {
    try {
      const [siblings, currentPublished] = await Promise.all([
        listByAsset(assetKey, 8).then(filterPublishableSessions),
        listCurrentPublished(240),
      ]);
      currentPublishedReports = currentPublished;
      relatedReports = siblings
        .filter((entry) => entry.slug && entry.slug !== slug)
        .slice(0, 3)
        .map((entry) => ({
          slug: entry.slug!,
          topic: entry.topic,
          date: entry._creationTime,
          summary: summarizePublishedSession(entry, { displayTopic: assetLabel || displayTopic }).summary,
        }));
    } catch {
      relatedReports = [];
    }
  }

  const reportSubjectKey = report.head?.subjectKey || null;
  const currentComparison = reportSubjectKey ? getComparisonByKey(reportSubjectKey) : null;
  const comparisonCards = currentComparison
    ? listRelatedComparisons(currentComparison.key)
        .filter((definition) => isSeededCanonicalHeadKey(definition.key))
        .map((definition) => {
          const published = currentPublishedReports.find((item) => item.head.subjectKey === definition.key);
          return {
            definition,
            href: published?.session.slug
              ? `/report/${published.session.slug}`
              : `/terminal?q=${encodeURIComponent(definition.label)}`,
            ctaLabel: published?.session.slug ? 'Open comparison report' : 'Run comparison',
            lastUpdatedAt: published?.session._creationTime || null,
          };
        })
    : assetKey
      ? buildPublishedComparisonCards(assetKey, currentPublishedReports)
      : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${displayTopic} — TrendAnalysis Report`,
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    datePublished: date,
    description: `TrendAnalysis report for ${displayTopic} with ${evidence.length} evidence sources.`,
    inLanguage: locale,
    isPartOf: assetHubUrl
      ? {
          '@type': 'CollectionPage',
          name: `${assetLabel} Asset Hub`,
          url: assetHubUrl,
        }
      : undefined,
    author: {
      '@type': 'Organization',
      name: 'TrendAnalysis.ai',
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${baseUrl()}${localizedPrefix}`,
      },
      ...(assetKey && assetLabel
        ? [
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Asset Hubs',
              item: `${baseUrl()}${localizedPrefix}/asset`,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: assetLabel,
              item: assetHubUrl,
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: displayTopic,
              item: pageUrl,
            },
          ]
        : [
            {
              '@type': 'ListItem',
              position: 2,
              name: displayTopic,
              item: pageUrl,
            },
          ]),
    ],
  };

  const jumpLinks = [
    { id: 'summary', label: 'Summary' },
    ...(changeSummary ? [{ id: 'changes', label: 'What changed' }] : []),
    { id: 'evidence', label: 'Evidence' },
    ...(currentSummary.clusters.length > 0 ? [{ id: 'clusters', label: 'Clusters' }] : []),
    ...(tape.length > 2 ? [{ id: 'timeline', label: 'Timeline' }] : []),
    ...(nodes.length > 0 ? [{ id: 'mind-map', label: 'Mind map' }] : []),
    ...(comparisonCards.length > 0 ? [{ id: 'comparison-context', label: 'Comparisons' }] : []),
    ...(assetKey ? [{ id: 'asset-context', label: 'Asset context' }] : []),
  ];

  return {
    status: 'ok',
    report,
    pageUrl,
    localePrefix: localizedPrefix,
    displayTopic,
    date,
    mode,
    evidence,
    tape,
    nodes,
    edges,
    currentSummary,
    quality,
    sortedEvidence,
    changeSummary,
    assetKey,
    assetLabel,
    relatedReports,
    currentComparison,
    comparisonCards,
    jsonLd,
    breadcrumbJsonLd,
    jumpLinks,
  };
}
