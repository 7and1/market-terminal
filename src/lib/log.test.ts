import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLogger, redact } from '@/lib/log';

describe('log redaction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LOG_LEVEL;
  });

  it('redacts common secret field values and query parameters', () => {
    expect(redact('{"x-operator-token":"operator-secret","apiKey":"sk-live-secret-value"}')).toBe(
      '{"x-operator-token":"***","apiKey":"***"}',
    );
    expect(redact('/api/subscribe/confirm?token=abcdef1234567890&next=/')).toBe(
      '/api/subscribe/confirm?token=***&next=/',
    );
  });

  it('redacts secret-looking fields after logger payload serialization', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.LOG_LEVEL = 'warn';

    createLogger({ route: 'test' }).warn('credential test', {
      authorization: 'Bearer openrouter-secret-token',
      nested: {
        password: 'plain-text-password',
      },
      url: '/api/subscribe/confirm?token=abcdef1234567890',
    });

    const output = String(spy.mock.calls[0]?.[0] || '');
    expect(output).toContain('"authorization":"***"');
    expect(output).toContain('"password":"***"');
    expect(output).toContain('token=***');
    expect(output).not.toContain('openrouter-secret-token');
    expect(output).not.toContain('plain-text-password');
    expect(output).not.toContain('abcdef1234567890');
  });

  it('redacts non-string secret fields without hiding usage counters', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    process.env.LOG_LEVEL = 'info';

    createLogger({ route: 'test', apiKey: 123456 }).info('usage test', {
      total_tokens: 42,
      nested: {
        cookie: true,
        prompt_tokens: 12,
      },
    });

    const output = String(spy.mock.calls[0]?.[0] || '');
    expect(output).toContain('"apiKey":"***"');
    expect(output).toContain('"cookie":"***"');
    expect(output).toContain('"total_tokens":42');
    expect(output).toContain('"prompt_tokens":12');
    expect(output).not.toContain('123456');
  });
});
