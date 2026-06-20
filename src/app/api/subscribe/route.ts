import { createHash, randomBytes } from 'node:crypto';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hasDb, upsertSubscriber } from '@/lib/db';
import { sendSubscriptionConfirmation, isSubscriptionEmailConfigured } from '@/lib/email';
import { createLogger } from '@/lib/log';
import { applyRateLimitHeaders, checkRouteRateLimit } from '@/lib/route-rate-limit';
import { isSeededAssetKey } from '@/lib/topic-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SubscribeSchema = z.object({
  email: z.string().trim().email().max(254),
  assetKey: z.string().trim().min(1).max(120).regex(/^[a-z0-9][a-z0-9-]*$/i),
});

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function siteUrl(request: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin || 'https://trendanalysis.ai';
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const log = createLogger({ reqId: crypto.randomUUID(), route: '/api/subscribe' });
  const rateLimit = await checkRouteRateLimit(request, 'subscribe');
  if (!rateLimit.ok) return rateLimit.response;

  if (!hasDb()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 400, headers: rateLimit.headers });
  }

  if (!isSubscriptionEmailConfigured()) {
    return NextResponse.json(
      { error: 'Email provider not configured', configured: false },
      { status: 503, headers: rateLimit.headers },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400, headers: rateLimit.headers },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const assetKey = parsed.data.assetKey.toLowerCase();
  if (!isSeededAssetKey(assetKey)) {
    return NextResponse.json(
      { error: 'Unknown subscribable asset', code: 'UNKNOWN_ASSET' },
      { status: 400, headers: rateLimit.headers },
    );
  }

  const token = randomBytes(24).toString('base64url');
  const hashed = tokenHash(token);
  const baseUrl = siteUrl(request);
  const confirmUrl = `${baseUrl}/api/subscribe/confirm?token=${encodeURIComponent(token)}`;
  const unsubscribeUrl = `${baseUrl}/api/subscribe/unsubscribe?token=${encodeURIComponent(token)}`;

  try {
    const row = await upsertSubscriber({ email, assetKey, tokenHash: hashed });
    await sendSubscriptionConfirmation({ to: email, assetKey, confirmUrl, unsubscribeUrl });
    log.info('subscribe.created', { assetKey, status: row?.status || 'pending', ms: Date.now() - startedAt });
    const response = NextResponse.json({ ok: true, status: row?.status || 'pending' }, { status: 200 });
    applyRateLimitHeaders(response.headers, rateLimit.headers);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'subscribe failed';
    log.error('subscribe.failed', { assetKey, error: message, ms: Date.now() - startedAt });
    return NextResponse.json({ error: message }, { status: 500, headers: rateLimit.headers });
  }
}
