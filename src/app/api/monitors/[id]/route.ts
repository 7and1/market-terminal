import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getMonitor, hasDb, toPublicMonitor, updateMonitor, type MonitorCadenceMinutes } from '@/lib/db';
import { createLogger } from '@/lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

const UpdateMonitorSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  topic: z.string().trim().min(2).max(240).optional(),
  mode: z.enum(['fast', 'deep']).optional(),
  cadenceMinutes: z.union([z.literal(15), z.literal(60), z.literal(360), z.literal(1440)]).optional(),
  active: z.boolean().optional(),
  notifyWebhookUrl: z.string().url().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const reqId = crypto.randomUUID();
  const log = createLogger({ reqId, route: '/api/monitors/[id]' });

  if (!hasDb()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 400 });
  }

  const routeParams = ParamsSchema.safeParse(await params);
  if (!routeParams.success) {
    return NextResponse.json({ error: 'Invalid monitor id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = UpdateMonitorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await getMonitor(routeParams.data.id);
  if (!existing) {
    return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });
  }

  try {
    const monitor = await updateMonitor(routeParams.data.id, {
      ...parsed.data,
      cadenceMinutes: parsed.data.cadenceMinutes as MonitorCadenceMinutes | undefined,
    });
    log.info('monitors.patch.ok', { monitorId: routeParams.data.id });
    return NextResponse.json({ monitor: toPublicMonitor(monitor) }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'update failed';
    log.error('monitors.patch.failed', { monitorId: routeParams.data.id, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
