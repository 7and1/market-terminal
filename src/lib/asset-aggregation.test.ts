import { describe, expect, it } from 'vitest';

import type { SessionRow } from '@/lib/db';
import { aggregateAssetData, buildAssetDirectoryCards, summarizePublishedSession } from '@/lib/asset-aggregation';

function buildSession({
  sessionId,
  topic,
  slug,
  assetKey,
  createdAt,
  clusterTitle,
  clusterSummary,
  sentiment = 'bullish',
  catalysts = ['rates', 'fed'],
  entities = ['Federal Reserve', 'Treasury'],
  peerAssets = ['DXY'],
}: {
  sessionId: string;
  topic: string;
  slug: string;
  assetKey: string;
  createdAt: number;
  clusterTitle: string;
  clusterSummary: string;
  sentiment?: 'bullish' | 'bearish' | 'mixed' | 'neutral';
  catalysts?: string[];
  entities?: string[];
  peerAssets?: string[];
}): SessionRow {
  return {
    sessionId,
    topic,
    reportKey: `${assetKey}-${sessionId}`,
    status: 'ready',
    step: 'ready',
    progress: 1,
    published: true,
    slug,
    assetKey,
    _creationTime: createdAt,
    meta: {
      artifacts: {
        evidence: [
          {
            id: `ev_${sessionId}_1`,
            title: `${topic} headline`,
            url: 'https://www.reuters.com/world/us/story',
            source: 'Reuters',
            publishedAt: createdAt,
            observedAt: createdAt + 60_000,
            timeKind: 'published',
            excerpt: clusterSummary,
            aiSummary: {
              bullets: [clusterSummary],
              catalysts,
              entities,
              sentiment,
              confidence: 0.82,
            },
          },
          {
            id: `ev_${sessionId}_2`,
            title: `${topic} official`,
            url: 'https://www.federalreserve.gov/newsevents/pressreleases/example.htm',
            source: 'Federal Reserve',
            publishedAt: createdAt + 30_000,
            observedAt: createdAt + 90_000,
            timeKind: 'published',
            aiSummary: {
              bullets: ['Official confirmation'],
              catalysts: catalysts.slice(0, 1),
              entities: entities.slice(0, 1),
              sentiment,
              confidence: 0.71,
            },
          },
          {
            id: `ev_${sessionId}_3`,
            title: `${topic} follow-up`,
            url: 'https://www.cnbc.com/2026/03/26/example.html',
            source: 'CNBC',
            publishedAt: createdAt + 45_000,
            observedAt: createdAt + 120_000,
            timeKind: 'published',
            aiSummary: {
              bullets: ['Secondary confirmation'],
              catalysts: catalysts.slice(-1),
              entities: entities.slice(-1),
              sentiment,
              confidence: 0.64,
            },
          },
          {
            id: `ev_${sessionId}_4`,
            title: `${topic} secondary`,
            url: 'https://www.reuters.com/markets/commodities/example',
            source: 'Reuters',
            publishedAt: createdAt + 75_000,
            observedAt: createdAt + 135_000,
            timeKind: 'published',
            aiSummary: {
              bullets: ['Additional wire coverage'],
              catalysts,
              entities,
              sentiment,
              confidence: 0.59,
            },
          },
          {
            id: `ev_${sessionId}_5`,
            title: `${topic} macro desk`,
            url: 'https://www.cnbc.com/2026/03/26/desk-note.html',
            source: 'CNBC',
            publishedAt: createdAt + 90_000,
            observedAt: createdAt + 150_000,
            timeKind: 'published',
            aiSummary: {
              bullets: ['Macro desk follow-up'],
              catalysts,
              entities,
              sentiment,
              confidence: 0.57,
            },
          },
        ],
        clusters: [
          {
            id: `cl_${sessionId}`,
            title: clusterTitle,
            summary: clusterSummary,
            momentum: 'rising',
            evidenceIds: [`ev_${sessionId}_1`, `ev_${sessionId}_2`],
            related: [],
          },
        ],
        nodes: [
          { id: `asset_${assetKey}`, type: 'asset', label: topic },
          ...peerAssets.map((label, index) => ({
            id: `peer_${sessionId}_${index}`,
            type: 'asset' as const,
            label,
          })),
        ],
      },
      refreshDiff: {
        summary: 'New macro evidence changed the balance of risks.',
      },
    },
  };
}

describe('asset aggregation', () => {
  it('summarizes a published session into reusable brief content', () => {
    const session = buildSession({
      sessionId: 's1',
      topic: 'Gold',
      slug: 'gold-1',
      assetKey: 'gold',
      createdAt: Date.UTC(2026, 2, 26, 10, 0),
      clusterTitle: 'Rates unwind',
      clusterSummary: 'Gold rose as yields softened and the dollar pulled back.',
      peerAssets: ['DXY', 'Bitcoin'],
    });

    const summary = summarizePublishedSession(session, { displayTopic: 'Gold' });

    expect(summary.summary).toContain('Gold rose as yields softened');
    expect(summary.whatMoved[0]).toContain('Gold rose as yields softened');
    expect(summary.whyItMatters.some((item) => item.includes('Recurring catalysts'))).toBe(true);
    expect(summary.peerAssets).toEqual(['DXY', 'Bitcoin']);
    expect(summary.dominantSentiment).toBe('bullish');
    expect(summary.quality.publishable).toBe(true);
  });

  it('builds directory cards from the latest session per asset', () => {
    const sessions = [
      buildSession({
        sessionId: 's1',
        topic: 'Gold',
        slug: 'gold-older',
        assetKey: 'gold',
        createdAt: Date.UTC(2026, 2, 25, 10, 0),
        clusterTitle: 'Older read',
        clusterSummary: 'Older gold summary.',
      }),
      buildSession({
        sessionId: 's2',
        topic: 'Gold',
        slug: 'gold-newer',
        assetKey: 'gold',
        createdAt: Date.UTC(2026, 2, 26, 10, 0),
        clusterTitle: 'Current read',
        clusterSummary: 'Current gold summary.',
      }),
      buildSession({
        sessionId: 's3',
        topic: 'Bitcoin',
        slug: 'btc-newer',
        assetKey: 'bitcoin',
        createdAt: Date.UTC(2026, 2, 27, 10, 0),
        clusterTitle: 'BTC read',
        clusterSummary: 'Bitcoin summary.',
      }),
    ];

    const cards = buildAssetDirectoryCards(sessions);

    expect(cards[0]?.assetKey).toBe('gold');
    expect(cards[0]?.count).toBe(2);
    expect(cards[0]?.summary).toContain('Current gold summary');
    expect(cards[1]?.assetKey).toBe('bitcoin');
  });

  it('aggregates recurring labels, peer assets, and faq-worthy history', () => {
    const sessions = [
      buildSession({
        sessionId: 's1',
        topic: 'Gold',
        slug: 'gold-1',
        assetKey: 'gold',
        createdAt: Date.UTC(2026, 2, 24, 10, 0),
        clusterTitle: 'Rates unwind',
        clusterSummary: 'Gold rose as yields softened.',
        peerAssets: ['DXY'],
      }),
      buildSession({
        sessionId: 's2',
        topic: 'Gold',
        slug: 'gold-2',
        assetKey: 'gold',
        createdAt: Date.UTC(2026, 2, 25, 10, 0),
        clusterTitle: 'Dollar pause',
        clusterSummary: 'Gold stayed firm while the dollar paused.',
        catalysts: ['rates', 'dollar', 'inflation'],
        peerAssets: ['DXY', 'Oil'],
      }),
      buildSession({
        sessionId: 's3',
        topic: 'Gold',
        slug: 'gold-3',
        assetKey: 'gold',
        createdAt: Date.UTC(2026, 2, 26, 10, 0),
        clusterTitle: 'Safe-haven bid',
        clusterSummary: 'Gold caught a safe-haven bid on geopolitical headlines.',
        catalysts: ['rates', 'geopolitics', 'inflation'],
        peerAssets: ['Bitcoin'],
      }),
    ];

    const aggregation = aggregateAssetData(sessions, 'gold');

    expect(aggregation.totalAnalyses).toBe(3);
    expect(aggregation.topCatalysts[0]?.name).toBe('rates');
    expect(aggregation.topCatalysts[0]?.sessionCoverage).toBe(3);
    expect(aggregation.peerAssets.some((item) => item.label === 'DXY')).toBe(true);
    expect(aggregation.reports[0]?.slug).toBe('gold-3');
    expect(aggregation.faq).toHaveLength(3);
  });
});
