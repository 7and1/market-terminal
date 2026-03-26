import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createMonitor, hasDb, listMonitors, toPublicMonitor, type MonitorCadenceMinutes } from '@/lib/db';
import { createLogger } from '@/lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cadenceSchema = z.union([z.literal(15), z.literal(60), z.literal(360), z.literal(1440)]);

const CreateMonitorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  topic: z.string().trim().min(2).max(240),
  mode: z.enum(['fast', 'deep']).default('deep'),
  cadenceMinutes: cadenceSchema,
  notifyWebhookUrl: z.string().url().nullable().optional(),
});

export async function GET() {
  const reqId = crypto.randomUUID();
  const log = createLogger({ reqId, route: '/api/monitors' });

  if (!hasDb()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 400 });
  }

  try {
    const monitors = (await listMonitors()).map((monitor) => toPublicMonitor(monitor));
    log.info('monitors.list.ok', { monitors: monitors.length });
    return NextResponse.json({ monitors }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fetch failed';
    log.error('monitors.list.failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const reqId = crypto.randomUUID();
  const log = createLogger({ reqId, route: '/api/monitors' });

  if (!hasDb()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = CreateMonitorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const monitor = await createMonitor({
      name: parsed.data.name,
      topic: parsed.data.topic,
      mode: parsed.data.mode,
      runIntent: 'monitor',
      cadenceMinutes: parsed.data.cadenceMinutes as MonitorCadenceMinutes,
      notifyWebhookUrl: parsed.data.notifyWebhookUrl ?? null,
    });
    log.info('monitors.create.ok', { monitorId: monitor?.id || null });
    return NextResponse.json({ monitor: toPublicMonitor(monitor) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'create failed';
    log.error('monitors.create.failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
