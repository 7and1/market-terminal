import { describe, expect, it } from 'vitest';

import { collectLatestPerformanceSummary, normalizePerformanceSummary, summarizeUsageEvents, tracePageStateFromResponse, type TraceResponse } from '@/lib/session-data';

describe('session-data helpers', () => {
  it('normalizes perf summaries and derives top stage/api', () => {
    const perf = normalizePerformanceSummary({
      status: 'ready',
      totalMs: 4200,
      generatedAt: 123,
      marksStored: 9,
      stepDurationsMs: {
        plan: 500,
        search: 2200,
        extract: 900,
      },
      api: [
        { name: 'ai.plan', calls: 1, totalMs: 400, avgMs: 400, failures: 0 },
        { name: 'brightdata.search', calls: 2, totalMs: 1800, avgMs: 900, failures: 0 },
      ],
    });

    expect(perf).toMatchObject({
      status: 'ready',
      totalMs: 4200,
      topStage: 'search',
      topApi: 'brightdata.search',
    });
  });

  it('summarizes ai usage events by tag and model', () => {
    const usage = summarizeUsageEvents([
      {
        id: 1,
        created_at: '2026-03-19T10:00:00.000Z',
        type: 'ai.usage',
        payload: { tag: 'plan', model: 'openrouter/a', total_tokens: 120 },
      },
      {
        id: 2,
        created_at: '2026-03-19T10:00:01.000Z',
        type: 'ai.usage',
        payload: { tag: 'chat', model: 'openrouter/a', total_tokens: 300 },
      },
      {
        id: 3,
        created_at: '2026-03-19T10:00:02.000Z',
        type: 'warn',
        payload: { message: 'x' },
      },
    ]);

    expect(usage.totalTokens).toBe(420);
    expect(usage.events).toBe(2);
    expect(usage.latestModel).toBe('openrouter/a');
    expect(usage.byTag[0]).toMatchObject({ tag: 'chat', totalTokens: 300 });
    expect(usage.byModel[0]).toMatchObject({ model: 'openrouter/a', totalTokens: 420 });
  });

  it('reads perf summary from trace metadata or events and page state from response', () => {
    const trace: TraceResponse = {
      session: {
        id: 's1',
        created_at: '2026-03-19T10:00:00.000Z',
        topic: 'Bitcoin',
        status: 'ready',
        step: 'ready',
        progress: 1,
        meta: {
          perf: {
            status: 'ready',
            totalMs: 1800,
            generatedAt: 1,
            marksStored: 3,
            stepDurationsMs: { search: 700 },
            api: [],
          },
        },
      },
      events: [],
      pageInfo: {
        nextCursor: 'cursor-2',
        hasMore: true,
      },
    };

    expect(collectLatestPerformanceSummary(trace)?.totalMs).toBe(1800);
    expect(tracePageStateFromResponse(trace)).toEqual({
      nextCursor: 'cursor-2',
      hasMore: true,
      loading: false,
      error: null,
    });
  });
});
