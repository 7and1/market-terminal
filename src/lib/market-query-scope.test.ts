import { describe, expect, it } from 'vitest';

import { assessMarketQueryScope } from '@/lib/market-query-scope';

describe('assessMarketQueryScope', () => {
  it('rejects clearly off-domain weather queries', () => {
    expect(assessMarketQueryScope({ topic: 'Tomorrow weather in Shanghai' })).toMatchObject({
      ok: false,
      scope: 'off_domain',
      reason: 'weather',
    });
  });

  it('rejects clearly off-domain Chinese weather queries', () => {
    expect(assessMarketQueryScope({ topic: '明天的天气怎么样？' })).toMatchObject({
      ok: false,
      scope: 'off_domain',
      reason: 'weather',
    });
  });

  it('allows market-adjacent weather impact queries', () => {
    expect(
      assessMarketQueryScope({
        topic: 'Will tomorrow weather affect natural gas prices?',
      }),
    ).toEqual({
      ok: true,
      scope: 'market',
    });
  });

  it('allows common asset-led market queries', () => {
    expect(
      assessMarketQueryScope({
        topic: 'Why is NVDA down today?',
      }),
    ).toEqual({
      ok: true,
      scope: 'market',
    });
  });
});
