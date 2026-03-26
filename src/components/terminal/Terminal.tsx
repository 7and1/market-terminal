'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { cn, apiPath } from '@/lib/utils';
import { PipelineTimeline, type PipelineStep } from '@/components/terminal/PipelineTimeline';
import type { EvidenceView } from '@/components/terminal/EvidenceViewToggle';
import type { GraphEdge, GraphNode } from '@/components/terminal/types';
import { TerminalHeader } from '@/components/terminal/TerminalHeader';
import { TerminalSearchBar } from '@/components/terminal/TerminalSearchBar';
import { WorkspacePanel } from '@/components/terminal/WorkspacePanel';
import { ChatPanel } from '@/components/terminal/ChatPanel';
import { EvidenceDrawer, TraceDrawer, FullscreenModal } from '@/components/terminal/EvidenceModal';
import { InsightPanels, type InsightPanelKey } from '@/components/terminal/InsightPanels';
import { buildMediaGraph, isUuid, normalizeTopicKey, now, uniqueTagsFromSession } from '@/components/terminal/helpers';
import { useTerminalChatContext } from '@/components/terminal/hooks/useTerminalChatContext';
import { useTerminalReplay } from '@/components/terminal/hooks/useTerminalReplay';
import { useTerminalRun } from '@/components/terminal/hooks/useTerminalRun';
import { useTerminalSharedState } from '@/components/terminal/hooks/useTerminalSharedState';
import type { PriceResponse, VideosResponse } from '@/components/terminal/model';
import type { EvidenceItem } from '@/lib/types';

const STEP_LABEL: Record<PipelineStep, string> = {
  idle: 'Waiting',
  plan: 'Planning',
  search: 'Searching',
  scrape: 'Scraping',
  extract: 'Extracting',
  link: 'Linking',
  cluster: 'Clustering',
  render: 'Rendering',
  ready: 'Ready',
};

const TOPIC_TYPED_EXAMPLES = [
  'Why is BTC down today? Map catalysts in the last 6 hours.',
  'NVDA move after earnings: what are the strongest evidence links?',
  'Oil, DXY, and rates: what changed since market open?',
  'Gold vs Bitcoin today: which macro drivers explain the divergence?',
  'Which Fed, tariff, or policy headlines are moving semis right now?',
] as const;

export function Terminal() {
  const searchParams = useSearchParams();
  const store = useTerminalSharedState();
  const {
    topic,
    setTopic,
    terminalMode,
    session,
    plan,
    search,
    warnings,
    runMeta,
    mode,
    setMode,
    traceLoading,
    traceError,
    trace,
    tracePage,
    traceLoadingMore,
    usageSummary,
    perfSummary,
    snapshotMode,
    snapshotLoading,
    publishedReport,
    timelineItems,
    appendTimeline,
    videos,
    setVideos,
    price,
    setPrice,
    chatInput,
    setChatInput,
    chatMode,
    setChatMode,
    messages,
    priceScaleMode,
    setPriceScaleMode,
  } = store;

  const [typedTopicHint, setTypedTopicHint] = useState('');
  const [traceOpen, setTraceOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [activeInsightPanel, setActiveInsightPanel] = useState<InsightPanelKey>('sources');

  const [debugBrowserLogs, setDebugBrowserLogs] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [flowFocusNodeId, setFlowFocusNodeId] = useState<string | null>(null);
  const [flowFocusEdgeId, setFlowFocusEdgeId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('Inspector');
  const [drawerNote, setDrawerNote] = useState<string | null>(null);
  const [drawerEvidence, setDrawerEvidence] = useState<EvidenceItem[]>([]);

  const [videosLoading, setVideosLoading] = useState(false);
  const videosInFlightRef = useRef(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [videoAutoPoll, setVideoAutoPoll] = useState(false);
  const insightPanelSessionRef = useRef<string | null>(null);

  const [priceLoading, setPriceLoading] = useState(false);
  const priceInFlightRef = useRef(false);
  const [priceCompareTopic, setPriceCompareTopic] = useState<string | null>(null);
  const [priceCompare, setPriceCompare] = useState<PriceResponse | null>(null);
  const [priceCompareLoading, setPriceCompareLoading] = useState(false);
  const priceCompareSeqRef = useRef(0);

  const [evidenceView, setEvidenceView] = useState<EvidenceView>('graph');
  const [graphFullscreen, setGraphFullscreen] = useState(false);
  const [graphFitSignal, setGraphFitSignal] = useState(0);
  const autoRunTopicRef = useRef<string | null>(null);

  const queryTopic = useMemo(() => {
    const raw = searchParams.get('q') || searchParams.get('topic') || '';
    return raw.trim();
  }, [searchParams]);
  const queryRunAt = useMemo(() => searchParams.get('runAt') || '', [searchParams]);
  const autoRunKey = useMemo(() => `${queryTopic}::${queryRunAt}`, [queryRunAt, queryTopic]);

  const replaceUrlWithSessionId = useCallback((sessionId: string) => {
    if (typeof window === 'undefined') return;
    if (!isUuid(sessionId)) return;
    const params = new URLSearchParams(window.location.search);
    const sameSession = params.get('sessionId') === sessionId;
    const hasAutoRunParams = params.has('q') || params.has('topic') || params.has('runAt');
    if (sameSession && !hasAutoRunParams) return;
    params.set('sessionId', sessionId);
    params.delete('q');
    params.delete('topic');
    params.delete('runAt');
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, []);

  const resetInteractiveView = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setFlowFocusNodeId(null);
    setFlowFocusEdgeId(null);
    setDrawerOpen(false);
    setDrawerEvidence([]);
    setDrawerTitle('Inspector');
    setDrawerNote(null);
    setGraphFullscreen(false);
    setChatPanelOpen(true);
    setTraceOpen(false);
    setSelectedTag(null);
    setActiveVideoId(null);
    setVideosLoading(false);
    setPriceLoading(false);
    setPriceCompareTopic(null);
    setPriceCompare(null);
    setPriceCompareLoading(false);
    setGraphFitSignal((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!copiedKey) return;
    const timer = window.setTimeout(() => setCopiedKey(null), 1200);
    return () => window.clearTimeout(timer);
  }, [copiedKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setDebugBrowserLogs(params.get('debug') === '1');
  }, []);

  useEffect(() => {
    if (topic.trim()) {
      setTypedTopicHint('');
      return;
    }
    let stopped = false;
    let timer: number | null = null;
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const schedule = (ms: number) => {
      timer = window.setTimeout(tick, ms);
    };

    const tick = () => {
      if (stopped) return;
      const phrase = TOPIC_TYPED_EXAMPLES[phraseIndex % TOPIC_TYPED_EXAMPLES.length];
      if (!deleting) {
        charIndex = Math.min(phrase.length, charIndex + 1);
        setTypedTopicHint(phrase.slice(0, charIndex));
        if (charIndex === phrase.length) {
          deleting = true;
          schedule(1200);
          return;
        }
        schedule(30);
        return;
      }
      charIndex = Math.max(0, charIndex - 1);
      setTypedTopicHint(phrase.slice(0, charIndex));
      if (charIndex === 0) {
        deleting = false;
        phraseIndex += 1;
        schedule(240);
        return;
      }
      schedule(18);
    };

    schedule(300);
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [topic]);

  const evidenceById = useMemo(() => {
    const map = new Map<string, EvidenceItem>();
    (session?.evidence ?? []).forEach((item) => map.set(item.id, item));
    return map;
  }, [session?.evidence]);

  const tapeTagsByEvidenceId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of session?.tape ?? []) {
      const key = String(item.evidenceId || '');
      if (!key) continue;
      const prev = map.get(key) || [];
      prev.push(...(item.tags || []));
      map.set(key, prev);
    }
    for (const [key, value] of map.entries()) {
      map.set(
        key,
        Array.from(new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))).slice(0, 8),
      );
    }
    return map;
  }, [session?.tape]);

  const sourceStats = useMemo(() => {
    const map = new Map<string, { source: string; count: number; latestAt: number; latestKind: EvidenceItem['timeKind'] }>();
    for (const evidence of session?.evidence ?? []) {
      const key = String(evidence.source || 'unknown');
      const prev = map.get(key);
      const ts = typeof evidence.publishedAt === 'number' ? evidence.publishedAt : 0;
      const kind = evidence.timeKind;
      if (!prev) {
        map.set(key, { source: key, count: 1, latestAt: ts, latestKind: kind });
      } else {
        prev.count += 1;
        if (ts > prev.latestAt) {
          prev.latestAt = ts;
          prev.latestKind = kind;
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.latestAt - a.latestAt);
  }, [session?.evidence]);

  const tapeStats = useMemo(() => {
    const tape = session?.tape ?? [];
    const uniqueSources = new Set<string>();
    for (const item of tape) {
      if (item?.source) uniqueSources.add(String(item.source));
    }
    return {
      headlineCount: tape.length,
      uniqueSourceCount: uniqueSources.size,
      evidenceCount: session?.evidence?.length ?? 0,
    };
  }, [session?.evidence, session?.tape]);

  const narrativeStats = useMemo(() => {
    const clusters = session?.clusters ?? [];
    const counts = { rising: 0, steady: 0, fading: 0 };
    for (const cluster of clusters) counts[cluster.momentum] += 1;
    return { count: clusters.length, ...counts };
  }, [session?.clusters]);

  const openEvidence = useCallback(
    (title: string, evidenceIds: string[], note?: string | null) => {
      const items = evidenceIds.map((id) => evidenceById.get(id)).filter((item): item is EvidenceItem => Boolean(item));
      setDrawerTitle(title);
      setDrawerNote(note ? note : null);
      setDrawerEvidence(items);
      if (!graphFullscreen) setDrawerOpen(true);
    },
    [evidenceById, graphFullscreen],
  );

  const run = useTerminalRun({
    store,
    debugBrowserLogs,
    replaceUrlWithSessionId,
    resetInteractiveView,
  });
  const {
    running,
    publishing,
    queryQueue,
    scrapeQueue,
    summariesCount,
    graphVariant,
    start,
    rerun,
    handlePublish,
    stopActiveRun,
    runInFlightRef,
  } = run;

  const replay = useTerminalReplay({
    store,
    traceOpen,
    queryTopic,
    setChatPanelOpen,
    resetInteractiveView,
    stopActiveRun,
  });

  const {
    referenceContext,
    mentionState,
    showChatSuggestions,
    runChat,
    askWithContext,
    renderMessageContent,
  } = useTerminalChatContext({
    store,
    tapeTagsByEvidenceId,
    selectedNodeId,
    selectedEdgeId,
    selectedTag,
    drawerEvidence,
    openEvidence,
    setSelectedNodeId,
    setSelectedEdgeId,
    setSelectedTag,
    start,
    running,
    snapshotReadOnly: replay.snapshotReadOnly,
  });

  const persistSnapshot = useCallback(
    async ({ price, videos }: { price?: PriceResponse; videos?: VideosResponse }) => {
      const sessionId = session?.id;
      if (replay.snapshotReadOnly) return;
      if (!sessionId || !isUuid(sessionId)) return;
      if (!price && !videos) return;
      try {
        await fetch(apiPath('/api/sessions/snapshot'), {
          method: 'POST',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId, ...(price ? { price } : null), ...(videos ? { videos } : null) }),
        });
      } catch {
        // best effort persistence
      }
    },
    [replay.snapshotReadOnly, session?.id],
  );

  const fetchVideos = useCallback(
    async (query: string) => {
      const cleaned = query.trim();
      if (!cleaned) return;
      if (videosInFlightRef.current) return;
      videosInFlightRef.current = true;
      setVideosLoading(true);
      try {
        const res = await fetch(apiPath(`/api/videos?topic=${encodeURIComponent(cleaned)}&limit=6`), { cache: 'no-store' });
        const data = (await res.json()) as VideosResponse;
        setVideos(data);
        store.setSession((prev) => (prev ? { ...prev, videosSnapshot: data } : prev));
        await persistSnapshot({ videos: data });
        appendTimeline({
          id: `tl_media_${data.fetchedAt}`,
          ts: data.fetchedAt,
          kind: 'media',
          title: `Video snapshot (${data.mode})`,
          subtitle: `${data.items.length} items`,
          tags: ['media', data.mode],
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Video fetch failed';
        setVideos({ topic: cleaned, fetchedAt: now(), mode: 'mock', items: [], error: message });
      } finally {
        videosInFlightRef.current = false;
        setVideosLoading(false);
      }
    },
    [appendTimeline, persistSnapshot, setVideos, store],
  );

  const fetchPriceData = useCallback(async (query: string): Promise<PriceResponse> => {
    const cleaned = query.trim();
    if (!cleaned) {
      return { ok: false, topic: '', provider: 'error', fetchedAt: now(), series: [], timestamps: [], error: 'Missing topic' };
    }
    try {
      const res = await fetch(apiPath(`/api/price?topic=${encodeURIComponent(cleaned)}`), { cache: 'no-store' });
      const raw = (await res.json().catch(() => ({}))) as Partial<PriceResponse>;
      const series = Array.isArray(raw.series)
        ? raw.series.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
        : [];
      const timestamps = Array.isArray(raw.timestamps)
        ? raw.timestamps.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
        : [];
      return {
        ok: Boolean(raw.ok),
        topic: typeof raw.topic === 'string' ? raw.topic : cleaned,
        symbol: typeof raw.symbol === 'string' ? raw.symbol : undefined,
        provider: typeof raw.provider === 'string' ? raw.provider : 'unknown',
        fetchedAt: typeof raw.fetchedAt === 'number' ? raw.fetchedAt : now(),
        series,
        timestamps,
        last: typeof raw.last === 'number' || raw.last === null ? raw.last : undefined,
        error: typeof raw.error === 'string' ? raw.error : undefined,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Price fetch failed';
      return { ok: false, topic: cleaned, provider: 'error', fetchedAt: now(), series: [], timestamps: [], error: message };
    }
  }, []);

  const fetchPrice = useCallback(
    async (query: string) => {
      const cleaned = query.trim();
      if (!cleaned) return;
      if (priceInFlightRef.current) return;
      priceInFlightRef.current = true;
      setPriceLoading(true);
      try {
        const data = await fetchPriceData(cleaned);
        setPrice(data);
        store.setSession((prev) => (prev ? { ...prev, priceSnapshot: data } : prev));
        await persistSnapshot({ price: data });
        appendTimeline({
          id: `tl_price_${data.fetchedAt}`,
          ts: data.fetchedAt,
          kind: 'price',
          title: `Price snapshot (${data.provider})`,
          subtitle: data.error ? data.error : `${data.series.length} points`,
          tags: ['price', data.provider, data.ok ? 'ok' : 'fallback'],
        });
        if (data.ok && data.series.length > 1 && data.series.length === data.timestamps.length) {
          store.setSession((prev) => (prev ? { ...prev, series: data.series, seriesTs: data.timestamps } : prev));
        }
      } finally {
        priceInFlightRef.current = false;
        setPriceLoading(false);
      }
    },
    [appendTimeline, fetchPriceData, persistSnapshot, setPrice, store],
  );

  const fetchComparePrice = useCallback(
    async (baseTopic: string, compareTopic: string) => {
      const base = baseTopic.trim();
      const compare = compareTopic.trim();
      if (!base || !compare || normalizeTopicKey(base) === normalizeTopicKey(compare)) {
        setPriceCompare(null);
        setPriceCompareLoading(false);
        return;
      }
      const seq = (priceCompareSeqRef.current += 1);
      setPriceCompareLoading(true);
      try {
        const data = await fetchPriceData(compare);
        if (seq !== priceCompareSeqRef.current) return;
        setPriceCompare(data);
      } finally {
        if (seq === priceCompareSeqRef.current) setPriceCompareLoading(false);
      }
    },
    [fetchPriceData],
  );

  useEffect(() => {
    if (replay.snapshotSessionId) return;
    if (!queryTopic) {
      autoRunTopicRef.current = null;
      return;
    }
    if (autoRunTopicRef.current === autoRunKey) return;
    if (running || runInFlightRef.current) return;
    autoRunTopicRef.current = autoRunKey;
    setTopic(queryTopic);
    void start(queryTopic).catch(() => undefined);
  }, [autoRunKey, queryTopic, replay.snapshotSessionId, runInFlightRef, running, setTopic, start]);

  useEffect(() => {
    if (!session) return;
    if (!selectedNodeId) return;
    const node = session.nodes.find((item) => item.id === selectedNodeId);
    if (!node) return;
    const edges = session.edges.filter((edge) => edge.from === node.id || edge.to === node.id);
    const ids = Array.from(new Set(edges.flatMap((edge) => edge.evidenceIds)));
    if (ids.length) openEvidence(`Node: ${node.label}`, ids);
  }, [openEvidence, selectedNodeId, session]);

  useEffect(() => {
    if (!session) return;
    if (!selectedEdgeId) return;
    const edge = session.edges.find((item) => item.id === selectedEdgeId);
    if (!edge) return;
    openEvidence(`Edge: ${edge.type.replace(/_/g, ' ')} (${Math.round(edge.confidence * 100)}%)`, edge.evidenceIds, edge.rationale || null);
  }, [openEvidence, selectedEdgeId, session]);

  useEffect(() => {
    if (replay.snapshotReadOnly) return;
    const sessionId = session?.id;
    const sessionTopic = session?.topic;
    if (!sessionId || !sessionTopic) {
      setVideos(null);
      setVideosLoading(false);
      setActiveVideoId(null);
      return;
    }
    void fetchVideos(sessionTopic);
  }, [fetchVideos, replay.snapshotReadOnly, session?.id, session?.topic, setVideos]);

  useEffect(() => {
    if (replay.snapshotReadOnly) return;
    const sessionId = session?.id;
    const sessionTopic = session?.topic;
    if (!sessionId || !sessionTopic) {
      setPrice(null);
      setPriceLoading(false);
      setPriceCompare(null);
      setPriceCompareLoading(false);
      priceCompareSeqRef.current += 1;
      return;
    }
    void fetchPrice(sessionTopic);
  }, [fetchPrice, replay.snapshotReadOnly, session?.id, session?.topic, setPrice]);

  useEffect(() => {
    if (replay.snapshotReadOnly) return;
    const sessionTopic = session?.topic;
    const compareTopic = priceCompareTopic;
    if (!sessionTopic || !compareTopic) {
      setPriceCompare(null);
      setPriceCompareLoading(false);
      priceCompareSeqRef.current += 1;
      return;
    }
    if (normalizeTopicKey(sessionTopic) === normalizeTopicKey(compareTopic)) {
      setPriceCompare(null);
      setPriceCompareLoading(false);
      priceCompareSeqRef.current += 1;
      return;
    }
    void fetchComparePrice(sessionTopic, compareTopic);
  }, [fetchComparePrice, priceCompareTopic, replay.snapshotReadOnly, session?.id, session?.topic]);

  useEffect(() => {
    if (replay.snapshotReadOnly) return;
    if (!videoAutoPoll) return;
    const sessionTopic = session?.topic;
    if (!sessionTopic) return;
    const poll = window.setInterval(() => {
      void fetchVideos(sessionTopic);
    }, 5 * 60_000);
    return () => window.clearInterval(poll);
  }, [fetchVideos, replay.snapshotReadOnly, session?.topic, videoAutoPoll]);

  useEffect(() => {
    if (!videos?.items?.length) {
      setActiveVideoId(null);
      return;
    }
    setActiveVideoId((prev) => (prev && videos.items.some((item) => item.id === prev) ? prev : videos.items[0].id));
  }, [videos?.fetchedAt, videos?.items, videos?.topic]);

  const isEmpty = session === null;
  const stepLabel = session ? STEP_LABEL[session.step] : STEP_LABEL.idle;
  const progress = session?.progress ?? 0;
  const tagOptions = useMemo(() => uniqueTagsFromSession(session), [session]);

  const workspaceGraph = useMemo(() => {
    if (!session) return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] };
    const baseNodes = session.nodes || [];
    const baseEdges = session.edges || [];
    const { mediaNodes, mediaEdges } = buildMediaGraph({
      topic: session.topic,
      videos: videos || session.videosSnapshot || null,
      evidence: session.evidence || [],
      baseNodes,
    });
    const allNodes = [...baseNodes, ...mediaNodes];
    const allEdges = [...baseEdges, ...mediaEdges];
    if (!selectedTag) return { nodes: allNodes, edges: allEdges };

    const matchEvidenceIds = new Set<string>();
    for (const evidence of session.evidence || []) {
      const tags = [
        ...(tapeTagsByEvidenceId.get(evidence.id) || []),
        ...(evidence.aiSummary?.catalysts || []),
        ...(evidence.aiSummary?.entities || []),
      ];
      if (tags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase())) {
        matchEvidenceIds.add(evidence.id);
      }
    }
    const keptEdges = allEdges.filter((edge) => edge.evidenceIds.some((id) => matchEvidenceIds.has(id)));
    const keepNodeIds = new Set<string>();
    for (const edge of keptEdges) {
      keepNodeIds.add(edge.from);
      keepNodeIds.add(edge.to);
    }
    const keptNodes = allNodes.filter((node) => keepNodeIds.has(node.id));
    return { nodes: keptNodes, edges: keptEdges };
  }, [selectedTag, session, tapeTagsByEvidenceId, videos]);

  const hasWorkspaceGraph = workspaceGraph.nodes.length > 0;

  const timelineData = useMemo(() => {
    const out = timelineItems.filter((item) => item.kind !== 'step');
    const mediaNodeIds = new Set((workspaceGraph.nodes || []).filter((node) => node.type === 'media').map((node) => node.id));
    const mediaFocusNodeId = mediaNodeIds.values().next().value || null;
    const mediaEvidenceIds = Array.from(
      new Set(
        (workspaceGraph.edges || [])
          .filter((edge) => mediaNodeIds.has(edge.from) || mediaNodeIds.has(edge.to))
          .flatMap((edge) => edge.evidenceIds || []),
      ),
    ).slice(0, 8);

    if (price?.fetchedAt) {
      out.push({
        id: `tl_price_live_${price.fetchedAt}`,
        ts: price.fetchedAt,
        kind: 'price',
        title: `Price snapshot (${price.provider})`,
        subtitle: price.error || `${price.series.length} points`,
        tags: ['price', price.provider, price.ok ? 'ok' : 'fallback'],
      });
    }
    if (videos?.fetchedAt) {
      out.push({
        id: `tl_videos_live_${videos.fetchedAt}`,
        ts: videos.fetchedAt,
        kind: 'media',
        title: `Video snapshot (${videos.mode})`,
        subtitle: `${videos.items.length} items`,
        tags: ['media', videos.mode],
        nodeId: mediaFocusNodeId || undefined,
        evidenceIds: mediaEvidenceIds.length ? mediaEvidenceIds : undefined,
      });
    }
    return out;
  }, [price, timelineItems, videos, workspaceGraph.edges, workspaceGraph.nodes]);

  useEffect(() => {
    const sessionId = session?.id || null;
    if (!sessionId) return;
    if (insightPanelSessionRef.current === sessionId) return;
    insightPanelSessionRef.current = sessionId;

    if (terminalMode === 'replay') {
      setActiveInsightPanel((session?.clusters?.length ?? 0) > 0 ? 'narratives' : 'tape');
      return;
    }

    if ((session?.evidence?.length ?? 0) === 0 && price) {
      setActiveInsightPanel('price');
      return;
    }

    setActiveInsightPanel('tape');
  }, [price, session?.clusters?.length, session?.evidence?.length, session?.id, terminalMode]);

  const handleInsightPanelChange = useCallback((key: InsightPanelKey) => {
    setActiveInsightPanel(key);
  }, []);

  return (
    <div className="min-h-screen">
      <div className="bg-terminal fixed inset-0 -z-10" />

      <TerminalHeader
        step={session?.step ?? 'idle'}
        progress={progress}
        running={running}
        session={session}
        publishing={publishing}
        publishedReport={publishedReport}
        snapshotMode={snapshotMode}
        terminalMode={terminalMode}
        warnings={warnings}
        onRerun={rerun}
        onPublish={handlePublish}
        searchBarContent={
          <TerminalSearchBar
            topic={topic}
            typedTopicHint={typedTopicHint}
            mode={mode}
            running={running}
            onTopicChange={setTopic}
            onModeChange={setMode}
            onSubmit={() => void start(topic).catch(() => undefined)}
          />
        }
        pipelineContent={
          <PipelineTimeline
            step={session?.step ?? 'idle'}
            progress={progress}
            mode={runMeta?.mode ?? mode}
            provider={runMeta?.provider}
            plan={plan}
            search={search}
            evidenceSources={(session?.evidence ?? []).map((item) => item.source)}
            evidenceCount={session?.evidence.length ?? 0}
            nodesCount={workspaceGraph.nodes.length}
            edgesCount={workspaceGraph.edges.length}
            clustersCount={session?.clusters.length ?? 0}
            warningsCount={warnings.length}
            onOpenTrace={() => setTraceOpen(true)}
            minimal
            className="mt-0 border-0 bg-transparent px-0 py-0"
          />
        }
      />

      <main className="mx-auto max-w-[1520px] px-4 pb-12">
        <div className={cn('grid gap-5', chatPanelOpen ? 'xl:grid-cols-[minmax(0,1fr)_400px]' : 'grid-cols-1')}>
          <div className="min-w-0 space-y-5">
            <WorkspacePanel
              isEmpty={isEmpty}
              session={session}
              evidenceView={evidenceView}
              hasWorkspaceGraph={hasWorkspaceGraph}
              workspaceGraph={workspaceGraph}
              timelineData={timelineData}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              flowFocusNodeId={flowFocusNodeId}
              flowFocusEdgeId={flowFocusEdgeId}
              selectedTag={selectedTag}
              tagOptions={tagOptions}
              graphFitSignal={graphFitSignal}
              graphFullscreen={graphFullscreen}
              chatPanelOpen={chatPanelOpen}
              snapshotLoading={snapshotLoading}
              stepLabel={stepLabel}
              onEvidenceViewChange={(view) => {
                setEvidenceView(view);
                if (view === 'graph') setGraphFitSignal((value) => value + 1);
              }}
              onSelectNode={setSelectedNodeId}
              onSelectEdge={setSelectedEdgeId}
              onFlowFocusNode={setFlowFocusNodeId}
              onFlowFocusEdge={setFlowFocusEdgeId}
              onInspectNode={(id) => {
                setSelectedNodeId(id);
                setSelectedEdgeId(null);
              }}
              onSelectTag={setSelectedTag}
              onGraphFullscreen={() => {
                setGraphFullscreen(true);
                setGraphFitSignal((value) => value + 1);
              }}
              onToggleChat={() => setChatPanelOpen((prev) => !prev)}
              onOpenEvidence={openEvidence}
            />

            <InsightPanels
              activePanel={activeInsightPanel}
              onActivePanelChange={handleInsightPanelChange}
              session={
                session
                  ? {
                      topic: session.topic,
                      series: session.series,
                      seriesTs: session.seriesTs,
                      tape: session.tape,
                      clusters: session.clusters,
                      evidence: session.evidence,
                    }
                  : null
              }
              isEmpty={isEmpty}
              sourceStats={sourceStats}
              tapeStats={tapeStats}
              narrativeStats={narrativeStats}
              price={price}
              priceLoading={priceLoading}
              priceScaleMode={priceScaleMode}
              priceCompareTopic={priceCompareTopic}
              priceCompare={priceCompare}
              priceCompareLoading={priceCompareLoading}
              videos={videos}
              videosLoading={videosLoading}
              videoAutoPoll={videoAutoPoll}
              activeVideoId={activeVideoId}
              onOpenEvidence={openEvidence}
              onRefreshPrice={() => {
                if (session) {
                  void fetchPrice(session.topic);
                  if (priceCompareTopic) void fetchComparePrice(session.topic, priceCompareTopic);
                }
              }}
              onRefreshMedia={() => {
                if (session) void fetchVideos(session.topic);
              }}
              onScaleModeChange={setPriceScaleMode}
              onCompareTopicChange={setPriceCompareTopic}
              onVideoAutoPollChange={setVideoAutoPoll}
              onActiveVideoChange={setActiveVideoId}
            />
          </div>

          {chatPanelOpen ? (
            <ChatPanel
              session={session}
              running={running}
              chatMode={chatMode}
              chatInput={chatInput}
              messages={messages}
              mentionState={mentionState}
              showChatSuggestions={showChatSuggestions}
              plan={plan}
              search={search}
              queryQueue={queryQueue}
              scrapeQueue={scrapeQueue}
              evidenceSources={(session?.evidence ?? []).map((item) => item.source)}
              evidenceCount={session?.evidence?.length ?? 0}
              summariesCount={summariesCount}
              nodesCount={workspaceGraph.nodes.length}
              edgesCount={workspaceGraph.edges.length}
              clustersCount={session?.clusters?.length ?? 0}
              warningsCount={warnings.length}
              graphVariant={graphVariant}
              terminalMode={terminalMode}
              usageSummary={usageSummary}
              perfSummary={perfSummary}
              referenceContext={referenceContext}
              traceLoadedCount={trace?.events.length ?? 0}
              traceHasMore={tracePage.hasMore}
              traceLoadingMore={traceLoadingMore}
              mode={mode}
              runMeta={runMeta}
              onChatModeChange={setChatMode}
              onChatInputChange={setChatInput}
              onClose={() => setChatPanelOpen(false)}
              onRunChat={runChat}
              onAskWithContext={(query) => void askWithContext(query)}
              onMentionSelect={(item) => setChatInput((prev) => prev.replace(/@([a-zA-Z0-9_-]*)$/, `@${item} `))}
              onOpenTrace={() => setTraceOpen(true)}
              onLoadMoreTrace={() => {
                if (session?.id) void replay.fetchTrace(session.id, { append: true });
              }}
              renderMessageContent={renderMessageContent}
            />
          ) : null}
        </div>
      </main>

      <EvidenceDrawer
        open={drawerOpen}
        title={drawerTitle}
        note={drawerNote}
        evidence={drawerEvidence}
        tapeTagsByEvidenceId={tapeTagsByEvidenceId}
        copiedKey={copiedKey}
        onClose={() => setDrawerOpen(false)}
        onCopy={setCopiedKey}
      />

      <TraceDrawer
        open={traceOpen}
        session={session}
        mode={mode}
        runMeta={runMeta}
        trace={trace}
        traceLoading={traceLoading}
        traceError={traceError}
        tracePage={tracePage}
        traceLoadingMore={traceLoadingMore}
        terminalMode={terminalMode}
        usageSummary={usageSummary}
        perfSummary={perfSummary}
        copiedKey={copiedKey}
        onClose={() => setTraceOpen(false)}
        onRefresh={() => {
          if (session) void replay.fetchTrace(session.id);
        }}
        onLoadMore={() => {
          if (session?.id) void replay.fetchTrace(session.id, { append: true });
        }}
        onCopy={setCopiedKey}
      />

      <FullscreenModal
        open={graphFullscreen}
        session={session}
        evidenceView={evidenceView}
        hasWorkspaceGraph={hasWorkspaceGraph}
        workspaceGraph={workspaceGraph}
        timelineData={timelineData}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        flowFocusNodeId={flowFocusNodeId}
        flowFocusEdgeId={flowFocusEdgeId}
        selectedTag={selectedTag}
        graphFitSignal={graphFitSignal}
        drawerTitle={drawerTitle}
        drawerEvidence={drawerEvidence}
        tapeTagsByEvidenceId={tapeTagsByEvidenceId}
        copiedKey={copiedKey}
        onClose={() => setGraphFullscreen(false)}
        onEvidenceViewChange={(view) => {
          setEvidenceView(view);
          if (view === 'graph') setGraphFitSignal((value) => value + 1);
        }}
        onSelectNode={setSelectedNodeId}
        onSelectEdge={setSelectedEdgeId}
        onFlowFocusNode={setFlowFocusNodeId}
        onFlowFocusEdge={setFlowFocusEdgeId}
        onSelectTag={setSelectedTag}
        onGraphFit={() => setGraphFitSignal((value) => value + 1)}
        onAskAI={() => {
          const ids = drawerEvidence.map((item) => item.id).filter(Boolean);
          void askWithContext(`Explain what this selection implies for ${session?.topic || topic}. What should I watch next?`, {
            focusEvidenceIds: ids,
          });
        }}
        onOpenEvidence={openEvidence}
        onCopy={setCopiedKey}
      />
    </div>
  );
}
