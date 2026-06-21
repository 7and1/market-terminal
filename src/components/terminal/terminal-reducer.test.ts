import { describe, expect, it } from 'vitest';

import { createTerminalReducerState, terminalReducer } from '@/components/terminal/terminal-reducer';

describe('terminal-reducer', () => {
  it('sets and updates fields', () => {
    const initial = createTerminalReducerState(() => 123);
    const withTopic = terminalReducer(initial, {
      type: 'field/set',
      key: 'topic',
      value: 'Bitcoin',
    });
    const withWarnings = terminalReducer(withTopic, {
      type: 'field/set',
      key: 'warnings',
      value: ['warn-1'],
    });

    expect(withTopic.topic).toBe('Bitcoin');
    expect(withWarnings.warnings).toEqual(['warn-1']);
  });

  it('appends timeline items and keeps order', () => {
    const initial = createTerminalReducerState(() => 1);
    const next = terminalReducer(
      terminalReducer(initial, {
        type: 'timeline/append',
        item: { id: 'b', ts: 20, kind: 'note', title: 'b', subtitle: 'b', tags: [] },
      }),
      {
        type: 'timeline/append',
        item: { id: 'a', ts: 10, kind: 'note', title: 'a', subtitle: 'a', tags: [] },
      },
    );

    expect(next.timelineItems.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('handles warning, trace page, perf, usage, and publish actions', () => {
    const initial = createTerminalReducerState(() => 1);
    const warned = terminalReducer(initial, {
      type: 'run/warn',
      message: 'provider fallback',
    });
    const traced = terminalReducer(warned, {
      type: 'trace/pageLoaded',
      trace: {
        session: {
          id: 's1',
          created_at: '2026-03-20T00:00:00.000Z',
          topic: 'Bitcoin',
          status: 'ready',
          step: 'ready',
          progress: 1,
          meta: {},
        },
        events: [],
        pageInfo: {
          nextCursor: 'cursor-2',
          hasMore: true,
        },
      },
      page: {
        nextCursor: 'cursor-2',
        hasMore: true,
        loading: false,
        error: null,
      },
    });
    const perfed = terminalReducer(traced, {
      type: 'run/perf',
      summary: {
        status: 'ready',
        totalMs: 1200,
        generatedAt: 1,
        marksStored: 2,
        stepDurationsMs: { search: 800 },
        api: [],
        topStage: 'search',
        topApi: null,
      },
    });
    const used = terminalReducer(perfed, {
      type: 'run/usage',
      summary: {
        totalTokens: 321,
        events: 1,
        latestModel: 'openrouter/test',
        byTag: [],
        byModel: [],
      },
    });
    const published = terminalReducer(used, {
      type: 'publish/success',
      report: {
        slug: 'x',
        locale: 'en',
        fullUrl: 'https://trendanalysis.ai/report/x',
        relativeUrl: '/report/x',
        alreadyPublished: false,
      },
    });

    expect(published.warnings).toEqual(['provider fallback']);
    expect(published.tracePage.hasMore).toBe(true);
    expect(published.perfSummary?.topStage).toBe('search');
    expect(published.usageSummary.totalTokens).toBe(321);
    expect(published.publishedReport?.relativeUrl).toBe('/report/x');
  });
});
