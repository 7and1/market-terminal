import type { QueryQueueItem } from '@/components/terminal/ActivityCard';
import type { GraphEdge, GraphNode } from '@/components/terminal/types';
import type { Session, VideosResponse } from '@/components/terminal/model';
import type { TraceResponse, UsageSummary } from '@/lib/session-data';
import type { EvidenceItem } from '@/lib/types';

export const now = () => Date.now();

export function normalizeTopicKey(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return '';
  if (/\b(btc|bitcoin)\b/.test(s)) return 'bitcoin';
  if (/\b(eth|ethereum)\b/.test(s)) return 'ethereum';
  if (/\b(sol|solana)\b/.test(s)) return 'solana';
  if (/\b(xau|gold)\b/.test(s)) return 'gold';
  if (/\b(wti|brent|oil)\b/.test(s)) return 'oil';
  if (/\b(dxy|dollar index)\b/.test(s)) return 'dxy';
  return s;
}

function normalizeToken(raw: string) {
  return String(raw || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenize(raw: string) {
  const s = normalizeToken(raw);
  if (!s) return [];
  return s.split(/\s+/).filter((t) => t.length > 2);
}

function overlapScore(a: string, b: string) {
  const aa = new Set(tokenize(a));
  const bb = tokenize(b);
  if (!aa.size || !bb.length) return 0;
  let hit = 0;
  for (const t of bb) {
    if (aa.has(t)) hit += 1;
  }
  return hit / Math.max(1, Math.min(aa.size, bb.length));
}

export function guessTopicFromQuery(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const dollar = s.match(/\$([A-Za-z]{1,6})\b/)?.[1];
  if (dollar) return dollar.toUpperCase();
  const lower = s.toLowerCase();
  if (/\bbitcoin\b|\bbtc\b/.test(lower)) return 'Bitcoin';
  if (/\bethereum\b|\beth\b/.test(lower)) return 'Ethereum';
  if (/\bgold\b|\bxau\b/.test(lower)) return 'Gold';
  if (/\boil\b|\bwti\b|\bbrent\b/.test(lower)) return 'Oil';
  if (/\bnvidia\b|\bnvda\b/.test(lower)) return 'NVDA';
  if (/\btesla\b|\btsla\b/.test(lower)) return 'TSLA';
  if (/\bapple\b|\baapl\b/.test(lower)) return 'AAPL';
  if (/\bmicrostrategy\b|\bmstr\b/.test(lower)) return 'MSTR';
  if (/\bcoinbase\b|\bcoin\b/.test(lower)) return 'COIN';
  if (/\bcpi\b/.test(lower)) return 'CPI';
  return null;
}

function parseSseMessage(raw: string): { event: string; data: unknown } | null {
  const lines = raw.split('\n');
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim() || 'message';
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
    }
  }
  const dataText = dataLines.join('\n');
  if (!dataText) return null;
  try {
    return { event, data: JSON.parse(dataText) };
  } catch {
    return { event, data: dataText };
  }
}

export function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  const message = error instanceof Error ? error.message : String(error || '');
  return /abort|unmount/i.test(message);
}

export async function consumeSseStream({ response, signal, onEvent }: {
  response: Response;
  signal: AbortSignal;
  onEvent: (event: string, data: unknown) => void;
}) {
  if (!response.body) throw new Error('Missing response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    if (signal.aborted) break;
    let value: Uint8Array | undefined;
    let done = false;
    try {
      const next = await reader.read();
      value = next.value;
      done = next.done;
    } catch (e) {
      if (signal.aborted || isAbortError(e)) break;
      throw e;
    }
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, '\n');
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (!raw.trim()) continue;
      const msg = parseSseMessage(raw);
      if (!msg) continue;
      onEvent(msg.event, msg.data);
    }
  }
}

export function buildSeries(startAt: number): { y: number[]; t: number[] } {
  const points = 120;
  const y: number[] = [];
  const t: number[] = [];
  let p = 100;
  for (let i = 0; i < points; i += 1) {
    const ts = startAt - (points - 1 - i) * 12 * 60_000;
    t.push(ts);
    const drift = Math.sin(i / 11) * 0.32 + Math.cos(i / 8) * 0.2;
    const noise = (Math.random() - 0.5) * 0.8;
    p = Math.max(74, Math.min(132, p + drift + noise));
    y.push(Number(p.toFixed(2)));
  }
  return { y, t };
}

export function buildMediaGraph({ topic, videos, evidence, baseNodes }: {
  topic: string;
  videos: VideosResponse | null;
  evidence: EvidenceItem[];
  baseNodes: GraphNode[];
}): { mediaNodes: GraphNode[]; mediaEdges: GraphEdge[] } {
  const items = videos?.items || [];
  if (!items.length || !evidence.length) return { mediaNodes: [], mediaEdges: [] };
  const assetId =
    baseNodes.find((n) => n.type === 'asset')?.id ||
    `n_${topic.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'asset'}`;
  const mediaNodes: GraphNode[] = [];
  const mediaEdges: GraphEdge[] = [];
  for (const v of items.slice(0, 8)) {
    const nodeId = `n_media_${String(v.id || '').slice(0, 20)}`;
    mediaNodes.push({
      id: nodeId,
      type: 'media',
      label: v.title.slice(0, 42),
      meta: { provider: 'youtube', kind: 'video', url: v.url },
    });
    const ranked = evidence
      .map((ev) => ({
        ev,
        score: Math.max(overlapScore(v.title, ev.title), overlapScore(v.title, ev.excerpt || ''), overlapScore(v.channel, ev.source)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    const linkedEvidence = ranked.filter((r) => r.score > 0).map((r) => r.ev.id);
    const fallbackEvidence = evidence[0]?.id ? [evidence[0].id] : [];
    const eids = linkedEvidence.length ? linkedEvidence : fallbackEvidence;
    mediaEdges.push({
      id: `e_media_${String(v.id || '').slice(0, 20)}_asset`,
      from: nodeId,
      to: assetId,
      type: 'same_story',
      confidence: linkedEvidence.length ? 0.44 : 0.2,
      evidenceIds: eids,
      rationale: linkedEvidence.length ? 'Video headline overlaps with evidence headlines.' : 'Related market video captured for this run.',
    });
  }
  return { mediaNodes, mediaEdges };
}

export function uniqueTagsFromSession(session: Session | null): string[] {
  if (!session) return [];
  const tags = new Set<string>();
  for (const t of session.tape || []) {
    for (const raw of t.tags || []) {
      const v = String(raw || '').trim();
      if (v) tags.add(v);
    }
  }
  for (const e of session.evidence || []) {
    for (const raw of e.aiSummary?.catalysts || []) {
      const v = String(raw || '').trim();
      if (v) tags.add(v);
    }
  }
  return Array.from(tags).slice(0, 22);
}

export function mergeTraceResponse(base: TraceResponse | null, page: TraceResponse): TraceResponse {
  if (!base || base.session.id !== page.session.id) return page;
  const seen = new Set<number>();
  const mergedEvents = [...base.events, ...page.events].filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
  return {
    session: page.session,
    events: mergedEvents,
    pageInfo: page.pageInfo,
  };
}

export function appendUsageEvent(summary: UsageSummary, payload: Record<string, unknown>): UsageSummary {
  const tag = String(payload.tag || 'ai');
  const model = typeof payload.model === 'string' ? payload.model : null;
  const tokens = Math.max(0, Math.round(typeof payload.total_tokens === 'number' ? payload.total_tokens : Number(payload.total_tokens || 0)));

  const byTag = [...summary.byTag];
  const byTagIndex = byTag.findIndex((entry) => entry.tag === tag);
  if (byTagIndex >= 0) {
    byTag[byTagIndex] = {
      ...byTag[byTagIndex],
      totalTokens: byTag[byTagIndex].totalTokens + tokens,
      events: byTag[byTagIndex].events + 1,
      model: model || byTag[byTagIndex].model,
    };
  } else {
    byTag.push({ tag, totalTokens: tokens, events: 1, model });
  }

  const byModel = [...summary.byModel];
  if (model) {
    const byModelIndex = byModel.findIndex((entry) => entry.model === model);
    if (byModelIndex >= 0) {
      byModel[byModelIndex] = {
        ...byModel[byModelIndex],
        totalTokens: byModel[byModelIndex].totalTokens + tokens,
        events: byModel[byModelIndex].events + 1,
      };
    } else {
      byModel.push({ model, totalTokens: tokens, events: 1 });
    }
  }

  return {
    totalTokens: summary.totalTokens + tokens,
    events: summary.events + 1,
    latestModel: model || summary.latestModel,
    byTag: byTag.sort((a, b) => b.totalTokens - a.totalTokens || a.tag.localeCompare(b.tag)),
    byModel: byModel.sort((a, b) => b.totalTokens - a.totalTokens || a.model.localeCompare(b.model)),
  };
}

export function applyQueryQueueCompletion(prev: QueryQueueItem[], query: string, added?: number, foundTotal?: number) {
  if (!prev.length) return prev;
  const next = [...prev];
  const idx = next.findIndex((it) => it.query === query);
  if (idx >= 0) next[idx] = { ...next[idx], state: 'done', added, foundTotal };
  const runningIdx = next.findIndex((it) => it.state === 'running');
  if (runningIdx >= 0 && next[runningIdx]?.query !== query) {
    next[runningIdx] = { ...next[runningIdx], state: 'done' };
  }
  const nextIdx = next.findIndex((it) => it.state === 'queued');
  if (nextIdx >= 0) next[nextIdx] = { ...next[nextIdx], state: 'running' };
  return next;
}
