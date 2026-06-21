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

  it('returns localized off-domain guidance when a locale is provided', () => {
    expect(assessMarketQueryScope({ topic: '明天的天气怎么样？', locale: 'zh' })).toMatchObject({
      ok: false,
      scope: 'off_domain',
      reason: 'weather',
      message: '这个工作区用于市场研究，不提供独立天气预报。请改成询问天气对某个资产、商品或板块的影响。',
      supportedExamples: [
        '为什么 BTC 今天下跌？',
        '是什么推动了 NVDA 财报后的走势？',
        '收益率现在如何影响黄金？',
        '明天的天气会影响天然气价格吗？',
      ],
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
