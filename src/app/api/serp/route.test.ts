import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasBrightData = vi.fn();
const brightDataSerpGoogle = vi.fn();
const checkRouteRateLimit = vi.fn();
const getProviderUsage = vi.fn();
const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

vi.mock('@/lib/env', () => ({
  hasBrightData,
}));

vi.mock('@/lib/brightdata', () => ({
  brightDataSerpGoogle,
}));

vi.mock('@/lib/log', () => ({
  createLogger: vi.fn(() => logger),
}));

vi.mock('@/lib/route-rate-limit', () => ({
  checkRouteRateLimit,
}));

vi.mock('@/lib/budget-guard', () => ({
  getProviderUsage,
}));

describe('/api/serp GET', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hasBrightData.mockReturnValue(true);
    brightDataSerpGoogle.mockResolvedValue([
      { title: 'Bitcoin headline', url: 'https://example.com/a', snippet: 'summary' },
    ]);
    checkRouteRateLimit.mockReturnValue({
      ok: true,
      headers: { 'X-RateLimit-Limit': '30', 'X-RateLimit-Remaining': '29', 'X-RateLimit-Reset': '60' },
    });
    getProviderUsage.mockResolvedValue({ ok: true, calls: 1, limit: 2000 });
  });

  it('rejects invalid queries before calling providers', async () => {
    const { GET } = await import('@/app/api/serp/route');
    const response = await GET(new Request('http://localhost/api/serp?q=x'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('30');
    expect(json.error).toBe('Missing or invalid ?q=');
    expect(brightDataSerpGoogle).not.toHaveBeenCalled();
  });

  it('returns a config error when Bright Data is unavailable', async () => {
    hasBrightData.mockReturnValue(false);

    const { GET } = await import('@/app/api/serp/route');
    const response = await GET(new Request('http://localhost/api/serp?q=bitcoin%20news'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('BRIGHTDATA_API_TOKEN not configured');
    expect(brightDataSerpGoogle).not.toHaveBeenCalled();
  });

  it('maps request options to Bright Data and returns counted results', async () => {
    const { GET } = await import('@/app/api/serp/route');
    const response = await GET(
      new Request('http://localhost/api/serp?q=%20bitcoin%20macro%20&format=full&vertical=news&recency=d'),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('29');
    expect(brightDataSerpGoogle).toHaveBeenCalledWith({
      query: 'bitcoin macro',
      format: 'full_json_google',
      vertical: 'news',
      recency: 'd',
      locale: 'en',
    });
    expect(json.count).toBe(1);
    expect(json.results[0].url).toBe('https://example.com/a');
  });

  it('passes supported locale hints to Bright Data', async () => {
    const { GET } = await import('@/app/api/serp/route');
    const response = await GET(
      new Request('http://localhost/api/serp?q=acciones%20de%20energia&locale=es'),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(brightDataSerpGoogle).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'acciones de energia',
        locale: 'es',
      }),
    );
    expect(json.locale).toBe('es');
  });

  it('rejects queries longer than the public schema limit', async () => {
    const q = 'a'.repeat(241);

    const { GET } = await import('@/app/api/serp/route');
    const response = await GET(new Request(`http://localhost/api/serp?q=${q}`));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Missing or invalid ?q=');
    expect(brightDataSerpGoogle).not.toHaveBeenCalled();
  });

  it('returns a structured provider error without leaking internal details', async () => {
    brightDataSerpGoogle.mockRejectedValue(
      new Error('Bright Data request failed (503) zone=secret-zone data_format=parsed_light: upstream timeout'),
    );

    const { GET } = await import('@/app/api/serp/route');
    const response = await GET(new Request('http://localhost/api/serp?q=bitcoin%20news'));
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('30');
    expect(json).toMatchObject({
      error: 'SERP provider failed',
      provider: 'brightdata',
      detail: 'upstream unavailable',
      q: 'bitcoin news',
      format: 'light',
      vertical: 'web',
      recency: '',
      locale: 'en',
      count: 0,
      results: [],
    });
    expect(JSON.stringify(json)).not.toContain('secret-zone');
    expect(JSON.stringify(json)).not.toContain('upstream timeout');
  });

  it('returns 503 before provider work when the Bright Data budget is exhausted', async () => {
    getProviderUsage.mockResolvedValue({ ok: false, calls: 2000, limit: 2000 });

    const { GET } = await import('@/app/api/serp/route');
    const response = await GET(new Request('http://localhost/api/serp?q=bitcoin%20news'));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.provider).toBe('brightdata');
    expect(brightDataSerpGoogle).not.toHaveBeenCalled();
  });

  it('returns limiter responses before validation or provider work', async () => {
    checkRouteRateLimit.mockReturnValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 }),
    });

    const { GET } = await import('@/app/api/serp/route');
    const response = await GET(new Request('http://localhost/api/serp?q=bitcoin'));

    expect(response.status).toBe(429);
    expect(brightDataSerpGoogle).not.toHaveBeenCalled();
  });
});
