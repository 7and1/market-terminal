import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearServerCaches } from '@/lib/server-cache';
import { fetchVideosForTopic } from '@/lib/video-search';

const mocks = vi.hoisted(() => ({
  brightDataSerpGoogle: vi.fn(),
}));

vi.mock('@/lib/brightdata', () => ({
  brightDataSerpGoogle: mocks.brightDataSerpGoogle,
}));

describe('video-search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearServerCaches();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      title: 'AI infrastructure spending report',
      author_name: 'YouTube Channel',
      thumbnail_url: 'https://img.example.test/thumb.jpg',
    }), { status: 200 })));
  });

  afterEach(() => {
    clearServerCaches();
    vi.unstubAllGlobals();
  });

  it('does not cache unavailable video discovery results', async () => {
    mocks.brightDataSerpGoogle
      .mockRejectedValueOnce(new Error('serp unavailable'))
      .mockRejectedValueOnce(new Error('serp unavailable'));

    const first = await fetchVideosForTopic('AI infrastructure', 2, 'en');
    const second = await fetchVideosForTopic('AI infrastructure', 2, 'en');

    expect(first.mode).toBe('unavailable');
    expect(second.mode).toBe('unavailable');
    expect(mocks.brightDataSerpGoogle).toHaveBeenCalledTimes(2);
  });

  it('caches successful video discovery results', async () => {
    mocks.brightDataSerpGoogle
      .mockResolvedValueOnce([
        {
          title: 'AI infrastructure spending report',
          url: 'https://www.youtube.com/watch?v=abcdefghijk',
          snippet: 'Latest AI infrastructure market update.',
        },
      ])
      .mockResolvedValueOnce([]);

    const first = await fetchVideosForTopic('AI infrastructure', 2, 'en');
    const second = await fetchVideosForTopic('AI infrastructure', 2, 'en');

    expect(first.mode).toBe('brightdata');
    expect(second.items).toEqual(first.items);
    expect(mocks.brightDataSerpGoogle).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
