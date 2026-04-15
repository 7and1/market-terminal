import { createHmac, timingSafeEqual } from 'node:crypto';

const SNAPSHOT_COOKIE_PREFIX = 'mt_snapshot_';
const SNAPSHOT_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24;
const SNAPSHOT_COOKIE_PATH = '/api/sessions';

function getSnapshotSecret() {
  return process.env.SESSION_SNAPSHOT_SECRET || process.env.DATABASE_URL || '';
}

function buildSnapshotToken(sessionId: string) {
  const secret = getSnapshotSecret();
  if (!secret) return null;
  return createHmac('sha256', secret).update(`snapshot:${sessionId}`).digest('hex');
}

function normalizeSessionId(sessionId: string) {
  return sessionId.replace(/-/g, '').toLowerCase();
}

function denormalizeSessionId(raw: string) {
  if (!/^[0-9a-f]{32}$/i.test(raw)) return null;
  const normalized = raw.toLowerCase();
  return [
    normalized.slice(0, 8),
    normalized.slice(8, 12),
    normalized.slice(12, 16),
    normalized.slice(16, 20),
    normalized.slice(20),
  ].join('-');
}

function parseCookieHeader(request: Request) {
  return new Map(
    (request.headers.get('cookie') || '')
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [name, ...rest] = entry.split('=');
        return [name, rest.join('=')];
      }),
  );
}

function hasAuthorizedSessionToken(request: Request, sessionId: string) {
  const expectedToken = buildSnapshotToken(sessionId);
  if (!expectedToken) return false;

  const cookieValue = parseCookieHeader(request).get(snapshotAuthCookieName(sessionId)) || '';
  if (!cookieValue) return false;

  const actual = Buffer.from(cookieValue);
  const expected = Buffer.from(expectedToken);
  if (actual.length !== expected.length) return false;

  return timingSafeEqual(actual, expected);
}

export function snapshotAuthCookieName(sessionId: string) {
  return `${SNAPSHOT_COOKIE_PREFIX}${normalizeSessionId(sessionId)}`;
}

export function createSnapshotAuthCookie(sessionId: string) {
  const token = buildSnapshotToken(sessionId);
  if (!token) return null;

  const parts = [
    `${snapshotAuthCookieName(sessionId)}=${token}`,
    `Path=${SNAPSHOT_COOKIE_PATH}`,
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SNAPSHOT_TOKEN_MAX_AGE_SECONDS}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function listAuthorizedSessionIds(request: Request) {
  const out = new Set<string>();
  for (const [name] of parseCookieHeader(request)) {
    if (!name.startsWith(SNAPSHOT_COOKIE_PREFIX)) continue;
    const sessionId = denormalizeSessionId(name.slice(SNAPSHOT_COOKIE_PREFIX.length));
    if (!sessionId) continue;
    if (hasAuthorizedSessionToken(request, sessionId)) out.add(sessionId);
  }
  return Array.from(out.values());
}

export function isAuthorizedSessionAccess(request: Request, sessionId: string) {
  return hasAuthorizedSessionToken(request, sessionId);
}

export function isAuthorizedSnapshotWrite(request: Request, sessionId: string) {
  return hasAuthorizedSessionToken(request, sessionId);
}
