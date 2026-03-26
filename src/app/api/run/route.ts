import { z } from 'zod';

import { createLogger } from '@/lib/log';
import { assessMarketQueryScope } from '@/lib/market-query-scope';
import { RunRequestSchema } from '@/lib/run-pipeline/contracts';
import { createSnapshotAuthCookie } from '@/lib/session-write-auth';
import { executeRun } from '@/lib/run-pipeline/execute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const reqId = crypto.randomUUID();
  const startedAt = Date.now();
  const log = createLogger({ reqId, route: '/api/run' });

  let body: z.infer<typeof RunRequestSchema>;
  try {
    body = RunRequestSchema.parse(await request.json());
  } catch {
    log.warn('run.bad_request', { ms: Date.now() - startedAt });
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  const scope = assessMarketQueryScope({ topic: body.topic, question: body.question });
  if (!scope.ok) {
    log.warn('run.off_domain_query', {
      ms: Date.now() - startedAt,
      reason: scope.reason,
      topic: body.topic.slice(0, 120),
    });
    return Response.json(
      {
        error: 'Off-domain query',
        code: 'OFF_DOMAIN_QUERY',
        scope: 'market-only',
        message: scope.message,
        supportedExamples: scope.supportedExamples,
      },
      { status: 422 },
    );
  }

  const sessionId = crypto.randomUUID();
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await executeRun({
          body,
          signal: request.signal,
          log,
          sessionId,
          startedAt,
          initialMeta: {
            runIntent: body.runIntent,
            monitorId: body.monitorId || null,
            monitorRunId: body.monitorRunId || null,
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
