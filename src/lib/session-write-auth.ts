import { createHmac, timingSafeEqual } from 'node:crypto';

const SNAPSHOT_COOKIE_PREFIX = 'mt_snapshot_';
const SNAPSHOT_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24;

function getSnapshotSecret() {
  return process.env.SESSION_SNAPSHOT_SECRET || process.env.DATABASE_URL || '';
}

function buildSnapshotToken(sessionId: string) {
  const secret = getSnapshotSecret();
  if (!secret) return null;
  return createHmac('sha256', secret).update(`snapshot:${sessionId}`).digest('hex');
}

export function snapshotAuthCookieName(sessionId: string) {
  return `${SNAPSHOT_COOKIE_PREFIX}${sessionId.replace(/-/g, '')}`;
}

export function createSnapshotAuthCookie(sessionId: string) {
  const token = buildSnapshotToken(sessionId);
  if (!token) return null;

  const parts = [
    `${snapshotAuthCookieName(sessionId)}=${token}`,
    'Path=/api/sessions/snapshot',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SNAPSHOT_TOKEN_MAX_AGE_SECONDS}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function isAuthorizedSnapshotWrite(request: Request, sessionId: string) {
  const expectedToken = buildSnapshotToken(sessionId);
  if (!expectedToken) return false;

  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const needle = `${snapshotAuthCookieName(sessionId)}=`;
  const rawToken = cookies.find((entry) => entry.startsWith(needle))?.slice(needle.length) || '';
  if (!rawToken) return false;

  const actual = Buffer.from(rawToken);
  const expected = Buffer.from(expectedToken);
  if (actual.length !== expected.length) return false;

  return timingSafeEqual(actual, expected);
}
