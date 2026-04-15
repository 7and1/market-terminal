import { NextRequest, NextResponse } from 'next/server';

const LOCALES = new Set(['en', 'es', 'zh']);

function hasLocalePrefix(pathname: string) {
  const [, maybeLocale] = pathname.split('/');
  return LOCALES.has(maybeLocale || '');
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (hasLocalePrefix(pathname)) {
    return NextResponse.next();
  }

  const rewritten = request.nextUrl.clone();
  rewritten.pathname = `/en${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(rewritten);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
