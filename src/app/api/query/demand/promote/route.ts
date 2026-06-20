import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  hasDb,
  normalizeDynamicCatalogKey,
  upsertDynamicCatalogHead,
  upsertQueryAlias,
} from '@/lib/db';
import { createLogger } from '@/lib/log';
import { getOperatorAccessIssue } from '@/lib/operator-auth';
import { clearServerCaches } from '@/lib/server-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  label: z.string().trim().min(2).max(120),
  key: z.string().trim().min(2).max(120).optional(),
  assetKey: z.string().trim().min(2).max(120).optional(),
  reportKey: z.string().trim().min(2).max(160).optional(),
  aliases: z.array(z.string().trim().min(2).max(120)).max(50).optional().default([]),
  score: z.coerce.number().min(0).max(100).optional().default(1),
  publicSurface: z.enum(['asset_hub', 'report']).optional().default('asset_hub'),
  priorityTier: z.enum(['v1', 'secondary']).optional().default('secondary'),
  meta: z.record(z.string(), z.unknown()).optional().default({}),
});

function uniqueAliases(items: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    const key = normalizeDynamicCatalogKey(trimmed);
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export async function POST(request: Request) {
  const reqId = crypto.randomUUID();
  const startedAt = Date.now();
  const log = createLogger({ reqId, route: '/api/query/demand/promote' });

  const accessIssue = getOperatorAccessIssue(request);
  if (accessIssue) {
    log.warn('query.demand.promote.unauthorized', { status: accessIssue.status });
    return NextResponse.json({ error: accessIssue.error }, { status: accessIssue.status });
  }

  if (!hasDb()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
  }

  const key = normalizeDynamicCatalogKey(parsed.data.key || parsed.data.label);
  const assetKey = normalizeDynamicCatalogKey(parsed.data.assetKey || key);
  const reportKey = normalizeDynamicCatalogKey(parsed.data.reportKey || `${assetKey}-general`);
  const aliases = uniqueAliases([
    parsed.data.label,
    parsed.data.key || '',
    parsed.data.assetKey || '',
    assetKey,
    ...parsed.data.aliases,
  ]);

  try {
    const item = await upsertDynamicCatalogHead({
      key,
      label: parsed.data.label,
      assetKey,
      reportKey,
      publicSurface: parsed.data.publicSurface,
      priorityTier: parsed.data.priorityTier,
      aliases,
      status: 'approved',
      score: parsed.data.score,
      meta: {
        ...parsed.data.meta,
        promotedAt: new Date().toISOString(),
      },
    });

    for (const alias of aliases) {
      const targetType = parsed.data.publicSurface === 'report' ? 'report' : 'asset';
      await upsertQueryAlias({
        aliasKey: normalizeDynamicCatalogKey(alias),
        aliasLabel: alias,
        targetType,
        reportKey: targetType === 'report' ? reportKey : null,
        assetKey: targetType === 'asset' ? assetKey : null,
        source: 'manual',
        confidence: 0.99,
      });
    }

    clearServerCaches();
    log.info('query.demand.promote.ok', {
      key,
      assetKey,
      reportKey,
      aliasCount: aliases.length,
      ms: Date.now() - startedAt,
    });
    return NextResponse.json({ item, aliases }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'promotion failed';
    log.error('query.demand.promote.failed', { error: message, ms: Date.now() - startedAt });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
