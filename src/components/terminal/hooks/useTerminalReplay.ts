'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

import type { PipelineStep } from '@/components/terminal/PipelineTimeline';
import { buildSeries, isUuid, now, mergeTraceResponse } from '@/components/terminal/helpers';
import { buildReplayTimeline, type SessionsListResponse } from '@/components/terminal/terminal-state';
import type { TerminalSharedState } from '@/components/terminal/hooks/useTerminalSharedState';
import type { SessionSnapshotArtifacts, SessionSnapshotMeta } from '@/components/terminal/model';
import { apiPath } from '@/lib/utils';
import {
  asSessionMeta,
  collectLatestPerformanceSummary,
  summarizeUsageEvents,
  tracePageStateFromResponse,
  type TraceResponse,
} from '@/lib/session-data';

const LAST_ACTIVE_SESSION_KEY = 'market_terminal:last_session_id';

export function useTerminalReplay({
  store,
  traceOpen,
  queryTopic,
  setChatPanelOpen,
  resetInteractiveView,
  stopActiveRun,
}: {
  store: TerminalSharedState;
  traceOpen: boolean;
  queryTopic: string;
  setChatPanelOpen: Dispatch<SetStateAction<boolean>>;
  resetInteractiveView: () => void;
  stopActiveRun: () => void;
}) {
  const searchParams = useSearchParams();
  const traceInFlightRef = useRef(false);
  const hydratedSnapshotIdRef = useRef<string | null>(null);
  const bootstrapTriedRef = useRef(false);

  const snapshotSessionId = useMemo(() => {
    const id = searchParams.get('sessionId') || '';
    return isUuid(id) ? id : null;
  }, [searchParams]);

  const snapshotOpening = Boolean(snapshotSessionId && store.session?.id !== snapshotSessionId);
  const snapshotReadOnly = store.snapshotMode || store.snapshotLoading || snapshotOpening;

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

  const fetchTracePage = useCallback(async ({ sessionId, cursor, limit = 200 }: {
    sessionId: string;
    cursor?: string | null;
    limit?: number;
  }): Promise<TraceResponse> => {
    const qs = new URLSearchParams({
      sessionId,
      limit: String(limit),
    });
    if (cursor) qs.set('cursor', cursor);
    const res = await fetch(apiPath(`/api/sessions/events?${qs.toString()}`), { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text ? `Trace fetch failed (${res.status}): ${text}` : `Trace fetch failed (${res.status})`);
    }
    return (await res.json()) as TraceResponse;
  }, []);

  const fetchTrace = useCallback(async (sessionId: string, opts?: { append?: boolean }) => {
    if (!isUuid(sessionId)) return;
    if (traceInFlightRef.current) return;
    traceInFlightRef.current = true;
    const append = Boolean(opts?.append);

    if (append) {
      store.setTraceLoadingMore(true);
      store.setTracePage((prev) => ({ ...prev, loading: true, error: null }));
    } else {
      store.setTraceLoading(true);
      store.setTraceError(null);
      store.setTracePage((prev) => ({ ...prev, loading: true, error: null }));
    }

    try {
      const cursor = append ? store.tracePage.nextCursor : null;
      const data = await fetchTracePage({ sessionId, cursor, limit: 200 });
      const nextTrace = append ? mergeTraceResponse(store.trace, data) : data;

      store.setTrace(nextTrace);
      store.setTraceError(null);
      store.setTracePage(tracePageStateFromResponse(data));
      store.setUsageSummary(summarizeUsageEvents(nextTrace.events));
      store.setPerfSummary(collectLatestPerformanceSummary(nextTrace));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Trace fetch failed';
      if (append) {
        store.setTracePage((prev) => ({ ...prev, loading: false, error: message }));
      } else {
        store.setTraceError(message);
        store.setTrace(null);
      }
    } finally {
      traceInFlightRef.current = false;
      store.setTraceLoading(false);
      store.setTraceLoadingMore(false);
      store.setTracePage((prev) => ({ ...prev, loading: false }));
    }
  }, [fetchTracePage, store]);

  const hydrateSnapshot = useCallback(async (sessionId: string) => {
    if (!isUuid(sessionId)) return;
    store.setSnapshotLoading(true);
    store.setSnapshotMode(true);
    store.setTerminalMode('replay');
    stopActiveRun();
    store.setTraceError(null);
    store.setPublishedReport(null);

    try {
      const data = await fetchTracePage({ sessionId, limit: 200 });
      store.setTrace(data);
      store.setTracePage(tracePageStateFromResponse(data));
      store.setUsageSummary(summarizeUsageEvents(data.events));
      store.setPerfSummary(collectLatestPerformanceSummary(data));

      const meta = (asSessionMeta(data.session.meta) as SessionSnapshotMeta) || {};
      const artifacts = (meta.artifacts || {}) as SessionSnapshotArtifacts;
      const topic = String(data.session.topic || '');
      const startedAt = Date.parse(data.session.created_at) || now();
      const savedPrice = artifacts.price || null;
      const savedVideos = artifacts.videos || null;
      const hasSavedSeries =
        Boolean(savedPrice?.series?.length) &&
        Boolean(savedPrice?.timestamps?.length) &&
        savedPrice?.series?.length === savedPrice?.timestamps?.length;
      const fallbackSeries = buildSeries(startedAt);

      store.setSession({
        id: data.session.id,
        topic,
        startedAt,
        step: (['idle', 'plan', 'search', 'scrape', 'extract', 'link', 'cluster', 'render', 'ready'].includes(data.session.step)
          ? data.session.step
          : 'ready') as PipelineStep,
        progress: typeof data.session.progress === 'number' ? data.session.progress : 1,
        tape: Array.isArray(artifacts.tape) ? artifacts.tape : [],
        clusters: Array.isArray(artifacts.clusters) ? artifacts.clusters : [],
        nodes: Array.isArray(artifacts.nodes) ? artifacts.nodes : [],
        edges: Array.isArray(artifacts.edges) ? artifacts.edges : [],
        evidence: Array.isArray(artifacts.evidence) ? artifacts.evidence : [],
        series: hasSavedSeries ? savedPrice!.series : fallbackSeries.y,
        seriesTs: hasSavedSeries ? savedPrice!.timestamps : fallbackSeries.t,
        videosSnapshot: savedVideos,
        priceSnapshot: savedPrice,
        snapshotMode: true,
      });

      store.setRunMeta({
        mode: meta.mode === 'deep' ? 'deep' : 'fast',
        provider: typeof meta.provider === 'string' ? meta.provider : 'openrouter',
      });
      store.setMode(meta.mode === 'deep' ? 'deep' : 'fast');
      store.setTopic(topic);
      store.setPlan(meta.plan || null);
      store.setSearch(null);
      store.setWarnings(
        data.events
          .filter((event) => event.type === 'warn')
          .map((event) => String((event.payload as Record<string, unknown>)?.message || 'Warning')),
      );
      store.setVideos(savedVideos || null);
      store.setPrice(savedPrice || null);
      store.setChatMode('explain');
      setChatPanelOpen(true);
      resetInteractiveView();
      store.setTimelineItems(
        buildReplayTimeline({
          events: data.events,
          artifacts,
          startedAt,
        }),
      );
      replaceUrlWithSessionId(data.session.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load snapshot';
      store.setTraceError(message);
      store.setSnapshotMode(false);
      store.setTerminalMode('draft');
    } finally {
      store.setSnapshotLoading(false);
    }
  }, [fetchTracePage, replaceUrlWithSessionId, resetInteractiveView, setChatPanelOpen, stopActiveRun, store]);

  const hydrateLatestSession = useCallback(async () => {
    if (bootstrapTriedRef.current) return;
    bootstrapTriedRef.current = true;
    try {
      const res = await fetch(apiPath('/api/sessions?limit=1'), { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as SessionsListResponse;
      const first = Array.isArray(data?.sessions) ? data.sessions[0] : null;
      const id = typeof first?.id === 'string' ? first.id : '';
      if (!isUuid(id)) return;
      if (hydratedSnapshotIdRef.current === id) return;
      hydratedSnapshotIdRef.current = id;
      await hydrateSnapshot(id);
    } catch {
      // best effort bootstrap
    }
  }, [hydrateSnapshot]);

  useEffect(() => {
    if (!traceOpen) return;
    const id = store.session?.id;
    if (!id || !isUuid(id)) return;
    if (store.trace?.session.id === id && store.trace.events.length > 0) return;
    void fetchTrace(id);
  }, [fetchTrace, store.session?.id, store.trace?.events.length, store.trace?.session.id, traceOpen]);

  useEffect(() => {
    if (!snapshotSessionId) {
      hydratedSnapshotIdRef.current = null;
      return;
    }
    if (hydratedSnapshotIdRef.current === snapshotSessionId) return;
    hydratedSnapshotIdRef.current = snapshotSessionId;
    void hydrateSnapshot(snapshotSessionId);
  }, [hydrateSnapshot, snapshotSessionId]);

  useEffect(() => {
    if (snapshotSessionId) return;
    if (queryTopic) return;
    if (store.session) return;
    if (store.snapshotLoading) return;
    if (typeof window === 'undefined') return;

    const stored = window.localStorage.getItem(LAST_ACTIVE_SESSION_KEY) || '';
    if (isUuid(stored)) {
      if (hydratedSnapshotIdRef.current === stored) return;
      hydratedSnapshotIdRef.current = stored;
      void hydrateSnapshot(stored);
      return;
    }

    void hydrateLatestSession();
  }, [hydrateLatestSession, hydrateSnapshot, queryTopic, snapshotSessionId, store.session, store.snapshotLoading]);

  useEffect(() => {
    const id = store.session?.id;
    if (!id || !isUuid(id)) return;
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LAST_ACTIVE_SESSION_KEY, id);
  }, [store.session?.id]);

  return {
    snapshotSessionId,
    snapshotOpening,
    snapshotReadOnly,
    replaceUrlWithSessionId,
    fetchTrace,
    hydrateSnapshot,
  };
}
