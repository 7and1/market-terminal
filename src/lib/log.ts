type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function readLogLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL || '').toLowerCase().trim();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return 'info';
}

function shouldLog(level: LogLevel) {
  const current = readLogLevel();
  return LEVEL_RANK[level] >= LEVEL_RANK[current];
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
}

export function maskSecret(secret: string | null | undefined) {
  if (!secret) return '';
  const s = secret.trim();
  if (s.length <= 8) return '***';
  return `${s.slice(0, 3)}...${s.slice(-3)}`;
}

export function redact(text: string) {
  // Best-effort redaction for common secret shapes. Keep simple; do not over-redact normal text.
  return text
    .replace(/("(?:[^"]*(?:authorization|api[_-]?key|token|secret|password|cookie)[^"]*)"\s*:\s*)"[^"]*"/gi, '$1"***"')
    .replace(/([?&](?:api[_-]?key|key|token|secret|password)=)[^&\s"]+/gi, '$1***')
    .replace(/Bearer\s+[A-Za-z0-9._-]{10,}/gi, 'Bearer ***')
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, 'sk-***');
}

export type LogContext = Record<string, unknown>;

function isSensitiveField(key: string) {
  const normalized = key.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  return /(^|[-_.])(authorization|api[-_]?key|token|secret|password|cookie)([-_.]|$)/.test(normalized);
}

function sanitizeLogValue(value: unknown, key = '', seen = new WeakSet<object>()): unknown {
  if (key && isSensitiveField(key)) return '***';
  if (typeof value === 'string') return redact(value);
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeLogValue(entry, '', seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeLogValue(entryValue, entryKey, seen),
    ]),
  );
}

function sanitizeLogContext(context: LogContext): LogContext {
  return sanitizeLogValue(context) as LogContext;
}

export function createLogger(base: LogContext = {}) {
  const log =
    (level: LogLevel) =>
    (message: string, fields: LogContext = {}) => {
      if (!shouldLog(level)) return;
      const payload = {
        ts: new Date().toISOString(),
        level,
        msg: redact(message),
        ...sanitizeLogContext(base),
        ...sanitizeLogContext(fields),
      };
      console[level === 'debug' ? 'log' : level](redact(safeJson(payload)));
    };

  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
  };
}
