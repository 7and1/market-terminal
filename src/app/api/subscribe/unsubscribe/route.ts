import { createHash } from 'node:crypto';

import { NextResponse } from 'next/server';

import { unsubscribeSubscriber } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function redirectUrl(request: Request, status: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin || 'https://trendanalysis.ai';
  return `${baseUrl}/?subscription=${encodeURIComponent(status)}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const hash = url.searchParams.get('hash') || '';
  if (!token && !hash) {
    return NextResponse.redirect(redirectUrl(request, 'invalid'));
  }

  const tokenHashValue = hash && /^[a-f0-9]{64}$/i.test(hash) ? hash.toLowerCase() : tokenHash(token);
  const ok = await unsubscribeSubscriber(tokenHashValue).catch(() => false);
  return NextResponse.redirect(redirectUrl(request, ok ? 'unsubscribed' : 'invalid'));
}
