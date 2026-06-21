import { checkRateLimitCounter } from '@/lib/db';
import { rateLimitConfigs, rateLimiters } from '@/lib/rate-limit';

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
  if (!trustProxyHeaders) return 'shared-local-bucket';

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const xff = request.headers.get('x-forwarded-for') || '';
  const lastHop = xff.split(',').map((item) => item.trim()).filter(Boolean).at(-1);
  return lastHop || 'unknown';
}

function toHeaders(result: {
  limit: number;
  remaining: number;
  resetMs: number;
}, backend: 'memory' | 'pg'): RateLimitHeaders {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetMs / 1000)),
    'X-RateLimit-Backend': backend,
  };
}

function isPgRateLimitEnabled() {
  return /^(pg|postgres|postgresql)$/i.test(process.env.RATE_LIMIT_BACKEND || 'pg') && Boolean(process.env.DATABASE_URL);
}

function memoryCheck(limiterKey: keyof typeof rateLimiters, clientIp: string) {
  const limiter = rateLimiters[limiterKey];
  return limiter.check(clientIp);
}

function buildRateLimitResult(
  result: {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetMs: number;
  },
  backend: 'memory' | 'pg',
): RouteRateLimitResult {
  const headers = toHeaders(result, backend);

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

export async function checkRouteRateLimit(
  request: Request,
  limiterKey: keyof typeof rateLimiters,
): Promise<RouteRateLimitResult> {
  const clientIp = getClientIp(request);

  if (isPgRateLimitEnabled()) {
    try {
      const config = rateLimitConfigs[limiterKey];
      const result = await checkRateLimitCounter({
        bucket: `${String(limiterKey)}:${clientIp}`,
        max: config.max,
        windowMs: config.windowMs,
      });
      return buildRateLimitResult(result, 'pg');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(JSON.stringify({ level: 'warn', msg: 'rate_limit.pg_fallback', limiterKey, error: message }));
    }
  }

  return buildRateLimitResult(memoryCheck(limiterKey, clientIp), 'memory');
}

export function applyRateLimitHeaders(target: Headers, rateLimitHeaders: RateLimitHeaders) {
  for (const [key, value] of Object.entries(rateLimitHeaders)) {
    target.set(key, value);
  }
}
