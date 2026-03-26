import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hasDb, toPublicMonitor } from '@/lib/db';
import { createLogger } from '@/lib/log';
import { triggerMonitorRun } from '@/lib/monitoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const reqId = crypto.randomUUID();
  const log = createLogger({ reqId, route: '/api/monitors/[id]/run' });

  if (!hasDb()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 400 });
  }

  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid monitor id' }, { status: 400 });
  }

  const result = await triggerMonitorRun(parsed.data.id);
  if (result.status === 'not_found') {
    return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });
  }
  if (result.status === 'conflict') {
    return NextResponse.json({ error: 'Monitor already has an active run in progress' }, { status: 409 });
  }

  log.info('monitors.run.queued', {
    monitorId: parsed.data.id,
    runId: result.run?.id || null,
  });
  return NextResponse.json(
    {
      ok: true,
      monitor: toPublicMonitor(result.monitor),
      run: result.run,
    },
    { status: 202 },
  );
}
