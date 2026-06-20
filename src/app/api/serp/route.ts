import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hasBrightData } from '@/lib/env';
import { brightDataSerpGoogle } from '@/lib/brightdata';
import { getProviderUsage } from '@/lib/budget-guard';
import { createLogger } from '@/lib/log';
import { checkRouteRateLimit } from '@/lib/route-rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Recency = 'h' | 'd' | 'w' | 'm' | 'y' | '';

const QuerySchema = z.object({
  q: z.string().trim().min(2).max(240),
  format: z.enum(['light', 'full', 'markdown']).optional(),
  vertical: z.enum(['web', 'news']).optional(),
  recency: z.enum(['h', 'd', 'w', 'm', 'y']).optional(),
  locale: z.enum(['en', 'es', 'zh']).optional(),
});

export async function GET(request: Request) {
  const rateLimit = await checkRouteRateLimit(request, 'serp');
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const reqId = crypto.randomUUID();
  const log = createLogger({ reqId, route: '/api/serp' });
  const startedAt = Date.now();

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get('q') || url.searchParams.get('query') || '',
    format: url.searchParams.get('format') || undefined,
    vertical: url.searchParams.get('vertical') || undefined,
    recency: url.searchParams.get('recency') || undefined,
    locale: url.searchParams.get('locale') || undefined,
  });

  if (!parsed.success) {
    log.warn('serp.bad_request', { ms: Date.now() - startedAt });
    return NextResponse.json({ error: 'Missing or invalid ?q=' }, { status: 400, headers: rateLimit.headers });
  }

  if (!hasBrightData()) {
    log.warn('serp.missing_brightdata', { ms: Date.now() - startedAt });
    return NextResponse.json(
      { error: 'BRIGHTDATA_API_TOKEN not configured' },
      { status: 400, headers: rateLimit.headers },
    );
  }

  const usage = await getProviderUsage('brightdata');
  if (!usage.ok) {
    log.warn('serp.budget_exhausted', { calls: usage.calls, limit: usage.limit, ms: Date.now() - startedAt });
    return NextResponse.json(
      { error: 'Bright Data daily call limit exceeded', provider: 'brightdata', calls: usage.calls, limit: usage.limit },
      { status: 503, headers: rateLimit.headers },
    );
  }

  const format = parsed.data.format || 'light';
  const vertical = parsed.data.vertical || 'web';
  const recency: Recency = parsed.data.recency || '';
  const locale = parsed.data.locale || 'en';
  log.info('serp.request', { format, vertical, recency, locale, q: parsed.data.q.slice(0, 120) });

  try {
    const results = await brightDataSerpGoogle({
      query: parsed.data.q,
      format: format === 'full' ? 'full_json_google' : format === 'markdown' ? 'markdown' : 'light_json_google',
      vertical,
      recency,
      locale,
    });

    log.info('serp.response', { count: results.length, ms: Date.now() - startedAt });
    return NextResponse.json({
      q: parsed.data.q,
      format,
      vertical,
      recency,
      locale,
      count: results.length,
      results,
    }, { headers: rateLimit.headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'SERP provider failed';
    log.error('serp.provider_error', { message, ms: Date.now() - startedAt });
    return NextResponse.json({
      error: 'SERP provider failed',
      provider: 'brightdata',
      detail: 'upstream unavailable',
      q: parsed.data.q,
      format,
      vertical,
      recency,
      locale,
      count: 0,
      results: [],
    }, { status: 502, headers: rateLimit.headers });
  }
}
