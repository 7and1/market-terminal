import type { TimelineItem } from '@/components/terminal/EvidenceTimeline';
import type { SessionSnapshotArtifacts } from '@/components/terminal/model';
import type { ReferenceContext, TracePageState, UsageSummary } from '@/lib/session-data';
import type { EvidenceItem } from '@/lib/types';
import { normalizeQueryLocale } from '@/lib/query-copy';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
};

export type SessionsListItem = {
  id: string;
  status?: string;
};

export type SessionsListResponse = {
  sessions?: SessionsListItem[];
  pageInfo?: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type PublishedReportState = {
  slug: string;
  locale: string;
  fullUrl: string;
  relativeUrl: string;
  alreadyPublished: boolean;
};

export function buildPublishedReportPath(slug: string, locale?: string | null): string {
  const normalizedLocale = normalizeQueryLocale(locale);
  const localePrefix = normalizedLocale === 'en' ? '' : `/${normalizedLocale}`;
  return `${localePrefix}/report/${slug}`;
}

export function createEmptyTracePage(): TracePageState {
  return {
    nextCursor: null,
    hasMore: false,
    loading: false,
    error: null,
  };
}

export function createEmptyUsageSummary(): UsageSummary {
  return {
    totalTokens: 0,
    events: 0,
    latestModel: null,
    byTag: [],
    byModel: [],
  };
}

export function createInitialMessages(now: () => number): ChatMessage[] {
  return [
    {
      id: 'm0',
      role: 'assistant',
      content: 'Start empty, then build: ask a topic and I will stream sources, a graph map, and narrative clusters.',
      createdAt: now(),
    },
  ];
}

export function buildReplayTimeline({
  events,
  artifacts,
  startedAt,
}: {
  events: Array<{ id: number; created_at: string; type: string; payload: unknown }>;
  artifacts: SessionSnapshotArtifacts;
  startedAt: number;
}): TimelineItem[] {
  const nextTimeline: TimelineItem[] = [];

  for (const event of events) {
    const ts = Date.parse(event.created_at) || startedAt;
    if (event.type === 'price.snapshot') {
      const payload = event.payload as { provider?: string; error?: string; series?: unknown[] };
      nextTimeline.push({
        id: `tl_hist_price_${event.id}`,
        ts,
        kind: 'price',
        title: `Price snapshot (${payload.provider || 'price'})`,
        subtitle: payload.error || `${payload.series?.length || 0} points`,
        tags: ['price', payload.provider || 'unknown'],
      });
      continue;
    }
    if (event.type === 'videos.snapshot') {
      const payload = event.payload as { mode?: string; items?: unknown[] };
      nextTimeline.push({
        id: `tl_hist_media_${event.id}`,
        ts,
        kind: 'media',
        title: `Video snapshot (${payload.mode || 'media'})`,
        subtitle: `${payload.items?.length || 0} items`,
        tags: ['media', payload.mode || 'snapshot'],
      });
      continue;
    }
    if (event.type === 'warn') {
      const payload = event.payload as { message?: string };
      nextTimeline.push({
        id: `tl_hist_warn_${event.id}`,
        ts,
        kind: 'note',
        title: 'Warning',
        subtitle: String(payload.message || ''),
        tags: ['warn'],
      });
    }
  }

  for (const evidence of Array.isArray(artifacts.evidence) ? artifacts.evidence : []) {
    nextTimeline.push({
      id: `tl_hist_ev_${evidence.id}`,
      ts: typeof evidence.publishedAt === 'number' ? evidence.publishedAt : startedAt,
      kind: 'evidence',
      title: evidence.title,
      subtitle: evidence.source,
      evidenceIds: [evidence.id],
      tags: [
        ...(evidence.aiSummary?.catalysts || []).slice(0, 4),
        ...(evidence.aiSummary?.entities || []).slice(0, 2),
      ],
    });
  }

  return nextTimeline.sort((a, b) => a.ts - b.ts).slice(-280);
}

export function deriveReferenceContext({
  selectedNodeId,
  selectedEdgeId,
  selectedTag,
  drawerEvidence,
}: {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedTag: string | null;
  drawerEvidence: EvidenceItem[];
}): ReferenceContext {
  return {
    nodeIds: selectedNodeId ? [selectedNodeId] : [],
    edgeIds: selectedEdgeId ? [selectedEdgeId] : [],
    tags: selectedTag ? [selectedTag] : [],
    evidenceIds: Array.from(new Set(drawerEvidence.map((item) => item.id).filter(Boolean))).slice(0, 24),
  };
}

export function deriveContextFocusEvidenceIds({
  query,
  extraEvidenceIds = [],
  evidence = [],
  edges = [],
  tapeTagsByEvidenceId,
}: {
  query: string;
  extraEvidenceIds?: string[];
  evidence?: Array<{ id: string; aiSummary?: { catalysts?: string[]; entities?: string[] } }>;
  edges?: Array<{ from: string; to: string; evidenceIds: string[] }>;
  tapeTagsByEvidenceId: Map<string, string[]>;
}): string[] {
  const mentions = Array.from(new Set((query.match(/@([a-zA-Z0-9_-]+)/g) || []).map((m) => m.slice(1))));
  const mentionEvidence = mentions.filter((token) => /^ev_[a-z0-9_:-]+$/i.test(token));
  const mentionNodes = mentions.filter((token) => /^n_[a-z0-9_:-]+$/i.test(token));
  const mentionTags = mentions.filter((token) => !/^ev_[a-z0-9_:-]+$/i.test(token) && !/^n_[a-z0-9_:-]+$/i.test(token));
  const mentionNodeEvidence = mentionNodes.flatMap((nodeId) =>
    edges.filter((edge) => edge.from === nodeId || edge.to === nodeId).flatMap((edge) => edge.evidenceIds || []),
  );
  const mentionTagEvidence = mentionTags.flatMap((tag) =>
    evidence
      .filter((item) => {
        const tags = [
          ...(tapeTagsByEvidenceId.get(item.id) || []),
          ...(item.aiSummary?.catalysts || []),
          ...(item.aiSummary?.entities || []),
        ].map((entry) => String(entry || '').toLowerCase());
        return tags.includes(tag.toLowerCase());
      })
      .map((item) => item.id),
  );

  return Array.from(
    new Set([...extraEvidenceIds, ...mentionEvidence, ...mentionNodeEvidence, ...mentionTagEvidence]),
  ).slice(0, 24);
}
