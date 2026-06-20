import { afterEach, describe, expect, it } from 'vitest';

import { applyRateLimitHeaders, checkRouteRateLimit } from '@/lib/route-rate-limit';

describe('route-rate-limit', () => {
  afterEach(() => {
    delete process.env.TRUST_PROXY_HEADERS;
    delete process.env.RATE_LIMIT_BACKEND;
  });

  it('allows requests until the limiter is exhausted and then returns 429', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    process.env.RATE_LIMIT_BACKEND = 'memory';
    const headers = new Headers();
    let lastAllowedHeaders: Record<string, string> | null = null;

    for (let idx = 0; idx < 10; idx += 1) {
      const result = await checkRouteRateLimit(
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

    const blocked = await checkRouteRateLimit(
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

  it('prefers x-real-ip over spoofed x-forwarded-for values', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    process.env.RATE_LIMIT_BACKEND = 'memory';

    for (let idx = 0; idx < 60; idx += 1) {
      const result = await checkRouteRateLimit(
        new Request('http://localhost/api/price', {
          headers: {
            'x-real-ip': '198.51.100.20',
            'x-forwarded-for': `10.0.0.${idx}, 203.0.113.99`,
          },
        }),
        'price',
      );
      expect(result.ok).toBe(true);
    }

    const blocked = await checkRouteRateLimit(
      new Request('http://localhost/api/price', {
        headers: {
          'x-real-ip': '198.51.100.20',
          'x-forwarded-for': '10.0.0.250, 203.0.113.99',
        },
      }),
      'price',
    );

    expect(blocked.ok).toBe(false);
  });
});
