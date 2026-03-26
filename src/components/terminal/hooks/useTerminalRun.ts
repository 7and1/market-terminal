'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { QueryQueueItem, ScrapeQueueItem } from '@/components/terminal/ActivityCard';
import type { PipelineStep, SearchEvent } from '@/components/terminal/PipelineTimeline';
import {
  appendUsageEvent,
  applyQueryQueueCompletion,
  buildSeries,
  consumeSseStream,
  isUuid,
  now,
} from '@/components/terminal/helpers';
import type { GraphEdge, GraphNode } from '@/components/terminal/types';
import { createEmptyTracePage, createEmptyUsageSummary } from '@/components/terminal/terminal-state';
import type { TerminalSharedState } from '@/components/terminal/hooks/useTerminalSharedState';
import { apiPath } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { asRecord, normalizePerformanceSummary } from '@/lib/session-data';
import type { EvidenceItem, StoryCluster, TapeItem } from '@/lib/types';

async function buildRunErrorMessage(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) return `Run failed (${response.status})`;

  try {
    const payload = JSON.parse(text) as Record<string, unknown>;
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';
    const examples = Array.isArray(payload.supportedExamples)
      ? payload.supportedExamples
          .map((item) => String(item || '').trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];

    if (typeof payload.code === 'string' && payload.code === 'OFF_DOMAIN_QUERY') {
      return [
        message || 'This workspace only supports market research queries.',
        examples.length ? `Try: ${examples.join(' | ')}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (typeof payload.error === 'string' && payload.error.trim()) {
      return `Run failed (${response.status}): ${payload.error.trim()}`;
    }
  } catch {
    // Keep the raw text fallback for non-JSON errors.
  }

  return `Run failed (${response.status}): ${text}`;
}

export function useTerminalRun({
  store,
  debugBrowserLogs,
  replaceUrlWithSessionId,
  resetInteractiveView,
}: {
  store: TerminalSharedState;
  debugBrowserLogs: boolean;
  replaceUrlWithSessionId: (sessionId: string) => void;
  resetInteractiveView: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [queryQueue, setQueryQueue] = useState<QueryQueueItem[]>([]);
  const [scrapeQueue, setScrapeQueue] = useState<ScrapeQueueItem[]>([]);
  const [summariesCount, setSummariesCount] = useState(0);
  const [graphVariant, setGraphVariant] = useState<string | null>(null);

  const runAbortRef = useRef<AbortController | null>(null);
  const runInFlightRef = useRef(false);
  const latestSearchResultsRef = useRef<string[]>([]);
  const runSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      runInFlightRef.current = false;
      runAbortRef.current = null;
    };
  }, []);

  const start = useCallback(
    async (rawTopic: string, question?: string) => {
      const cleaned = rawTopic.trim() || 'Bitcoin';
      const cleanedQ = typeof question === 'string' ? question.trim() : '';

      runAbortRef.current?.abort();
      const abort = new AbortController();
      runAbortRef.current = abort;
      const runSeq = (runSeqRef.current += 1);
      runInFlightRef.current = true;

      store.setTerminalMode('live');
      setRunning(true);
      setLastQuestion(cleanedQ ? cleanedQ : null);
      store.setPlan(null);
      store.setSearch(null);
      store.setWarnings([]);
      store.setRunMeta({ mode: store.mode, provider: 'openrouter' });
      setQueryQueue([]);
      setScrapeQueue([]);
      setSummariesCount(0);
      setGraphVariant(null);
      latestSearchResultsRef.current = [];
      store.setTrace(null);
      store.setTraceError(null);
      store.setTracePage(createEmptyTracePage());
      store.setUsageSummary(createEmptyUsageSummary());
      store.setPerfSummary(null);
      store.setPublishedReport(null);
      resetInteractiveView();
      store.setSnapshotMode(false);
      store.setTimelineItems([]);
      store.setVideos(null);
      store.setPrice(null);
      store.setPriceScaleMode('price');

      const startedAtLocal = now();
      const localId = `local_${Math.random().toString(16).slice(2)}`;
      const { y, t } = buildSeries(startedAtLocal);

      store.setSession({
        id: localId,
        topic: cleaned,
        startedAt: startedAtLocal,
        step: 'plan',
        progress: 0.06,
        tape: [],
        clusters: [],
        nodes: [],
        edges: [],
        evidence: [],
        series: y,
        seriesTs: t,
      });

      try {
        const res = await fetch(apiPath('/api/run'), {
          method: 'POST',
          cache: 'no-store',
          signal: abort.signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            topic: cleaned,
            ...(cleanedQ ? { question: cleanedQ } : null),
            mode: store.mode,
            serpFormat: 'light',
          }),
        });

        if (!res.ok) {
          throw new Error(await buildRunErrorMessage(res));
        }

        trackEvent('pipeline_start', { topic: cleaned, mode: store.mode });

        await consumeSseStream({
          response: res,
          signal: abort.signal,
          onEvent: (event, data) => {
            if (abort.signal.aborted) return;
            if (runSeq !== runSeqRef.current) return;

            if (debugBrowserLogs) console.info('[signal-terminal]', event, data);

            if (event === 'session' && data && typeof data === 'object') {
              const d = asRecord(data);
              const serverMode: 'fast' | 'deep' = d.mode === 'deep' ? 'deep' : 'fast';
              const provider = typeof d.provider === 'string' ? d.provider : 'openrouter';
              const sessionId = typeof d.sessionId === 'string' ? d.sessionId : localId;
              const serverTopic = typeof d.topic === 'string' ? d.topic : cleaned;
              const serverStartedAt = typeof d.startedAt === 'number' ? d.startedAt : startedAtLocal;
              const series = buildSeries(serverStartedAt);
              store.setTerminalMode('live');
              store.setRunMeta({ mode: serverMode, provider });
              store.setTopic(serverTopic);
              setGraphVariant(null);
              setSummariesCount(0);
              store.setSession((prev) =>
                prev
                  ? { ...prev, id: sessionId, topic: serverTopic, startedAt: serverStartedAt, series: series.y, seriesTs: series.t }
                  : {
                      id: sessionId,
                      topic: serverTopic,
                      startedAt: serverStartedAt,
                      step: 'plan',
                      progress: 0.06,
                      tape: [],
                      clusters: [],
                      nodes: [],
                      edges: [],
                      evidence: [],
                      series: series.y,
                      seriesTs: series.t,
                    },
              );
              if (isUuid(sessionId)) replaceUrlWithSessionId(sessionId);
              return;
            }

            if (event === 'step' && data && typeof data === 'object') {
              const d = asRecord(data);
              const step = typeof d.step === 'string' ? d.step : '';
              const progress = typeof d.progress === 'number' ? d.progress : undefined;
              const isStep = (value: string): value is PipelineStep =>
                ['idle', 'plan', 'search', 'scrape', 'extract', 'link', 'cluster', 'render', 'ready'].includes(value);
              store.setSession((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  step: isStep(step) ? step : prev.step,
                  progress: typeof progress === 'number' ? Math.max(prev.progress, Math.min(1, progress)) : prev.progress,
                };
              });
              if (step === 'search') {
                setQueryQueue((prev) => {
                  if (!prev.length) return prev;
                  if (prev.some((item) => item.state === 'running')) return prev;
                  const next = [...prev];
                  const firstIdx = next.findIndex((item) => item.state === 'queued');
                  if (firstIdx >= 0) next[firstIdx] = { ...next[firstIdx], state: 'running' };
                  return next;
                });
              }
              if (step === 'scrape') {
                setScrapeQueue((prev) => {
                  if (prev.length) return prev;
                  return latestSearchResultsRef.current.slice(0, 4).filter(Boolean).map((url) => ({ url, state: 'queued' }));
                });
              }
              return;
            }

            if (event === 'plan' && data && typeof data === 'object') {
              const plan = data as NonNullable<typeof store.plan>;
              store.setPlan(plan);
              store.setSearch((prev) => prev || { queries: plan.queries || [], results: [] });
              const cap = store.mode === 'deep' ? 6 : 4;
              setQueryQueue(plan.queries.slice(0, cap).map((query) => ({ query, state: 'queued' })));
              return;
            }

            if (event === 'search.partial' && data && typeof data === 'object') {
              const d = asRecord(data);
              const picked = d.picked;
              if (!Array.isArray(picked)) return;
              latestSearchResultsRef.current = picked.map((row) => String(asRecord(row).url || '')).filter(Boolean).slice(0, 20);
              store.setSearch((prev) => ({ queries: prev?.queries?.length ? prev.queries : [], results: picked as SearchEvent['results'] }));
              const query = typeof d.query === 'string' ? d.query : '';
              const added = typeof d.added === 'number' ? d.added : undefined;
              const foundTotal = typeof d.found === 'number' ? d.found : undefined;
              if (query) setQueryQueue((prev) => applyQueryQueueCompletion(prev, query, added, foundTotal));
              return;
            }

            if (event === 'search' && data && typeof data === 'object') {
              try {
                const results = asRecord(data).results;
                if (Array.isArray(results)) {
                  latestSearchResultsRef.current = results.map((row) => String(asRecord(row).url || '')).filter(Boolean).slice(0, 20);
                }
              } catch {
                // ignore
              }
              store.setSearch(data as SearchEvent);
              setQueryQueue((prev) =>
                prev.map((item) => (item.state === 'queued' || item.state === 'running' ? { ...item, state: 'done' } : item)),
              );
              return;
            }

            if (event === 'scrape.page' && data && typeof data === 'object') {
              const d = asRecord(data);
              const url = typeof d.url === 'string' ? d.url : '';
              const status = typeof d.status === 'string' ? d.status : '';
              if (!url) return;
              setScrapeQueue((prev) => {
                const next = [...prev];
                const idx = next.findIndex((item) => item.url === url);
                const state =
                  status === 'start' ? 'running' : status === 'done' ? 'done' : status === 'fail' ? 'failed' : 'queued';
                if (idx >= 0) next[idx] = { ...next[idx], state };
                else next.push({ url, state });
                return next;
              });
              return;
            }

            if (event === 'evidence' && data && typeof data === 'object') {
              const items = asRecord(data).items;
              if (!Array.isArray(items)) return;
              store.setSession((prev) => (prev ? { ...prev, evidence: items as EvidenceItem[] } : prev));
              for (const evidence of (items as EvidenceItem[]).slice(0, 16)) {
                store.appendTimeline({
                  id: `tl_ev_${evidence.id}`,
                  ts: typeof evidence.publishedAt === 'number' ? evidence.publishedAt : now(),
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
              return;
            }

            if (event === 'summaries' && data && typeof data === 'object') {
              const items = asRecord(data).items;
              if (!Array.isArray(items)) return;
              setSummariesCount(items.length);
              const byId = new Map<string, Record<string, unknown>>();
              for (const item of items) {
                const summary = asRecord(item);
                const id = typeof summary.id === 'string' ? summary.id : '';
                if (!id) continue;
                byId.set(id, summary);
              }
              store.setSession((prev) => {
                if (!prev || !prev.evidence.length) return prev;
                const nextEvidence = prev.evidence.map((evidence) => {
                  const summary = byId.get(evidence.id);
                  if (!summary) return evidence;
                  return {
                    ...evidence,
                    aiSummary: {
                      bullets: Array.isArray(summary.bullets) ? summary.bullets.slice(0, 5) : [],
                      entities: Array.isArray(summary.entities) ? summary.entities.slice(0, 12) : undefined,
                      catalysts: Array.isArray(summary.catalysts) ? summary.catalysts.slice(0, 10) : undefined,
                      sentiment: typeof summary.sentiment === 'string' ? summary.sentiment : undefined,
                      confidence: typeof summary.confidence === 'number' ? summary.confidence : undefined,
                    },
                  } as EvidenceItem;
                });
                return { ...prev, evidence: nextEvidence };
              });
              return;
            }

            if (event === 'tape' && data && typeof data === 'object') {
              const items = asRecord(data).items;
              if (Array.isArray(items)) store.setSession((prev) => (prev ? { ...prev, tape: items as TapeItem[] } : prev));
              return;
            }

            if (event === 'graph' && data && typeof data === 'object') {
              const payload = asRecord(data);
              if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) return;
              store.setSession((prev) =>
                prev
                  ? {
                      ...prev,
                      nodes: payload.nodes as GraphNode[],
                      edges: payload.edges as GraphEdge[],
                      step: prev.step === 'extract' ? 'link' : prev.step,
                      progress: Math.max(prev.progress, 0.78),
                    }
                  : prev,
              );
              if (typeof payload.variant === 'string') setGraphVariant(payload.variant);
              return;
            }

            if (event === 'clusters' && data && typeof data === 'object') {
              const items = asRecord(data).items;
              if (!Array.isArray(items)) return;
              store.setSession((prev) =>
                prev
                  ? {
                      ...prev,
                      clusters: items as StoryCluster[],
                      step: prev.step === 'link' ? 'cluster' : prev.step,
                      progress: Math.max(prev.progress, 0.9),
                    }
                  : prev,
              );
              return;
            }

            if (event === 'ai.usage' && data && typeof data === 'object') {
              store.setUsageSummary((prev) => appendUsageEvent(prev, asRecord(data)));
              return;
            }

            if (event === 'perf.summary' && data && typeof data === 'object') {
              const nextPerf = normalizePerformanceSummary(data);
              if (nextPerf) store.setPerfSummary(nextPerf);
              return;
            }

            if (event === 'message' && data && typeof data === 'object') {
              const content = typeof asRecord(data).content === 'string' ? String(asRecord(data).content).trim() : '';
              if (!content) return;
              store.setMessages((prev) => [
                ...prev,
                { id: `m_${Math.random().toString(16).slice(2)}`, role: 'assistant', content, createdAt: now() },
              ]);
              return;
            }

            if (event === 'warn' && data && typeof data === 'object') {
              const payload = asRecord(data);
              const message = String(payload.message || 'Warning');
              store.setWarnings((prev) => [...prev, message]);
              store.appendTimeline({
                id: `tl_warn_${now()}`,
                ts: now(),
                kind: 'note',
                title: 'Warning',
                subtitle: message,
                tags: ['warn'],
              });
              const query = typeof payload.query === 'string' ? payload.query : '';
              if (query) {
                setQueryQueue((prev) => {
                  if (!prev.length) return prev;
                  const next = [...prev];
                  const idx = next.findIndex((item) => item.query === query);
                  if (idx >= 0) next[idx] = { ...next[idx], state: 'failed' };
                  const nextIdx = next.findIndex((item) => item.state === 'queued');
                  if (nextIdx >= 0 && !next.some((item) => item.state === 'running')) {
                    next[nextIdx] = { ...next[nextIdx], state: 'running' };
                  }
                  return next;
                });
              }
              return;
            }

            if (event === 'error' && data && typeof data === 'object') {
              const message = String(asRecord(data).message || 'Unknown error');
              store.setWarnings((prev) => [...prev, message]);
              store.setMessages((prev) => [
                ...prev,
                { id: `m_${Math.random().toString(16).slice(2)}`, role: 'assistant', content: `Error: ${message}`, createdAt: now() },
              ]);
              store.setSession((prev) => (prev ? { ...prev, step: 'ready', progress: 1 } : prev));
              store.appendTimeline({
                id: `tl_error_${now()}`,
                ts: now(),
                kind: 'note',
                title: 'Run error',
                subtitle: message,
                tags: ['error'],
              });
              return;
            }

            if (event === 'done') {
              store.setSession((prev) => (prev ? { ...prev, step: 'ready', progress: 1 } : prev));
              trackEvent('pipeline_complete', { topic: cleaned, mode: store.mode });
            }
          },
        });
      } catch (e) {
        if (abort.signal.aborted) return;
        if (runSeq !== runSeqRef.current) return;
        const message = e instanceof Error ? e.message : 'Run failed';
        store.setWarnings((prev) => [...prev, message]);
        store.setMessages((prev) => [
          ...prev,
          { id: `m_${Math.random().toString(16).slice(2)}`, role: 'assistant', content: `Error: ${message}`, createdAt: now() },
        ]);
        store.setSession((prev) => (prev ? { ...prev, step: 'ready', progress: 1 } : prev));
      } finally {
        if (runSeq === runSeqRef.current && !abort.signal.aborted) {
          runInFlightRef.current = false;
          setRunning(false);
        }
      }
    },
    [debugBrowserLogs, replaceUrlWithSessionId, resetInteractiveView, store],
  );

  const rerun = useCallback(() => {
    const nextTopic = store.session?.topic || store.topic;
    if (!nextTopic.trim()) return;
    void start(nextTopic, lastQuestion || undefined).catch(() => undefined);
  }, [lastQuestion, start, store.session?.topic, store.topic]);

  const stopActiveRun = useCallback(() => {
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    runInFlightRef.current = false;
    setRunning(false);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!store.session) return;
    setPublishing(true);
    try {
      const res = await fetch(apiPath('/api/sessions/publish'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: store.session.id }),
      });
      const data = asRecord(await res.json().catch(() => ({})));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Publish failed');
      const relativeUrl = typeof data.url === 'string' ? data.url : '';
      if (!relativeUrl) throw new Error('Missing published report url');
      const fullUrl = `${window.location.origin}${relativeUrl}`;
      store.setPublishedReport({
        fullUrl,
        relativeUrl,
        alreadyPublished: Boolean(data.alreadyPublished),
      });
      try {
        await navigator.clipboard.writeText(fullUrl);
      } catch {
        // ignore clipboard failures
      }
    } catch {
      // silent fail, keep prior behavior
    } finally {
      setPublishing(false);
    }
  }, [store]);

  return {
    running,
    publishing,
    lastQuestion,
    setLastQuestion,
    queryQueue,
    setQueryQueue,
    scrapeQueue,
    summariesCount,
    graphVariant,
    setGraphVariant,
    start,
    rerun,
    handlePublish,
    stopActiveRun,
    runAbortRef,
    runInFlightRef,
  };
}
