import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hasDb, getSession, patchMeta } from '@/lib/db';
import { createLogger } from '@/lib/log';
import { buildSessionDiffSummary } from '@/lib/monitoring';
import { promoteReadySessionToPublicHead } from '@/lib/publish-session';
import { normalizeQueryLocale } from '@/lib/query-copy';
import { isAuthorizedSessionAccess } from '@/lib/session-write-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PublishSchema = z.object({
  sessionId: z.string().uuid(),
  locale: z.string().trim().min(2).max(10).optional(),
});

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
  if (!isAuthorizedSessionAccess(request, sessionId)) {
    log.warn('sessions.publish.unauthorized', { sessionId, ms: Date.now() - startedAt });
    return NextResponse.json({ error: 'Unauthorized session publish' }, { status: 403 });
  }

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
  const locale = normalizeQueryLocale(
    parsed.data.locale ||
      (typeof session.meta?.locale === 'string' ? session.meta.locale : undefined),
  );
  if (session.published && session.slug) {
    log.info('sessions.publish.already_published', { sessionId, slug: session.slug, ms: Date.now() - startedAt });
    return NextResponse.json({
      slug: session.slug,
      locale,
      alreadyPublished: true,
    });
  }

  const promotion = await promoteReadySessionToPublicHead(session, { locale });
  if (!promotion.ok) {
    if (promotion.code === 'INSUFFICIENT_REPORT_QUALITY' && promotion.quality) {
      log.warn('sessions.publish.quality_rejected', {
        sessionId,
        evidence: promotion.quality.evidenceCount,
        uniqueDomains: promotion.quality.uniqueDomainCount,
        primaryLikeCount: promotion.quality.primaryLikeCount,
        ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          error: promotion.error,
          code: promotion.code,
          quality: promotion.quality,
        },
        { status: promotion.status },
      );
    }

    if (promotion.code === 'PRIVATE_ONLY_SESSION') {
      log.warn('sessions.publish.private_only', {
        sessionId,
        topic: session.topic.slice(0, 120),
        ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          error: promotion.error,
          code: promotion.code,
          visibility: 'private',
          canonicalLabel: promotion.canonicalLabel,
        },
        { status: promotion.status },
      );
    }

    log.error('sessions.publish.update_failed', {
      sessionId,
      error: promotion.error,
      ms: Date.now() - startedAt,
    });
    return NextResponse.json({ error: promotion.error, code: promotion.code }, { status: promotion.status });
  }

  let refreshDiff: Awaited<ReturnType<typeof buildSessionDiffSummary>> | null = null;
  if (promotion.previousHead?.currentSessionId && promotion.previousHead.currentSessionId !== sessionId) {
    try {
      const baselineSession = await getSession(promotion.previousHead.currentSessionId);
      if (baselineSession) {
        refreshDiff = await buildSessionDiffSummary({
          topic: promotion.canonicalLabel,
          currentMeta: session.meta as Record<string, unknown>,
          baselineMeta: baselineSession.meta as Record<string, unknown>,
        });
        await patchMeta(sessionId, {
          refreshDiff: {
            ...refreshDiff,
            previousSessionId: baselineSession.sessionId,
          },
        });
      }
    } catch (error) {
      log.warn('sessions.publish.refresh_diff_failed', {
        sessionId,
        reportKey: promotion.reportKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  log.info('sessions.publish.ok', {
    sessionId,
    slug: promotion.slug,
    assetKey: promotion.assetKey,
    alreadyPublished: promotion.alreadyPublished,
    ms: Date.now() - startedAt,
  });
  return NextResponse.json({
    slug: promotion.slug,
    locale,
    alreadyPublished: promotion.alreadyPublished,
    reportKey: promotion.reportKey,
    canonicalLabel: promotion.canonicalLabel,
    refreshDiff,
  });
}
