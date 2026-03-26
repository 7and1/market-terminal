import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hasDb, getSession, publishSession } from '@/lib/db';
import { createLogger } from '@/lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PublishSchema = z.object({
  sessionId: z.string().uuid(),
});

const ASSET_ALIASES: Record<string, string> = {
  btc: 'bitcoin',
  bitcoin: 'bitcoin',
  eth: 'ethereum',
  ethereum: 'ethereum',
  sol: 'solana',
  solana: 'solana',
  xau: 'gold',
  gold: 'gold',
  dxy: 'dxy',
  nvda: 'nvda',
  aapl: 'aapl',
  tsla: 'tsla',
  msft: 'msft',
  goog: 'goog',
  amzn: 'amzn',
  meta: 'meta',
  oil: 'oil',
  'crude oil': 'oil',
  spy: 'spy',
  qqq: 'qqq',
};

const SLUG_SUFFIX_LENGTHS = [4, 8, 12] as const;
const FALLBACK_ASSET_KEY = 'asset';
const FALLBACK_SLUG_KEY = 'report';

function normalizeAssetKey(topic: string): string {
  const cleaned = topic.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '');
  const normalized = ASSET_ALIASES[cleaned] ?? cleaned.replace(/\s+/g, '-').slice(0, 48);
  return normalized || FALLBACK_ASSET_KEY;
}

function generateSlug(topic: string, sessionId: string, suffixLength: number): string {
  const date = new Date().toISOString().slice(0, 10);
  const key = topic
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40) || FALLBACK_SLUG_KEY;
  const short = sessionId.replace(/-/g, '').slice(0, suffixLength) || 'sess';
  return `${key}-${date}-${short}`;
}

function isSlugConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const pg = error as { code?: string; constraint?: string };
  if (pg.code !== '23505') return false;
  return !pg.constraint || pg.constraint.includes('slug');
}

export async function POST(request: Request) {
  const reqId = crypto.randomUUID();
  const log = createLogger({ reqId, route: '/api/sessions/publish' });
  const startedAt = Date.now();

  if (!hasDb()) {
    log.warn('sessions.publish.missing_db', { ms: Date.now() - startedAt });
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = PublishSchema.safeParse(body);
  if (!parsed.success) {
    log.warn('sessions.publish.bad_request', { ms: Date.now() - startedAt });
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }

  const { sessionId } = parsed.data;

  let session: Awaited<ReturnType<typeof getSession>>;
  try {
    session = await getSession(sessionId);
  } catch (e) {
    const error = e instanceof Error ? e.message : 'fetch failed';
    log.error('sessions.publish.fetch_failed', { sessionId, error, ms: Date.now() - startedAt });
    return NextResponse.json({ error }, { status: 500 });
  }

  if (!session) {
    log.warn('sessions.publish.session_not_found', { sessionId, ms: Date.now() - startedAt });
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (session.status !== 'ready') {
    log.warn('sessions.publish.not_ready', { sessionId, status: session.status, ms: Date.now() - startedAt });
    return NextResponse.json({ error: 'Session is not ready' }, { status: 400 });
  }
  if (session.published && session.slug) {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    log.info('sessions.publish.already_published', { sessionId, slug: session.slug, ms: Date.now() - startedAt });
    return NextResponse.json({
      slug: session.slug,
      url: `${basePath}/report/${session.slug}`,
      alreadyPublished: true,
    });
  }

  const assetKey = normalizeAssetKey(session.topic);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

  let slug = '';
  let published = false;
  for (const suffixLength of SLUG_SUFFIX_LENGTHS) {
    slug = generateSlug(session.topic, sessionId, suffixLength);
    try {
      await publishSession(sessionId, slug, assetKey);
      published = true;
      break;
    } catch (e) {
      if (!isSlugConflict(e) || suffixLength === SLUG_SUFFIX_LENGTHS[SLUG_SUFFIX_LENGTHS.length - 1]) {
        const error = e instanceof Error ? e.message : 'publish failed';
        log.error('sessions.publish.update_failed', { sessionId, slug, assetKey, error, ms: Date.now() - startedAt });
        return NextResponse.json({ error }, { status: 500 });
      }
      log.warn('sessions.publish.slug_conflict', { sessionId, slug, retrying: true });
    }
  }

  if (!published) {
    log.error('sessions.publish.no_slug_resolved', { sessionId, ms: Date.now() - startedAt });
    return NextResponse.json({ error: 'Could not generate a unique slug' }, { status: 500 });
  }

  log.info('sessions.publish.ok', { sessionId, slug, assetKey, ms: Date.now() - startedAt });
  return NextResponse.json({
    slug,
    url: `${basePath}/report/${slug}`,
  });
}
