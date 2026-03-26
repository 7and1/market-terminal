import type { PlanEvent, SearchEvent } from '@/components/terminal/PipelineTimeline';
import type { TimelineItem } from '@/components/terminal/EvidenceTimeline';
import type { PriceResponse, PriceScaleMode, Session, VideosResponse } from '@/components/terminal/model';
import { createEmptyTracePage, createEmptyUsageSummary, createInitialMessages, type ChatMessage, type PublishedReportState } from '@/components/terminal/terminal-state';
import type { PerformanceSummary, TerminalMode, TracePageState, TraceResponse, UsageSummary } from '@/lib/session-data';

export type TerminalReducerState = {
  topic: string;
  terminalMode: TerminalMode;
  session: Session | null;
  plan: PlanEvent | null;
  search: SearchEvent | null;
  warnings: string[];
  runMeta: { mode: 'fast' | 'deep'; provider: string } | null;
  mode: 'fast' | 'deep';
  traceLoading: boolean;
  traceError: string | null;
  trace: TraceResponse | null;
  tracePage: TracePageState;
  traceLoadingMore: boolean;
  usageSummary: UsageSummary;
  perfSummary: PerformanceSummary | null;
  snapshotMode: boolean;
  snapshotLoading: boolean;
  publishedReport: PublishedReportState | null;
  timelineItems: TimelineItem[];
  videos: VideosResponse | null;
  price: PriceResponse | null;
  chatInput: string;
  chatMode: 'fetch' | 'explain';
  messages: ChatMessage[];
  priceScaleMode: PriceScaleMode;
};

export function createTerminalReducerState(now: () => number): TerminalReducerState {
  return {
    topic: '',
    terminalMode: 'draft',
    session: null,
    plan: null,
    search: null,
    warnings: [],
    runMeta: null,
    mode: 'fast',
    traceLoading: false,
    traceError: null,
    trace: null,
    tracePage: createEmptyTracePage(),
    traceLoadingMore: false,
    usageSummary: createEmptyUsageSummary(),
    perfSummary: null,
    snapshotMode: false,
    snapshotLoading: false,
    publishedReport: null,
    timelineItems: [],
    videos: null,
    price: null,
    chatInput: '',
    chatMode: 'fetch',
    messages: createInitialMessages(now),
    priceScaleMode: 'price',
  };
}

type ReducerKey = keyof TerminalReducerState;
type ReducerValue<K extends ReducerKey> = TerminalReducerState[K];

export type TerminalSharedAction =
  | {
      type: 'field/set';
      key: ReducerKey;
      value: TerminalReducerState[ReducerKey];
    }
  | {
      type: 'field/update';
      key: ReducerKey;
      updater: (prev: TerminalReducerState[ReducerKey]) => TerminalReducerState[ReducerKey] | unknown;
    }
  | {
      type: 'timeline/append';
      item: TimelineItem;
    }
  | {
      type: 'run/warn';
      message: string;
    }
  | {
      type: 'run/usage';
      summary: UsageSummary;
    }
  | {
      type: 'run/perf';
      summary: PerformanceSummary | null;
    }
  | {
      type: 'trace/pageLoaded';
      trace: TraceResponse | null;
      page: TracePageState;
    }
  | {
      type: 'publish/success';
      report: PublishedReportState;
    };

function setField<K extends ReducerKey>(
  state: TerminalReducerState,
  key: K,
  value: ReducerValue<K>,
): TerminalReducerState {
  return {
    ...state,
    [key]: value,
  };
}

export function terminalReducer(
  state: TerminalReducerState,
  action: TerminalSharedAction,
): TerminalReducerState {
  switch (action.type) {
    case 'field/set':
      return setField(state, action.key, action.value as never);
    case 'field/update':
      return setField(state, action.key, action.updater(state[action.key]) as never);
    case 'timeline/append': {
      const next = [...state.timelineItems.filter((entry) => entry.id !== action.item.id), action.item];
      next.sort((a, b) => a.ts - b.ts);
      return {
        ...state,
        timelineItems: next.slice(-260),
      };
    }
    case 'run/warn':
      return {
        ...state,
        warnings: [...state.warnings, action.message],
      };
    case 'run/usage':
      return {
        ...state,
        usageSummary: action.summary,
      };
    case 'run/perf':
      return {
        ...state,
        perfSummary: action.summary,
      };
    case 'trace/pageLoaded':
      return {
        ...state,
        trace: action.trace,
        tracePage: action.page,
      };
    case 'publish/success':
      return {
        ...state,
        publishedReport: action.report,
      };
    default:
      return state;
  }
}
