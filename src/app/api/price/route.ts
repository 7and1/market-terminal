import { NextResponse } from 'next/server';

import { fetchTopicPrice, type TopicPriceResponse } from '@/lib/market-data';
import { createLogger } from '@/lib/log';
import { checkRouteRateLimit } from '@/lib/route-rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeRequestedTopic(url: URL) {
  const raw = url.searchParams.get('topic') || url.searchParams.get('symbol') || '';
  const topic = raw.trim().slice(0, 120);
  return topic;
}

export async function GET(request: Request) {
  const rateLimit = await checkRouteRateLimit(request, 'price');
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const reqId = crypto.randomUUID();
  const log = createLogger({ reqId, route: '/api/price' });
  const startedAt = Date.now();
  const url = new URL(request.url);
  const topic = normalizeRequestedTopic(url);
  if (!topic) {
    return NextResponse.json(
      {
        ok: false,
        topic: '',
        provider: 'none',
        fetchedAt: Date.now(),
        series: [],
        timestamps: [],
        error: 'Missing topic or symbol',
      } satisfies TopicPriceResponse,
      { status: 400, headers: rateLimit.headers },
    );
  }

  try {
    log.info('price.request', { topic: topic.slice(0, 80) });
    const data = await fetchTopicPrice(topic);
    if (!data.ok) {
      log.warn('price.fallback', {
        provider: data.provider,
        topic: topic.slice(0, 80),
        error: data.error,
        ms: Date.now() - startedAt,
      });
    } else {
      log.info('price.response', {
        provider: data.provider,
        symbol: data.symbol,
        points: data.series.length,
        ms: Date.now() - startedAt,
      });
    }
    return NextResponse.json(data, { status: 200, headers: rateLimit.headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Price fetch failed';
    log.error('price.unhandled_error', { message, ms: Date.now() - startedAt });
    const data: TopicPriceResponse = {
      ok: false,
      topic,
      provider: 'internal',
      fetchedAt: Date.now(),
      series: [],
      timestamps: [],
      error: 'Price provider failed',
    };
    return NextResponse.json(data, { status: 200, headers: rateLimit.headers });
  }
}
