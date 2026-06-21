import { NextResponse } from 'next/server';
import { z } from 'zod';

import { insertQueryLog } from '@/lib/db';
import { createLogger } from '@/lib/log';
import { checkRouteRateLimit } from '@/lib/route-rate-limit';
import { resolveTopicQuery } from '@/lib/topic-resolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ResolveSchema = z.object({
  input: z.string().trim().min(1).max(240),
  surface: z.enum(['landing', 'terminal']).default('terminal'),
  locale: z.string().trim().min(2).max(10).optional(),
});

export async function POST(request: Request) {
  const reqId = crypto.randomUUID();
  const startedAt = Date.now();
  const log = createLogger({ reqId, route: '/api/query/resolve' });
  const rateLimit = await checkRouteRateLimit(request, 'queryResolve');
  if (!rateLimit.ok) return rateLimit.response;

  const body = await request.json().catch(() => ({}));
  const parsed = ResolveSchema.safeParse(body);
  if (!parsed.success) {
    log.warn('query.resolve.bad_request', { ms: Date.now() - startedAt });
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400, headers: rateLimit.headers },
    );
  }

  try {
    const result = await resolveTopicQuery({
      input: parsed.data.input,
      surface: parsed.data.surface,
      ...(parsed.data.locale ? { locale: parsed.data.locale } : null),
    });
    log.info('query.resolve.ok', {
      input: parsed.data.input.slice(0, 120),
      decision: result.decision,
      ms: Date.now() - startedAt,
    });
    const normalized =
      'canonicalLabel' in result && result.canonicalLabel
        ? result.canonicalLabel
        : 'typedQuery' in result
          ? result.typedQuery
          : null;
    void insertQueryLog({
      input: parsed.data.input,
      normalized,
      locale: parsed.data.locale || null,
      surface: parsed.data.surface,
      decision: result.decision,
      result,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'query log failed';
      log.warn('query.resolve.log_failed', { error: message, ms: Date.now() - startedAt });
    });
    return NextResponse.json(result, {
      status: 200,
      headers: {
        ...rateLimit.headers,
        'Cache-Control': 'private, max-age=30',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'resolve failed';
    log.error('query.resolve.failed', { error: message, ms: Date.now() - startedAt });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
