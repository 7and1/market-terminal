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
    .replace(/Bearer\s+[A-Za-z0-9._-]{10,}/gi, 'Bearer ***')
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, 'sk-***');
}

export type LogContext = Record<string, unknown>;

export function createLogger(base: LogContext = {}) {
  const log =
    (level: LogLevel) =>
    (message: string, fields: LogContext = {}) => {
      if (!shouldLog(level)) return;
      const payload = {
        ts: new Date().toISOString(),
        level,
        msg: redact(message),
        ...base,
        ...fields,
      };
      console[level === 'debug' ? 'log' : level](safeJson(payload));
    };

  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
  };
}
