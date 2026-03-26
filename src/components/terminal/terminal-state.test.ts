import { describe, expect, it } from 'vitest';

import { buildReplayTimeline, createEmptyTracePage, createEmptyUsageSummary, deriveContextFocusEvidenceIds, deriveReferenceContext } from '@/components/terminal/terminal-state';

describe('terminal-state helpers', () => {
  it('creates empty trace and usage states', () => {
    expect(createEmptyTracePage()).toEqual({
      nextCursor: null,
      hasMore: false,
      loading: false,
      error: null,
    });
    expect(createEmptyUsageSummary()).toEqual({
      totalTokens: 0,
      events: 0,
      latestModel: null,
      byTag: [],
      byModel: [],
    });
  });

  it('derives reference context and focus evidence ids from selection and mentions', () => {
    const context = deriveReferenceContext({
      selectedNodeId: 'n_asset_btc',
      selectedEdgeId: 'e_story_1',
      selectedTag: 'etf',
      drawerEvidence: [
        {
          id: 'ev_1',
          title: 'A',
          url: 'https://example.com/a',
          source: 'Reuters',
          publishedAt: 1,
          observedAt: 1,
          timeKind: 'published',
        },
        {
          id: 'ev_2',
          title: 'B',
          url: 'https://example.com/b',
          source: 'Bloomberg',
          publishedAt: 2,
          observedAt: 2,
          timeKind: 'published',
        },
      ],
    });

    expect(context).toEqual({
      nodeIds: ['n_asset_btc'],
      edgeIds: ['e_story_1'],
      tags: ['etf'],
      evidenceIds: ['ev_1', 'ev_2'],
    });

    const focusIds = deriveContextFocusEvidenceIds({
      query: 'Explain @n_asset_btc with @etf and @ev_3',
      extraEvidenceIds: ['ev_0'],
      evidence: [
        { id: 'ev_1', aiSummary: { catalysts: ['ETF'], entities: ['BlackRock'] } },
        { id: 'ev_2', aiSummary: { catalysts: ['Macro'], entities: ['Fed'] } },
      ],
      edges: [{ from: 'n_asset_btc', to: 'n_event_etf', evidenceIds: ['ev_1', 'ev_4'] }],
      tapeTagsByEvidenceId: new Map([['ev_1', ['ETF']]]),
    });

    expect(focusIds).toEqual(['ev_0', 'ev_3', 'ev_1', 'ev_4']);
  });

  it('builds replay timeline items from stored events and evidence artifacts', () => {
    const timeline = buildReplayTimeline({
      startedAt: Date.UTC(2026, 2, 20),
      events: [
        {
          id: 11,
          created_at: '2026-03-20T08:00:00.000Z',
          type: 'warn',
          payload: { message: 'provider fallback' },
        },
        {
          id: 12,
          created_at: '2026-03-20T08:02:00.000Z',
          type: 'price.snapshot',
          payload: { provider: 'coingecko', series: [1, 2, 3] },
        },
      ],
      artifacts: {
        evidence: [
          {
            id: 'ev_10',
            title: 'Bitcoin ETF demand rises',
            url: 'https://example.com/ev10',
            source: 'Reuters',
            publishedAt: Date.UTC(2026, 2, 20, 8, 1),
            observedAt: Date.UTC(2026, 2, 20, 8, 1),
            timeKind: 'published',
            aiSummary: { bullets: ['ETF demand rose'], catalysts: ['ETF'], entities: ['BlackRock'] },
          },
        ],
      },
    });

    expect(timeline.map((item) => item.id)).toEqual(['tl_hist_warn_11', 'tl_hist_ev_ev_10', 'tl_hist_price_12']);
    expect(timeline[1]?.evidenceIds).toEqual(['ev_10']);
  });
});
