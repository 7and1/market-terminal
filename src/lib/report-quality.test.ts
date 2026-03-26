import { describe, expect, it } from 'vitest';

import { classifySourceTier, pickKeyEvidence, summarizeReportQuality } from '@/lib/report-quality';

const buildEvidence = (url: string, source: string, confidence?: number) => ({
  id: `ev_${Math.random().toString(16).slice(2)}`,
  title: source,
  url,
  source,
  publishedAt: Date.UTC(2026, 2, 19, 12, 0),
  observedAt: Date.UTC(2026, 2, 19, 12, 5),
  timeKind: 'published' as const,
  aiSummary: confidence == null ? undefined : { bullets: ['test'], confidence },
});

describe('report quality', () => {
  it('classifies official and primary sources', () => {
    expect(classifySourceTier({ url: 'https://investor.nvidia.com/financial-reports/default.aspx', source: 'NVIDIA Investor Relations' })).toBe('official');
    expect(classifySourceTier({ url: 'https://www.reuters.com/world/us/story', source: 'Reuters' })).toBe('primary');
    expect(classifySourceTier({ url: 'https://example.com/blog/post', source: 'Example Blog' })).toBe('secondary');
  });

  it('requires enough evidence, enough domains, and at least one primary-like source', () => {
    const quality = summarizeReportQuality([
      buildEvidence('https://www.reuters.com/world/us/story', 'Reuters'),
      buildEvidence('https://www.cnbc.com/2026/03/19/story.html', 'CNBC'),
      buildEvidence('https://investor.nvidia.com/financial-reports/default.aspx', 'NVIDIA Investor Relations'),
      buildEvidence('https://www.marketwatch.com/story/x', 'MarketWatch'),
      buildEvidence('https://www.wsj.com/finance/story', 'WSJ'),
    ]);

    expect(quality.publishable).toBe(true);
    expect(quality.uniqueDomainCount).toBeGreaterThanOrEqual(3);
    expect(quality.primaryLikeCount).toBeGreaterThanOrEqual(1);
  });

  it('ranks official and primary evidence above secondary items', () => {
    const picked = pickKeyEvidence([
      buildEvidence('https://example.com/blog/post', 'Example Blog', 0.95),
      buildEvidence('https://www.reuters.com/world/us/story', 'Reuters', 0.3),
      buildEvidence('https://investor.nvidia.com/financial-reports/default.aspx', 'NVIDIA Investor Relations', 0.1),
    ], 2);

    expect(picked.map((item) => item.source)).toEqual(['NVIDIA Investor Relations', 'Reuters']);
  });
});
