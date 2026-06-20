import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchTopicPrice = vi.fn();
const checkRouteRateLimit = vi.fn();
const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

vi.mock('@/lib/market-data', () => ({
  fetchTopicPrice,
}));

vi.mock('@/lib/route-rate-limit', () => ({
  checkRouteRateLimit,
}));

vi.mock('@/lib/log', () => ({
  createLogger: vi.fn(() => logger),
}));

describe('/api/price GET', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    checkRouteRateLimit.mockReturnValue({
      ok: true,
      headers: { 'X-RateLimit-Limit': '60', 'X-RateLimit-Remaining': '59', 'X-RateLimit-Reset': '60' },
    });
    fetchTopicPrice.mockResolvedValue({
      ok: true,
      topic: 'Bitcoin',
      symbol: 'BTC',
      provider: 'coingecko',
      fetchedAt: 1,
      series: [100],
      timestamps: [1],
      last: 100,
    });
  });

  it('rejects missing topic without provider work and includes rate-limit headers', async () => {
    const { GET } = await import('@/app/api/price/route');
    const response = await GET(new Request('http://localhost/api/price'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(fetchTopicPrice).not.toHaveBeenCalled();
    expect(json).toMatchObject({
      ok: false,
      topic: '',
      provider: 'none',
      series: [],
      timestamps: [],
      error: 'Missing topic or symbol',
    });
  });

  it('normalizes symbol aliases before calling the provider', async () => {
    const { GET } = await import('@/app/api/price/route');
    await GET(new Request('http://localhost/api/price?symbol=%20ETH%20'));

    expect(fetchTopicPrice).toHaveBeenCalledWith('ETH');
  });

  it('trims and truncates overlong topic and symbol values before provider work', async () => {
    const longTopic = 'a'.repeat(140);
    const longSymbol = 'b'.repeat(140);

    const { GET } = await import('@/app/api/price/route');
    await GET(new Request(`http://localhost/api/price?topic=%20${longTopic}%20`));
    expect(fetchTopicPrice).toHaveBeenLastCalledWith('a'.repeat(120));

    await GET(new Request(`http://localhost/api/price?symbol=%20${longSymbol}%20`));
    expect(fetchTopicPrice).toHaveBeenLastCalledWith('b'.repeat(120));
  });

  it('returns limiter responses before provider work', async () => {
    checkRouteRateLimit.mockReturnValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 }),
    });

    const { GET } = await import('@/app/api/price/route');
    const response = await GET(new Request('http://localhost/api/price?topic=BTC'));

    expect(response.status).toBe(429);
    expect(fetchTopicPrice).not.toHaveBeenCalled();
  });

  it('degrades to a typed payload when unexpected provider errors escape', async () => {
    fetchTopicPrice.mockRejectedValue(new Error('provider exploded with secret-zone'));

    const { GET } = await import('@/app/api/price/route');
    const response = await GET(new Request('http://localhost/api/price?topic=Solana'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      ok: false,
      topic: 'Solana',
      provider: 'internal',
      error: 'Price provider failed',
      series: [],
      timestamps: [],
    });
    expect(JSON.stringify(json)).not.toContain('secret-zone');
  });
});
