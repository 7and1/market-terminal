import { z } from 'zod';

import { getProviderUsage } from '@/lib/budget-guard';
import { createLogger } from '@/lib/log';
import { assessMarketQueryScope } from '@/lib/market-query-scope';
import { normalizeQueryLocale } from '@/lib/query-copy';
import { applyRateLimitHeaders, checkRouteRateLimit } from '@/lib/route-rate-limit';
import { RunRequestSchema } from '@/lib/run-pipeline/contracts';
import { createSnapshotAuthCookie } from '@/lib/session-write-auth';
import { executeRun } from '@/lib/run-pipeline/execute';
import { deriveTopicVisibility } from '@/lib/topic-resolution';
import { findApprovedDynamicCatalogHeadForTopic } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const reqId = crypto.randomUUID();
  const startedAt = Date.now();
  const log = createLogger({ reqId, route: '/api/run' });
  const rateLimit = await checkRouteRateLimit(request, 'run');
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  let body: z.infer<typeof RunRequestSchema>;
  try {
    body = RunRequestSchema.parse(await request.json());
  } catch {
    log.warn('run.bad_request', { ms: Date.now() - startedAt });
    const headers = new Headers({
      'Content-Type': 'application/json',
    });
    applyRateLimitHeaders(headers, rateLimit.headers);
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers });
  }

  const locale = body.locale ? normalizeQueryLocale(body.locale) : undefined;
  const topicVisibility = deriveTopicVisibility(body.topic, locale);
  const dynamicHead = topicVisibility.visibility === 'private'
    ? await findApprovedDynamicCatalogHeadForTopic(body.topic).catch(() => null)
    : null;
  const dynamicReportKey = dynamicHead
    ? dynamicHead.reportKey || `${dynamicHead.assetKey || dynamicHead.key}-general`
    : null;
  const trustedReportKey = topicVisibility.visibility === 'public' ? topicVisibility.reportKey : dynamicReportKey;
  const trustedAssetKey = topicVisibility.assetKey || dynamicHead?.assetKey || dynamicHead?.key || null;
  if (body.runReason === 'refresh' && (!body.reportKey || !trustedReportKey || body.reportKey !== trustedReportKey)) {
    log.warn('run.invalid_refresh_target', {
      ms: Date.now() - startedAt,
      topic: body.topic.slice(0, 120),
      suppliedReportKey: body.reportKey || null,
      trustedReportKey,
    });
    const headers = new Headers({
      'Content-Type': 'application/json',
    });
    applyRateLimitHeaders(headers, rateLimit.headers);
    return new Response(JSON.stringify({ error: 'Invalid refresh target' }), { status: 400, headers });
  }
  const scope = assessMarketQueryScope({ topic: body.topic, question: body.question, locale });
  if (!scope.ok) {
    log.warn('run.off_domain_query', {
      ms: Date.now() - startedAt,
      reason: scope.reason,
      topic: body.topic.slice(0, 120),
    });
    const headers = new Headers({
      'Content-Type': 'application/json',
    });
    applyRateLimitHeaders(headers, rateLimit.headers);
    return new Response(
      JSON.stringify(
        {
          error: 'Off-domain query',
          code: 'OFF_DOMAIN_QUERY',
          scope: 'market-only',
          message: scope.message,
          supportedExamples: scope.supportedExamples,
        },
      ),
      {
        status: 422,
        headers,
      },
    );
  }

  const sessionId = crypto.randomUUID();
  const effectiveBody: z.infer<typeof RunRequestSchema> = {
    ...body,
    reportKey: trustedReportKey && body.reportKey === trustedReportKey ? trustedReportKey : undefined,
  };
  const [brightUsage, openRouterUsage] = await Promise.all([
    getProviderUsage('brightdata'),
    getProviderUsage('openrouter'),
  ]);
  if (!brightUsage.ok || !openRouterUsage.ok) {
    const headers = new Headers({
      'Content-Type': 'application/json',
    });
    applyRateLimitHeaders(headers, rateLimit.headers);
    return new Response(
      JSON.stringify({
        error: 'Provider budget exhausted',
        providers: {
          brightdata: { calls: brightUsage.calls, limit: brightUsage.limit, ok: brightUsage.ok },
          openrouter: { calls: openRouterUsage.calls, limit: openRouterUsage.limit, ok: openRouterUsage.ok },
        },
      }),
      { status: 503, headers },
    );
  }
  const encoder = new TextEncoder();
  const headers = new Headers({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  const snapshotCookie = createSnapshotAuthCookie(sessionId);
  if (snapshotCookie) {
    headers.set('Set-Cookie', snapshotCookie);
  }
  applyRateLimitHeaders(headers, rateLimit.headers);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await executeRun({
          body: effectiveBody,
          signal: request.signal,
          log,
          sessionId,
          startedAt,
          initialMeta: {
            locale: locale || null,
            runIntent: effectiveBody.runIntent,
            monitorId: effectiveBody.monitorId || null,
            monitorRunId: effectiveBody.monitorRunId || null,
            reportKey: effectiveBody.reportKey || null,
            assetKey: trustedAssetKey,
            runReason: effectiveBody.runReason,
          },
          onEvent: ({ event, data }) => {
            controller.enqueue(encoder.encode(`event: ${event}\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers });
}
