import { NextResponse } from 'next/server';

import { getProviderUsage } from '@/lib/budget-guard';
import { brightDataSerpZone, env } from '@/lib/env';
import { createLogger } from '@/lib/log';
import { checkRouteRateLimit } from '@/lib/route-rate-limit';
import { fetchVideosForTopic, type VideosResponse } from '@/lib/video-search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const rateLimit = await checkRouteRateLimit(request, 'videos');
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const reqId = crypto.randomUUID();
  const log = createLogger({ reqId, route: '/api/videos' });
  const startedAt = Date.now();

  const url = new URL(request.url);
  const topic = (url.searchParams.get('topic') || url.searchParams.get('q') || '').trim().slice(0, 160);
  if (!topic) {
    log.warn('videos.bad_request', { ms: Date.now() - startedAt });
    return NextResponse.json(
      { error: 'Missing ?topic=' },
      { status: 400, headers: rateLimit.headers },
    );
  }

  const token = env.brightdata.token;
  const zone = brightDataSerpZone();

  const fetchedAt = Date.now();
  const rawLimit = Number.parseInt(url.searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(8, rawLimit)) : 6;
  const rawLocale = (url.searchParams.get('locale') || '').trim().toLowerCase();
  const locale = rawLocale === 'es' || rawLocale === 'zh' ? rawLocale : 'en';

  if (!token) {
    const payload: VideosResponse = {
      topic,
      fetchedAt,
      mode: 'unavailable',
      items: [],
      error: 'BRIGHTDATA_API_TOKEN (or API_TOKEN) not set.',
    };
    log.warn('videos.unavailable.missing_brightdata', { topic: topic.slice(0, 80), limit, ms: Date.now() - startedAt });
    return NextResponse.json(payload, { status: 200, headers: rateLimit.headers });
  }

  const usage = await getProviderUsage('brightdata');
  if (!usage.ok) {
    return NextResponse.json(
      { error: 'Bright Data daily call limit exceeded', provider: 'brightdata', calls: usage.calls, limit: usage.limit },
      { status: 503, headers: rateLimit.headers },
    );
  }

  try {
    log.info('videos.request', { topic: topic.slice(0, 80), limit, locale, zone });
    const payload = await fetchVideosForTopic(topic, limit, locale);
    log.info('videos.response', { mode: payload.mode, count: payload.items.length, ms: Date.now() - startedAt });
    return NextResponse.json(payload, { status: 200, headers: rateLimit.headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const payload: VideosResponse = {
      topic,
      fetchedAt,
      mode: 'unavailable',
      items: [],
      error: 'Video discovery failed',
    };
    log.error('videos.error', { message, ms: Date.now() - startedAt });
    return NextResponse.json(payload, { status: 200, headers: rateLimit.headers });
  }
}
