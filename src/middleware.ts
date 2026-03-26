import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimiters } from '@/lib/rate-limit';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

const ROUTE_LIMITER_MAP: Record<string, keyof typeof rateLimiters> = {
  '/api/run': 'run',
  '/api/chat': 'chat',
  '/api/price': 'price',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const limiterKey = ROUTE_LIMITER_MAP[pathname];
  if (!limiterKey) return NextResponse.next();

  const ip = getClientIp(request);
  const limiter = rateLimiters[limiterKey];
  const result = limiter.check(ip);

  if (!result.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: 'Too many requests',
        retryAfter: Math.ceil(result.resetMs / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(result.resetMs / 1000)),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetMs / 1000)),
        },
      },
    );
  }

  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetMs / 1000)));
  return response;
}

export const config = {
  matcher: ['/api/run', '/api/chat', '/api/price'],
};
