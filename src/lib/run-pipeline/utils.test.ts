import { describe, expect, it } from 'vitest';

import type { EvidenceItem } from '@/lib/run-pipeline/contracts';
import { asEvidenceFromSerp, filterStaleEvidence, pickSerpDiverse } from '@/lib/run-pipeline/utils';

const observedAt = Date.parse('2026-06-12T10:00:00.000Z');

function evidence(id: string, daysOld: number, timeKind: EvidenceItem['timeKind']): EvidenceItem {
  return {
    id,
    title: `Evidence ${id}`,
    url: `https://${id}.example.test/story`,
    source: `${id}.example.test`,
    observedAt,
    publishedAt: observedAt - daysOld * 86_400_000,
    timeKind,
    excerptSource: 'serp',
  };
}

describe('run-pipeline utils', () => {
  it('keeps SERP picks diverse by domain before filling remaining slots', () => {
    const picked = pickSerpDiverse(
      [
        { title: 'Reuters latest AI market news', url: 'https://reuters.com/a', snippet: 'latest market report' },
        { title: 'Reuters latest AI update', url: 'https://reuters.com/b', snippet: 'latest market report' },
        { title: 'Reuters latest AI filing', url: 'https://reuters.com/c', snippet: 'latest market report' },
        { title: 'CNBC AI stocks today', url: 'https://cnbc.com/a', snippet: 'breaking market update' },
        { title: 'FT AI investment report', url: 'https://ft.com/a', snippet: 'latest report' },
      ],
      4,
    );

    const domains = picked.map((item) => new URL(item.url).hostname);
    expect(domains.filter((domain) => domain === 'reuters.com')).toHaveLength(2);
    expect(new Set(domains).size).toBeGreaterThanOrEqual(3);
  });

  it('does not globally boost crypto-native sources for equity topics', () => {
    const picked = pickSerpDiverse(
      [
        {
          title: 'Tesla delivery expectations update',
          url: 'https://reuters.com/tesla-deliveries',
          snippet: 'latest report on TSLA deliveries and EV margins',
        },
        {
          title: 'Tesla delivery expectations update',
          url: 'https://coindesk.com/tesla-crypto-angle',
          snippet: 'latest report on TSLA deliveries and EV margins',
        },
      ],
      1,
      'Tesla',
    );

    expect(picked[0]?.url).toContain('reuters.com');
  });

  it('uses catalog hints to boost crypto-native sources for bitcoin topics', () => {
    const picked = pickSerpDiverse(
      [
        {
          title: 'Bitcoin ETF flows update',
          url: 'https://example.test/bitcoin-etf',
          snippet: 'latest report on bitcoin ETF flow and SEC catalyst',
        },
        {
          title: 'Bitcoin ETF flows update',
          url: 'https://coindesk.com/bitcoin-etf',
          snippet: 'latest report on bitcoin ETF flow and SEC catalyst',
        },
      ],
      1,
      'Bitcoin',
    );

    expect(picked[0]?.url).toContain('coindesk.com');
  });

  it('filters stale published evidence but keeps observed-only evidence', () => {
    const result = filterStaleEvidence(
      [
        evidence('fresh', 5, 'published'),
        evidence('stale', 80, 'published'),
        evidence('observed', 365, 'observed'),
      ],
      observedAt,
      60,
    );

    expect(result.dropped).toBe(1);
    expect(result.keep.map((item) => item.id)).toEqual(['fresh', 'observed']);
  });

  it('marks SERP items without parsed publication time as observed evidence', () => {
    const items = asEvidenceFromSerp(
      [
        {
          title: 'AI infrastructure market update',
          url: 'https://example.test/no-date',
          snippet: 'No explicit date in this snippet.',
        },
      ],
      observedAt,
    );

    expect(items[0]).toMatchObject({
      id: 'ev_1',
      source: 'example.test',
      observedAt,
      publishedAt: observedAt,
      timeKind: 'observed',
    });
  });
});
