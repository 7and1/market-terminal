import type { SessionRow } from '@/lib/db';
import { collectTopLabels, pickKeyEvidence, summarizeReportQuality } from '@/lib/report-quality';
import { evidenceItems, getArtifacts, graphNodes, storyClusters } from '@/lib/session-data';
import { LINKABLE_ASSET_KEYS } from '@/lib/topic-catalog';
import type { EvidenceItem, StoryCluster } from '@/lib/types';

export type SentimentPoint = {
  date: number;
  sentiment: 'bullish' | 'bearish' | 'mixed' | 'neutral';
  count: number;
};

export type CoverageLabel = {
  name: string;
  count: number;
  sessionCoverage: number;
  lastSeenAt: number;
};

export type AssetReportHistory = {
  slug: string;
  sessionId: string;
  topic: string;
  date: number;
  dominantSentiment: SentimentPoint['sentiment'] | null;
  summary: string | null;
  topClusterTitle: string | null;
  evidenceCount: number;
  domainCount: number;
};

export type AssetPeerAsset = {
  label: string;
  assetKey: string | null;
  count: number;
  lastSeenAt: number;
};

export type AssetFaqItem = {
  question: string;
  answer: string;
};

export type AssetDirectoryCard = {
  assetKey: string;
  label: string;
  count: number;
  latestDate: number;
  latestSentiment: SentimentPoint['sentiment'] | null;
  summary: string | null;
  evidenceCount: number;
  domainCount: number;
  latestSlug: string | null;
  topCatalyst: string | null;
};

export type PublishedSessionSummary = {
  evidence: EvidenceItem[];
  clusters: StoryCluster[];
  quality: ReturnType<typeof summarizeReportQuality>;
  keyEvidence: EvidenceItem[];
  topCatalysts: string[];
  topEntities: string[];
  peerAssets: string[];
  whatMoved: string[];
  whyItMatters: string[];
  summary: string | null;
  dominantSentiment: SentimentPoint['sentiment'] | null;
  topClusterTitle: string | null;
};

export type AssetAggregation = {
  assetKey: string;
  totalAnalyses: number;
  latestAnalysisDate: number | null;
  latestSentiment: SentimentPoint['sentiment'] | null;
  sentimentTrend: SentimentPoint[];
  topCatalysts: CoverageLabel[];
  topEntities: CoverageLabel[];
  latestClusters: StoryCluster[];
  reports: AssetReportHistory[];
  peerAssets: AssetPeerAsset[];
  faq: AssetFaqItem[];
};

function normalizeLabelKey(raw: string) {
  return raw
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleFromAssetKey(assetKey: string) {
  const label = decodeURIComponent(assetKey).replace(/-/g, ' ');
  return label.replace(/\b\w/g, (char) => char.toUpperCase());
}

function uniqueStrings(values: Array<string | null | undefined>, limit: number) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  ).slice(0, limit);
}

function evidenceTimestamp(item: EvidenceItem) {
  return Math.max(Number(item.publishedAt || 0), Number(item.observedAt || 0), 0);
}

function dominantSentimentFromEvidence(evidence: EvidenceItem[]): SentimentPoint['sentiment'] | null {
  const counts = new Map<SentimentPoint['sentiment'], number>();
  for (const item of evidence) {
    const sentiment = item.aiSummary?.sentiment;
    if (!sentiment) continue;
    counts.set(sentiment, (counts.get(sentiment) || 0) + 1);
  }
  let best: SentimentPoint['sentiment'] | null = null;
  let max = 0;
  for (const [sentiment, count] of counts.entries()) {
    if (count > max) {
      best = sentiment;
      max = count;
    }
  }
  return best;
}

function linkableAssetKeyForLabel(label: string, currentAssetKey?: string | null) {
  const candidate = normalizeLabelKey(label).replace(/\s+/g, '-');
  if (!candidate || candidate === currentAssetKey) return null;
  return LINKABLE_ASSET_KEYS.has(candidate) ? candidate : null;
}

export function summarizePublishedSession(
  session: Pick<SessionRow, 'topic' | 'meta'>,
  options?: { displayTopic?: string },
): PublishedSessionSummary {
  const displayTopic = String(options?.displayTopic || session.topic || '').trim() || session.topic;
  const artifacts = getArtifacts(session.meta);
  const evidence = evidenceItems(artifacts.evidence);
  const clusters = storyClusters(artifacts.clusters);
  const nodes = graphNodes(artifacts.nodes);
  const quality = summarizeReportQuality(evidence);
  const keyEvidence = pickKeyEvidence(evidence, 3);
  const topCatalysts = collectTopLabels(evidence, 'catalysts', 6);
  const topEntities = collectTopLabels(evidence, 'entities', 6);
  const peerAssets = uniqueStrings(
    nodes
      .filter((node) => node.type === 'asset')
      .map((node) => node.label)
      .filter((label) => label.toLowerCase() !== displayTopic.toLowerCase()),
    6,
  );
  const refreshDiff = ((session.meta as Record<string, unknown>).refreshDiff ?? {}) as { summary?: string };
  const monitorDiff = ((session.meta as Record<string, unknown>).monitorDiff ?? {}) as { summary?: string };
  const whatMoved = uniqueStrings(
    [
      ...clusters.slice(0, 2).map((cluster) => cluster.summary),
      ...keyEvidence.flatMap((item) => item.aiSummary?.bullets || []),
      ...keyEvidence.map((item) => item.excerpt || item.title),
    ],
    4,
  );
  const whyItMatters = uniqueStrings(
    [
      topCatalysts.length ? `Recurring catalysts in the current evidence set: ${topCatalysts.slice(0, 4).join(', ')}.` : '',
      peerAssets.length ? `Cross-market or peer read-through appears in ${peerAssets.slice(0, 4).join(', ')}.` : '',
      refreshDiff.summary || '',
      monitorDiff.summary || '',
      topEntities.length ? `Entities driving the narrative include ${topEntities.slice(0, 4).join(', ')}.` : '',
    ],
    4,
  );
  const summary =
    whatMoved[0] ||
    clusters[0]?.summary ||
    keyEvidence[0]?.aiSummary?.bullets?.[0] ||
    keyEvidence[0]?.excerpt ||
    keyEvidence[0]?.title ||
    null;

  return {
    evidence,
    clusters,
    quality,
    keyEvidence,
    topCatalysts,
    topEntities,
    peerAssets,
    whatMoved,
    whyItMatters,
    summary,
    dominantSentiment: dominantSentimentFromEvidence(evidence),
    topClusterTitle: clusters[0]?.title || null,
  };
}

export function buildAssetDirectoryCards(sessions: SessionRow[]): AssetDirectoryCard[] {
  const grouped = new Map<
    string,
    {
      count: number;
      latestDate: number;
      latestSession: SessionRow;
    }
  >();

  for (const session of sessions) {
    const assetKey = session.assetKey;
    if (!assetKey) continue;
    const existing = grouped.get(assetKey);
    if (!existing) {
      grouped.set(assetKey, {
        count: 1,
        latestDate: session._creationTime,
        latestSession: session,
      });
      continue;
    }

    existing.count += 1;
    if (session._creationTime > existing.latestDate) {
      existing.latestDate = session._creationTime;
      existing.latestSession = session;
    }
  }

  return Array.from(grouped.entries())
    .map(([assetKey, value]) => {
      const summary = summarizePublishedSession(value.latestSession, {
        displayTopic: titleFromAssetKey(assetKey),
      });
      return {
        assetKey,
        label: decodeURIComponent(assetKey).replace(/-/g, ' '),
        count: value.count,
        latestDate: value.latestDate,
        latestSentiment: summary.dominantSentiment,
        summary: summary.summary,
        evidenceCount: summary.quality.evidenceCount,
        domainCount: summary.quality.uniqueDomainCount,
        latestSlug: value.latestSession.slug,
        topCatalyst: summary.topCatalysts[0] || null,
      };
    })
    .sort((left, right) => {
      return (
        right.count - left.count ||
        right.latestDate - left.latestDate ||
        left.label.localeCompare(right.label)
      );
    });
}

function buildCoverageLabels(
  sessions: SessionRow[],
  key: 'catalysts' | 'entities',
): CoverageLabel[] {
  const coverage = new Map<string, { name: string; count: number; sessionIds: Set<string>; lastSeenAt: number }>();

  for (const session of sessions) {
    const evidence = evidenceItems(getArtifacts(session.meta).evidence);
    const seenInSession = new Set<string>();
    for (const item of evidence) {
      const labels = item.aiSummary?.[key] || [];
      for (const raw of labels) {
        const name = String(raw || '').trim();
        if (!name) continue;
        const normalized = normalizeLabelKey(name);
        if (!normalized) continue;
        const entry =
          coverage.get(normalized) || {
            name,
            count: 0,
            sessionIds: new Set<string>(),
            lastSeenAt: 0,
          };
        entry.count += 1;
        entry.lastSeenAt = Math.max(entry.lastSeenAt, evidenceTimestamp(item), session._creationTime);
        if (!seenInSession.has(normalized)) {
          entry.sessionIds.add(session.sessionId);
          seenInSession.add(normalized);
        }
        coverage.set(normalized, entry);
      }
    }
  }

  return Array.from(coverage.values())
    .sort((left, right) => {
      return (
        right.count - left.count ||
        right.sessionIds.size - left.sessionIds.size ||
        right.lastSeenAt - left.lastSeenAt ||
        left.name.localeCompare(right.name)
      );
    })
    .slice(0, 15)
    .map((entry) => ({
      name: entry.name,
      count: entry.count,
      sessionCoverage: entry.sessionIds.size,
      lastSeenAt: entry.lastSeenAt,
    }));
}

function buildPeerAssets(sessions: SessionRow[], currentAssetKey: string) {
  const peers = new Map<string, { label: string; count: number; lastSeenAt: number }>();

  for (const session of sessions) {
    const summary = summarizePublishedSession(session, {
      displayTopic: titleFromAssetKey(currentAssetKey),
    });
    for (const label of summary.peerAssets) {
      const normalized = normalizeLabelKey(label);
      if (!normalized) continue;
      const entry = peers.get(normalized) || { label, count: 0, lastSeenAt: 0 };
      entry.count += 1;
      entry.lastSeenAt = Math.max(entry.lastSeenAt, session._creationTime);
      peers.set(normalized, entry);
    }
  }

  return Array.from(peers.values())
    .map((entry) => ({
      label: entry.label,
      assetKey: linkableAssetKeyForLabel(entry.label, currentAssetKey),
      count: entry.count,
      lastSeenAt: entry.lastSeenAt,
    }))
    .sort((left, right) => {
      return (
        right.count - left.count ||
        right.lastSeenAt - left.lastSeenAt ||
        left.label.localeCompare(right.label)
      );
    })
    .slice(0, 8);
}

function buildAssetFaq(options: {
  assetKey: string;
  totalAnalyses: number;
  topCatalysts: CoverageLabel[];
  currentReport: AssetReportHistory | null;
}) {
  const label = titleFromAssetKey(options.assetKey);
  if (options.totalAnalyses < 3 || options.topCatalysts.length < 3) return [];

  const catalystText = options.topCatalysts
    .slice(0, 3)
    .map((item) => item.name)
    .join(', ');

  return [
    {
      question: `What is moving ${label} right now?`,
      answer:
        options.currentReport?.summary ||
        `The latest ${label} baseline aggregates the newest publishable evidence set into a current market read.`,
    },
    {
      question: `Which catalysts keep recurring in ${label} analysis?`,
      answer: `Across ${options.totalAnalyses} published analyses, recurring catalysts include ${catalystText}.`,
    },
    {
      question: `Where should I start for the latest ${label} read?`,
      answer: options.currentReport
        ? `Start with the latest published report from ${new Date(options.currentReport.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}, then use the asset hub archive to compare how the narrative evolved.`
        : `Start with the latest published analysis on the ${label} asset hub, then review the archive to compare how the narrative evolved.`,
    },
  ];
}

export function aggregateAssetData(sessions: SessionRow[], assetKey: string): AssetAggregation {
  const sorted = [...sessions].sort((a, b) => b._creationTime - a._creationTime);
  const label = titleFromAssetKey(assetKey);
  const sentimentCounts = new Map<string, Map<string, number>>();

  for (const session of sorted) {
    const evidence = evidenceItems(getArtifacts(session.meta).evidence);
    const dateKey = new Date(session._creationTime).toISOString().slice(0, 10);
    for (const item of evidence) {
      if (!item.aiSummary?.sentiment) continue;
      const dayMap = sentimentCounts.get(dateKey) ?? new Map<string, number>();
      dayMap.set(item.aiSummary.sentiment, (dayMap.get(item.aiSummary.sentiment) ?? 0) + 1);
      sentimentCounts.set(dateKey, dayMap);
    }
  }

  const sentimentTrend: SentimentPoint[] = [];
  for (const [dateStr, counts] of Array.from(sentimentCounts.entries()).sort()) {
    let dominant: SentimentPoint['sentiment'] = 'neutral';
    let max = 0;
    let total = 0;
    for (const [sentiment, count] of counts) {
      total += count;
      if (count > max) {
        max = count;
        dominant = sentiment as SentimentPoint['sentiment'];
      }
    }
    sentimentTrend.push({ date: new Date(dateStr).getTime(), sentiment: dominant, count: total });
  }

  const reports = sorted
    .filter((session) => session.slug)
    .map((session) => {
      const summary = summarizePublishedSession(session, { displayTopic: label });
      return {
        slug: session.slug!,
        sessionId: session.sessionId,
        topic: session.topic,
        date: session._creationTime,
        dominantSentiment: summary.dominantSentiment,
        summary: summary.summary,
        topClusterTitle: summary.topClusterTitle,
        evidenceCount: summary.quality.evidenceCount,
        domainCount: summary.quality.uniqueDomainCount,
      };
    });
  const topCatalysts = buildCoverageLabels(sorted, 'catalysts');
  const topEntities = buildCoverageLabels(sorted, 'entities');

  return {
    assetKey,
    totalAnalyses: sorted.length,
    latestAnalysisDate: sorted[0]?._creationTime ?? null,
    latestSentiment: sorted[0] ? summarizePublishedSession(sorted[0], { displayTopic: label }).dominantSentiment : null,
    sentimentTrend,
    topCatalysts,
    topEntities,
    latestClusters: storyClusters(getArtifacts(sorted[0]?.meta).clusters),
    reports,
    peerAssets: buildPeerAssets(sorted, assetKey),
    faq: buildAssetFaq({
      assetKey,
      totalAnalyses: sorted.length,
      topCatalysts,
      currentReport: reports[0] || null,
    }),
  };
}
