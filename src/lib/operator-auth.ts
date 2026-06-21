import { timingSafeEqual } from 'node:crypto';

export const OPERATOR_TOKEN_HEADER = 'x-operator-token';
const OPERATOR_TOKEN_COOKIE = 'mt_operator_token';

export type OperatorAccessIssue = {
  status: 403 | 503;
  error: string;
};

function configuredOperatorToken() {
  return (
    process.env.OPERATOR_TOKEN?.trim() ||
    process.env.TRENDANALYSIS_OPERATOR_TOKEN?.trim() ||
    process.env.MONITOR_OPERATOR_TOKEN?.trim() ||
    ''
  );
}

function safeTokenEquals(actual: string, expected: string) {
  if (!actual || !expected) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(actualBytes, expectedBytes);
}

function parseBearerToken(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function parseCookieToken(request: Request) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== OPERATOR_TOKEN_COOKIE) continue;
    const raw = rest.join('=').trim();
    if (!raw) return '';
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return '';
}

export function hasOperatorAuthConfigured() {
  return Boolean(configuredOperatorToken());
}

export function isOperatorRequest(request: Request) {
  const expected = configuredOperatorToken();
  if (!expected) return false;

  const candidates = [
    request.headers.get(OPERATOR_TOKEN_HEADER)?.trim() || '',
    parseBearerToken(request),
    parseCookieToken(request),
  ];

  return candidates.some((candidate) => safeTokenEquals(candidate, expected));
}

export function getOperatorAccessIssue(request: Request): OperatorAccessIssue | null {
  if (!hasOperatorAuthConfigured()) {
    return {
      status: 503,
      error: 'Operator control plane is not configured',
    };
  }

  if (!isOperatorRequest(request)) {
    return {
      status: 403,
      error: 'Operator authorization required',
    };
  }

  return null;
}
