import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = {
  brightdata: {
    token: '',
  },
};
const brightDataSerpZone = vi.fn(() => 'serp-zone');
const getProviderUsage = vi.fn();
const fetchVideosForTopic = vi.fn();
const checkRouteRateLimit = vi.fn();
const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

vi.mock('@/lib/env', () => ({
  env,
  brightDataSerpZone,
}));

vi.mock('@/lib/video-search', () => ({
  fetchVideosForTopic,
}));

vi.mock('@/lib/budget-guard', () => ({
  getProviderUsage,
}));

vi.mock('@/lib/log', () => ({
  createLogger: vi.fn(() => logger),
}));

vi.mock('@/lib/route-rate-limit', () => ({
  checkRouteRateLimit,
}));

describe('/api/videos GET', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    env.brightdata.token = '';
    brightDataSerpZone.mockReturnValue('serp-zone');
    checkRouteRateLimit.mockReturnValue({
      ok: true,
      headers: { 'X-RateLimit-Limit': '30', 'X-RateLimit-Remaining': '29', 'X-RateLimit-Reset': '60' },
    });
    getProviderUsage.mockResolvedValue({ ok: true, calls: 1, limit: 2000 });
    fetchVideosForTopic.mockResolvedValue({
      topic: 'Bitcoin',
      fetchedAt: 1,
      mode: 'brightdata',
      items: [{ id: 'video_1', title: 'Video', url: 'https://youtube.com/watch?v=abcdefghijk', channel: 'YouTube', thumbnail: '', provider: 'YouTube' }],
    });
  });

  it('rejects missing topics without provider work', async () => {
    const { GET } = await import('@/app/api/videos/route');
    const response = await GET(new Request('http://localhost/api/videos'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('30');
    expect(json.error).toBe('Missing ?topic=');
    expect(fetchVideosForTopic).not.toHaveBeenCalled();
  });

  it('returns unavailable without fake videos when Bright Data is not configured', async () => {
    const { GET } = await import('@/app/api/videos/route');
    const response = await GET(new Request('http://localhost/api/videos?topic=%20Bitcoin%20&limit=99'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.mode).toBe('unavailable');
    expect(json.topic).toBe('Bitcoin');
    expect(json.items).toEqual([]);
    expect(fetchVideosForTopic).not.toHaveBeenCalled();
  });

  it('calls the provider when configured and clamps low limits', async () => {
    env.brightdata.token = 'token-123';

    const { GET } = await import('@/app/api/videos/route');
    const response = await GET(new Request('http://localhost/api/videos?topic=Bitcoin&limit=0'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(fetchVideosForTopic).toHaveBeenCalledWith('Bitcoin', 1, 'en');
    expect(json.mode).toBe('brightdata');
  });

  it('trims and truncates overlong topics before provider work', async () => {
    env.brightdata.token = 'token-123';
    const longTopic = 'a'.repeat(180);

    const { GET } = await import('@/app/api/videos/route');
    const response = await GET(new Request(`http://localhost/api/videos?topic=%20${longTopic}%20`));

    expect(response.status).toBe(200);
    expect(fetchVideosForTopic).toHaveBeenCalledWith('a'.repeat(160), 6, 'en');
  });

  it('clamps high limits to the public maximum', async () => {
    env.brightdata.token = 'token-123';

    const { GET } = await import('@/app/api/videos/route');
    const response = await GET(new Request('http://localhost/api/videos?topic=Bitcoin&limit=99'));

    expect(response.status).toBe(200);
    expect(fetchVideosForTopic).toHaveBeenCalledWith('Bitcoin', 8, 'en');
  });

  it('defaults non-numeric limits to 6', async () => {
    env.brightdata.token = 'token-123';

    const { GET } = await import('@/app/api/videos/route');
    const response = await GET(new Request('http://localhost/api/videos?topic=Bitcoin&limit=abc'));

    expect(response.status).toBe(200);
    expect(fetchVideosForTopic).toHaveBeenCalledWith('Bitcoin', 6, 'en');
  });

  it('passes supported locales to video search', async () => {
    env.brightdata.token = 'token-123';

    const { GET } = await import('@/app/api/videos/route');
    const response = await GET(new Request('http://localhost/api/videos?topic=Bitcoin&locale=zh'));

    expect(response.status).toBe(200);
    expect(fetchVideosForTopic).toHaveBeenCalledWith('Bitcoin', 6, 'zh');
  });

  it('returns unavailable without fake videos on provider errors', async () => {
    env.brightdata.token = 'token-123';
    fetchVideosForTopic.mockRejectedValue(new Error('serp failed with secret-zone'));

    const { GET } = await import('@/app/api/videos/route');
    const response = await GET(new Request('http://localhost/api/videos?topic=ETH&limit=2'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.mode).toBe('unavailable');
    expect(json.error).toBe('Video discovery failed');
    expect(JSON.stringify(json)).not.toContain('secret-zone');
    expect(json.items).toEqual([]);
  });

  it('returns 503 when the Bright Data budget is exhausted', async () => {
    env.brightdata.token = 'token-123';
    getProviderUsage.mockResolvedValue({ ok: false, calls: 2000, limit: 2000 });

    const { GET } = await import('@/app/api/videos/route');
    const response = await GET(new Request('http://localhost/api/videos?topic=Bitcoin'));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.provider).toBe('brightdata');
    expect(fetchVideosForTopic).not.toHaveBeenCalled();
  });

  it('returns limiter responses before provider work', async () => {
    checkRouteRateLimit.mockReturnValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 }),
    });

    const { GET } = await import('@/app/api/videos/route');
    const response = await GET(new Request('http://localhost/api/videos?topic=Bitcoin'));

    expect(response.status).toBe(429);
    expect(fetchVideosForTopic).not.toHaveBeenCalled();
  });
});
