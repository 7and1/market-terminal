import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getMonitor, hasDb, listMonitorRuns, toPublicMonitor } from '@/lib/db';
import { createLogger } from '@/lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(12),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const reqId = crypto.randomUUID();
  const log = createLogger({ reqId, route: '/api/monitors/[id]/runs' });

  if (!hasDb()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 400 });
  }

  const routeParams = ParamsSchema.safeParse(await params);
  if (!routeParams.success) {
    return NextResponse.json({ error: 'Invalid monitor id' }, { status: 400 });
  }
  const query = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!query.success) {
    return NextResponse.json({ error: 'Invalid query params' }, { status: 400 });
  }

  const monitor = await getMonitor(routeParams.data.id);
  if (!monitor) {
    return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });
  }

  try {
    const runs = await listMonitorRuns(routeParams.data.id, query.data.limit);
    log.info('monitors.runs.ok', { monitorId: routeParams.data.id, runs: runs.length });
    return NextResponse.json({ monitor: toPublicMonitor(monitor), runs }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fetch failed';
    log.error('monitors.runs.failed', { monitorId: routeParams.data.id, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
