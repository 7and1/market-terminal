import { describe, expect, it } from 'vitest';

import { applyRateLimitHeaders, checkRouteRateLimit } from '@/lib/route-rate-limit';

describe('route-rate-limit', () => {
  it('allows requests until the limiter is exhausted and then returns 429', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    const headers = new Headers();
    let lastAllowedHeaders: Record<string, string> | null = null;

    for (let idx = 0; idx < 10; idx += 1) {
      const result = checkRouteRateLimit(
        new Request('http://localhost/api/run', {
          headers: { 'x-forwarded-for': '198.51.100.10' },
        }),
        'run',
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        lastAllowedHeaders = result.headers;
        applyRateLimitHeaders(headers, result.headers);
      }
    }

    expect(lastAllowedHeaders?.['X-RateLimit-Limit']).toBe('10');
    expect(headers.get('X-RateLimit-Limit')).toBe('10');

    const blocked = checkRouteRateLimit(
      new Request('http://localhost/api/run', {
        headers: { 'x-forwarded-for': '198.51.100.10' },
      }),
      'run',
    );

    expect(blocked.ok).toBe(false);
    if (blocked.ok) {
      throw new Error('expected limiter to block');
    }

    expect(blocked.response.status).toBe(429);
  });
});
