'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useReducer } from 'react';

import type { PlanEvent, SearchEvent } from '@/components/terminal/PipelineTimeline';
import type { PriceResponse, PriceScaleMode, Session, VideosResponse } from '@/components/terminal/model';
import { now } from '@/components/terminal/helpers';
import { type ChatMessage, type PublishedReportState } from '@/components/terminal/terminal-state';
import { createTerminalReducerState, terminalReducer, type TerminalReducerState, type TerminalSharedAction } from '@/components/terminal/terminal-reducer';
import type {
  PerformanceSummary,
  TerminalMode,
  TracePageState,
  TraceResponse,
  UsageSummary,
} from '@/lib/session-data';

export type TerminalSharedState = {
  state: TerminalReducerState;
  dispatch: Dispatch<TerminalSharedAction>;
  topic: string;
  setTopic: Dispatch<SetStateAction<string>>;
  terminalMode: TerminalMode;
  setTerminalMode: Dispatch<SetStateAction<TerminalMode>>;
  session: Session | null;
  setSession: Dispatch<SetStateAction<Session | null>>;
  plan: PlanEvent | null;
  setPlan: Dispatch<SetStateAction<PlanEvent | null>>;
  search: SearchEvent | null;
  setSearch: Dispatch<SetStateAction<SearchEvent | null>>;
  warnings: string[];
  setWarnings: Dispatch<SetStateAction<string[]>>;
  runMeta: { mode: 'fast' | 'deep'; provider: string } | null;
  setRunMeta: Dispatch<SetStateAction<{ mode: 'fast' | 'deep'; provider: string } | null>>;
  mode: 'fast' | 'deep';
  setMode: Dispatch<SetStateAction<'fast' | 'deep'>>;
  traceLoading: boolean;
  setTraceLoading: Dispatch<SetStateAction<boolean>>;
  traceError: string | null;
  setTraceError: Dispatch<SetStateAction<string | null>>;
  trace: TraceResponse | null;
  setTrace: Dispatch<SetStateAction<TraceResponse | null>>;
  tracePage: TracePageState;
  setTracePage: Dispatch<SetStateAction<TracePageState>>;
  traceLoadingMore: boolean;
  setTraceLoadingMore: Dispatch<SetStateAction<boolean>>;
  usageSummary: UsageSummary;
  setUsageSummary: Dispatch<SetStateAction<UsageSummary>>;
  perfSummary: PerformanceSummary | null;
  setPerfSummary: Dispatch<SetStateAction<PerformanceSummary | null>>;
  snapshotMode: boolean;
  setSnapshotMode: Dispatch<SetStateAction<boolean>>;
  snapshotLoading: boolean;
  setSnapshotLoading: Dispatch<SetStateAction<boolean>>;
  publishedReport: PublishedReportState | null;
  setPublishedReport: Dispatch<SetStateAction<PublishedReportState | null>>;
  timelineItems: import('@/components/terminal/EvidenceTimeline').TimelineItem[];
  setTimelineItems: Dispatch<SetStateAction<import('@/components/terminal/EvidenceTimeline').TimelineItem[]>>;
  appendTimeline: (item: import('@/components/terminal/EvidenceTimeline').TimelineItem) => void;
  videos: VideosResponse | null;
  setVideos: Dispatch<SetStateAction<VideosResponse | null>>;
  price: PriceResponse | null;
  setPrice: Dispatch<SetStateAction<PriceResponse | null>>;
  chatInput: string;
  setChatInput: Dispatch<SetStateAction<string>>;
  chatMode: 'fetch' | 'explain';
  setChatMode: Dispatch<SetStateAction<'fetch' | 'explain'>>;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  priceScaleMode: PriceScaleMode;
  setPriceScaleMode: Dispatch<SetStateAction<PriceScaleMode>>;
};

export function useTerminalSharedState(): TerminalSharedState {
  const [state, dispatch] = useReducer(terminalReducer, undefined, () => createTerminalReducerState(now));

  const createSetter = useCallback(
    <K extends keyof TerminalReducerState>(key: K) =>
      (value: SetStateAction<TerminalReducerState[K]>) => {
        if (typeof value === 'function') {
          dispatch({
            type: 'field/update',
            key,
            updater: value as unknown as (prev: unknown) => unknown,
          });
          return;
        }
        dispatch({
          type: 'field/set',
          key,
          value,
        });
      },
    [],
  );

  const setTopic = useMemo(() => createSetter('topic'), [createSetter]);
  const setTerminalMode = useMemo(() => createSetter('terminalMode'), [createSetter]);
  const setSession = useMemo(() => createSetter('session'), [createSetter]);
  const setPlan = useMemo(() => createSetter('plan'), [createSetter]);
  const setSearch = useMemo(() => createSetter('search'), [createSetter]);
  const setWarnings = useMemo(() => createSetter('warnings'), [createSetter]);
  const setRunMeta = useMemo(() => createSetter('runMeta'), [createSetter]);
  const setMode = useMemo(() => createSetter('mode'), [createSetter]);
  const setTraceLoading = useMemo(() => createSetter('traceLoading'), [createSetter]);
  const setTraceError = useMemo(() => createSetter('traceError'), [createSetter]);
  const setTrace = useMemo(() => createSetter('trace'), [createSetter]);
  const setTracePage = useMemo(() => createSetter('tracePage'), [createSetter]);
  const setTraceLoadingMore = useMemo(() => createSetter('traceLoadingMore'), [createSetter]);
  const setUsageSummary = useMemo(() => createSetter('usageSummary'), [createSetter]);
  const setPerfSummary = useMemo(() => createSetter('perfSummary'), [createSetter]);
  const setSnapshotMode = useMemo(() => createSetter('snapshotMode'), [createSetter]);
  const setSnapshotLoading = useMemo(() => createSetter('snapshotLoading'), [createSetter]);
  const setPublishedReport = useMemo(() => createSetter('publishedReport'), [createSetter]);
  const setTimelineItems = useMemo(() => createSetter('timelineItems'), [createSetter]);
  const setVideos = useMemo(() => createSetter('videos'), [createSetter]);
  const setPrice = useMemo(() => createSetter('price'), [createSetter]);
  const setChatInput = useMemo(() => createSetter('chatInput'), [createSetter]);
  const setChatMode = useMemo(() => createSetter('chatMode'), [createSetter]);
  const setMessages = useMemo(() => createSetter('messages'), [createSetter]);
  const setPriceScaleMode = useMemo(() => createSetter('priceScaleMode'), [createSetter]);

  const appendTimeline = useCallback((item: import('@/components/terminal/EvidenceTimeline').TimelineItem) => {
    dispatch({
      type: 'timeline/append',
      item,
    });
  }, []);

  return {
    state,
    dispatch,
    topic: state.topic,
    setTopic,
    terminalMode: state.terminalMode,
    setTerminalMode,
    session: state.session,
    setSession,
    plan: state.plan,
    setPlan,
    search: state.search,
    setSearch,
    warnings: state.warnings,
    setWarnings,
    runMeta: state.runMeta,
    setRunMeta,
    mode: state.mode,
    setMode,
    traceLoading: state.traceLoading,
    setTraceLoading,
    traceError: state.traceError,
    setTraceError,
    trace: state.trace,
    setTrace,
    tracePage: state.tracePage,
    setTracePage,
    traceLoadingMore: state.traceLoadingMore,
    setTraceLoadingMore,
    usageSummary: state.usageSummary,
    setUsageSummary,
    perfSummary: state.perfSummary,
    setPerfSummary,
    snapshotMode: state.snapshotMode,
    setSnapshotMode,
    snapshotLoading: state.snapshotLoading,
    setSnapshotLoading,
    publishedReport: state.publishedReport,
    setPublishedReport,
    timelineItems: state.timelineItems,
    setTimelineItems,
    appendTimeline,
    videos: state.videos,
    setVideos,
    price: state.price,
    setPrice,
    chatInput: state.chatInput,
    setChatInput,
    chatMode: state.chatMode,
    setChatMode,
    messages: state.messages,
    setMessages,
    priceScaleMode: state.priceScaleMode,
    setPriceScaleMode,
  };
}
