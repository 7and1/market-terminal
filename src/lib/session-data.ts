import type { GraphEdge, GraphNode } from '@/components/terminal/types';
import type { EvidenceItem, StoryCluster, TapeItem } from '@/lib/types';

export type JsonRecord = Record<string, unknown>;

export type SessionArtifacts = {
  evidence?: EvidenceItem[];
  tape?: TapeItem[];
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  clusters?: StoryCluster[];
  price?: unknown;
  videos?: unknown;
};

export type SessionMeta = JsonRecord & {
  mode?: 'fast' | 'deep';
  provider?: string;
  model?: string;
  runIntent?: 'general' | 'monitor';
  monitorId?: string | null;
  monitorRunId?: string | null;
  baselineSessionId?: string | null;
  monitorDiff?: {
    changeScore: number;
    significant: boolean;
    headline: string;
    summary: string;
    sentimentShift: 'improved' | 'worsened' | 'mixed' | 'flat';
    newEvidence: Array<{ title: string; url: string; source: string }>;
    newCatalysts: string[];
    deliveryError?: string;
  };
  plan?: {
    queries?: string[];
    angles?: string[];
  };
  selectedUrls?: string[];
  artifacts?: SessionArtifacts;
  perf?: unknown;
};

export type TraceEventRow = {
  id: number;
  created_at: string;
  type: string;
  payload: JsonRecord;
};

export type SessionResponse = {
  id: string;
  created_at: string;
  topic: string;
  status: string;
  step: string;
  progress: number;
  meta: SessionMeta;
};

export type TraceResponse = {
  session: SessionResponse;
  events: TraceEventRow[];
  pageInfo?: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type TerminalMode = 'draft' | 'live' | 'replay';

export type PerfApiEntry = {
  name: string;
  calls: number;
  totalMs: number;
  avgMs: number;
  failures: number;
};

export type PerformanceSummary = {
  status: string;
  totalMs: number;
  generatedAt: number;
  marksStored: number;
  stepDurationsMs: Record<string, number>;
  api: PerfApiEntry[];
  topStage: string | null;
  topApi: string | null;
};

export type UsageSummary = {
  totalTokens: number;
  events: number;
  latestModel: string | null;
  byTag: Array<{
    tag: string;
    totalTokens: number;
    events: number;
    model: string | null;
  }>;
  byModel: Array<{
    model: string;
    totalTokens: number;
    events: number;
  }>;
};

export type TracePageState = {
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

export type ReferenceContext = {
  nodeIds: string[];
  edgeIds: string[];
  tags: string[];
  evidenceIds: string[];
};

export function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonRecord;
}

export function asSessionMeta(value: unknown): SessionMeta {
  return asRecord(value) as SessionMeta;
}

export function asSessionArtifacts(value: unknown): SessionArtifacts {
  return asRecord(value) as SessionArtifacts;
}

export function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

export function evidenceItems(value: unknown): EvidenceItem[] {
  return Array.isArray(value) ? (value as EvidenceItem[]) : [];
}

export function tapeItems(value: unknown): TapeItem[] {
  return Array.isArray(value) ? (value as TapeItem[]) : [];
}

export function graphNodes(value: unknown): GraphNode[] {
  return Array.isArray(value) ? (value as GraphNode[]) : [];
}

export function graphEdges(value: unknown): GraphEdge[] {
  return Array.isArray(value) ? (value as GraphEdge[]) : [];
}

export function storyClusters(value: unknown): StoryCluster[] {
  return Array.isArray(value) ? (value as StoryCluster[]) : [];
}

export function countOf(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function getArtifacts(meta: unknown): SessionArtifacts {
  return asSessionArtifacts(asSessionMeta(meta).artifacts);
}

export function firstEvidenceSentiment(meta: unknown): string | null {
  const evidence = evidenceItems(getArtifacts(meta).evidence);
  for (const item of evidence) {
    if (item.aiSummary?.sentiment) return item.aiSummary.sentiment;
  }
  return null;
}

function asFiniteNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function normalizePerformanceSummary(raw: unknown): PerformanceSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const totalMs = asFiniteNumber(src.totalMs);
  if (!totalMs && totalMs !== 0) return null;

  const stepDurationsSrc =
    src.stepDurationsMs && typeof src.stepDurationsMs === 'object'
      ? (src.stepDurationsMs as Record<string, unknown>)
      : {};
  const stepDurationsMs: Record<string, number> = Object.fromEntries(
    Object.entries(stepDurationsSrc)
      .map(([key, value]): [string, number] => [String(key), asFiniteNumber(value)])
      .filter(([, value]) => value > 0),
  );

  const api = (Array.isArray(src.api) ? src.api : [])
    .map((row) => {
      const record = asRecord(row);
      return {
        name: String(record.name || 'api'),
        calls: Math.max(0, Math.round(asFiniteNumber(record.calls))),
        totalMs: asFiniteNumber(record.totalMs),
        avgMs: asFiniteNumber(record.avgMs),
        failures: Math.max(0, Math.round(asFiniteNumber(record.failures))),
      };
    })
    .filter((row) => row.totalMs > 0);

  const topStage = Object.entries(stepDurationsMs)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const topApi = [...api].sort((a, b) => b.totalMs - a.totalMs)[0]?.name || null;

  return {
    status: String(src.status || 'unknown'),
    totalMs,
    generatedAt: asFiniteNumber(src.generatedAt),
    marksStored: Math.max(0, Math.round(asFiniteNumber(src.marksStored))),
    stepDurationsMs,
    api,
    topStage,
    topApi,
  };
}

export function collectLatestPerformanceSummary(trace: TraceResponse | null): PerformanceSummary | null {
  const fromMeta = normalizePerformanceSummary(trace?.session?.meta?.perf);
  if (fromMeta) return fromMeta;

  const events = trace?.events || [];
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i]?.type !== 'perf.summary') continue;
    const parsed = normalizePerformanceSummary(events[i].payload);
    if (parsed) return parsed;
  }
  return null;
}

export function summarizeUsageEvents(events: TraceEventRow[]): UsageSummary {
  const byTag = new Map<string, { totalTokens: number; events: number; model: string | null }>();
  const byModel = new Map<string, { totalTokens: number; events: number }>();
  let totalTokens = 0;
  let latestModel: string | null = null;
  let usageEvents = 0;

  for (const event of events) {
    if (event.type !== 'ai.usage') continue;
    const payload = asRecord(event.payload);
    const tag = String(payload.tag || 'ai');
    const model = typeof payload.model === 'string' ? payload.model : null;
    const tokens = Math.max(0, Math.round(asFiniteNumber(payload.total_tokens)));
    const tagEntry = byTag.get(tag) || { totalTokens: 0, events: 0, model: null };

    tagEntry.totalTokens += tokens;
    tagEntry.events += 1;
    tagEntry.model = model || tagEntry.model;
    byTag.set(tag, tagEntry);

    if (model) {
      const modelEntry = byModel.get(model) || { totalTokens: 0, events: 0 };
      modelEntry.totalTokens += tokens;
      modelEntry.events += 1;
      byModel.set(model, modelEntry);
      latestModel = model;
    }

    totalTokens += tokens;
    usageEvents += 1;
  }

  return {
    totalTokens,
    events: usageEvents,
    latestModel,
    byTag: Array.from(byTag.entries())
      .map(([tag, value]) => ({
        tag,
        totalTokens: value.totalTokens,
        events: value.events,
        model: value.model,
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens || a.tag.localeCompare(b.tag)),
    byModel: Array.from(byModel.entries())
      .map(([model, value]) => ({
        model,
        totalTokens: value.totalTokens,
        events: value.events,
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens || a.model.localeCompare(b.model)),
  };
}

export function tracePageStateFromResponse(response: Pick<TraceResponse, 'pageInfo'>): TracePageState {
  return {
    nextCursor: typeof response.pageInfo?.nextCursor === 'string' ? response.pageInfo.nextCursor : null,
    hasMore: Boolean(response.pageInfo?.hasMore),
    loading: false,
    error: null,
  };
}
