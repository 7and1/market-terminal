import { createHash } from 'node:crypto';

import { NextResponse } from 'next/server';

import { confirmSubscriber } from '@/lib/db';

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
  if (!token) {
    return NextResponse.redirect(redirectUrl(request, 'invalid'));
  }

  const ok = await confirmSubscriber(tokenHash(token)).catch(() => false);
  return NextResponse.redirect(redirectUrl(request, ok ? 'confirmed' : 'invalid'));
}
