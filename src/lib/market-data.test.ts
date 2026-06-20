import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchTopicPrice } from '@/lib/market-data';
import { clearServerCaches } from '@/lib/server-cache';

describe('fetchTopicPrice', () => {
  beforeEach(() => {
    clearServerCaches();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearServerCaches();
    vi.unstubAllGlobals();
  });

  it('keeps the current alias topic when a cached asset response is reused', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        prices: [
          [1, 100],
          [2, 110],
        ],
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchTopicPrice('BTC');
    const second = await fetchTopicPrice('Bitcoin');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.topic).toBe('BTC');
    expect(second.topic).toBe('Bitcoin');
    expect(second.symbol).toBe('BTC');
    expect(second.series).toEqual(first.series);
    expect(second.timestamps).toEqual(first.timestamps);
    expect(second.last).toBe(first.last);
  });

  it('does not cache failed provider responses', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        prices: [
          [1, 200],
          [2, 220],
        ],
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchTopicPrice('ETH');
    const second = await fetchTopicPrice('Ethereum');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first.ok).toBe(false);
    expect(first.provider).toBe('coingecko');
    expect(second.ok).toBe(true);
    expect(second.topic).toBe('Ethereum');
    expect(second.symbol).toBe('ETH');
    expect(second.series).toEqual([200, 220]);
  });
});
