import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hasDb, listQueryDemand } from '@/lib/db';
import { createLogger } from '@/lib/log';
import { getOperatorAccessIssue } from '@/lib/operator-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export async function GET(request: Request) {
  const reqId = crypto.randomUUID();
  const startedAt = Date.now();
  const log = createLogger({ reqId, route: '/api/query/demand' });

  const accessIssue = getOperatorAccessIssue(request);
  if (accessIssue) {
    log.warn('query.demand.unauthorized', { status: accessIssue.status });
    return NextResponse.json({ error: accessIssue.error }, { status: accessIssue.status });
  }

  if (!hasDb()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    days: url.searchParams.get('days') || undefined,
    limit: url.searchParams.get('limit') || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query params', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const items = await listQueryDemand(parsed.data);
    log.info('query.demand.ok', { items: items.length, ms: Date.now() - startedAt });
    return NextResponse.json(
      {
        items,
        windowDays: parsed.data.days,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fetch failed';
    log.error('query.demand.failed', { error: message, ms: Date.now() - startedAt });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
