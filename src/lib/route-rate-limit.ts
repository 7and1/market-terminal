import { rateLimiters } from '@/lib/rate-limit';

export type RateLimitHeaders = Record<string, string>;

type RouteRateLimitResult =
  | {
      ok: true;
      headers: RateLimitHeaders;
    }
  | {
      ok: false;
      response: Response;
    };

function getClientIp(request: Request): string {
  const trustProxyHeaders = /^(1|true|yes)$/i.test(process.env.TRUST_PROXY_HEADERS || '');
  if (!trustProxyHeaders) return 'local';
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
}

function toHeaders(result: {
  limit: number;
  remaining: number;
  resetMs: number;
}): RateLimitHeaders {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetMs / 1000)),
  };
}

export function checkRouteRateLimit(
  request: Request,
  limiterKey: keyof typeof rateLimiters,
): RouteRateLimitResult {
  const limiter = rateLimiters[limiterKey];
  const result = limiter.check(getClientIp(request));
  const headers = toHeaders(result);

  if (result.allowed) {
    return {
      ok: true,
      headers,
    };
  }

  return {
    ok: false,
    response: new Response(
      JSON.stringify({
        error: 'Too many requests',
        retryAfter: Math.ceil(result.resetMs / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(result.resetMs / 1000)),
          ...headers,
        },
      },
    ),
  };
}

export function applyRateLimitHeaders(target: Headers, rateLimitHeaders: RateLimitHeaders) {
  for (const [key, value] of Object.entries(rateLimitHeaders)) {
    target.set(key, value);
  }
}
