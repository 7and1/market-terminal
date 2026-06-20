import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { chatJson, createAIClient, createChatCompletion } from '@/lib/ai';
import { clearServerCaches } from '@/lib/server-cache';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearServerCaches();
});

describe('ai provider client', () => {
  it('builds the OpenRouter chat completions URL from the configured base URL', () => {
    expect(
      createAIClient({
        apiKey: 'test-key',
        baseURL: 'https://openrouter.ai/api/v1/',
        model: 'test-model',
      }),
    ).toEqual({
      chatCompletionsUrl: 'https://openrouter.ai/api/v1/chat/completions',
    });
  });

  it('posts chat completions with explicit OpenRouter-compatible fetch', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createChatCompletion({
      config: {
        apiKey: 'test-key',
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'test-model',
      },
      system: 'Return one word: ok',
      user: 'Health check.',
      temperature: 0,
      maxTokens: 24,
      cacheTtlMs: 0,
    });

    expect(result).toEqual({
      content: 'ok',
      finishReason: 'stop',
      model: 'test-model',
      usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
          'X-Title': 'TrendAnalysis.ai',
        }),
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'test-model',
      temperature: 0,
      max_tokens: 24,
      messages: [
        { role: 'system', content: 'Return one word: ok' },
        { role: 'user', content: 'Health check.' },
      ],
    });
  });

  it('retries a fallback model when the primary model is region-blocked', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('This model is not available in your region.', { status: 403 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
            usage: { total_tokens: 3 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createChatCompletion({
      config: {
        apiKey: 'test-key',
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'region-blocked-model',
        fallbackModels: ['fallback-model'],
      },
      system: 'Return one word: ok',
      user: 'Health check.',
      cacheTtlMs: 0,
    });

    expect(result.model).toBe('fallback-model');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toMatchObject({
      model: 'region-blocked-model',
    });
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toMatchObject({
      model: 'fallback-model',
    });
  });

  it('classifies OpenRouter HTTP failures without leaking provider internals into control flow', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('This model is not available in your region.', { status: 403 })),
    );

    await expect(
      createChatCompletion({
        config: {
          apiKey: 'test-key',
          baseURL: 'https://openrouter.ai/api/v1',
          model: 'test-model',
        },
        system: 'Return one word: ok',
        user: 'Health check.',
        cacheTtlMs: 0,
      }),
    ).rejects.toMatchObject({
      provider: 'openrouter',
      code: 'auth',
      status: 403,
    });
  });

  it('does not auto-close truncated JSON when the model hit the length limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"items":["valid item"' }, finish_reason: 'length' }],
            usage: { total_tokens: 9 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(
      chatJson({
        config: {
          apiKey: 'test-key',
          baseURL: 'https://openrouter.ai/api/v1',
          model: 'test-model',
        },
        schema: z.object({ items: z.array(z.string()).min(1) }),
        system: 'Return JSON',
        user: 'Return one item',
      }),
    ).rejects.toThrow(/finish_reason=length/);
  });

  it('rejects complete-looking JSON when finish_reason signals truncation and refetches next time', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"items":["looks valid"]}' }, finish_reason: 'length' }],
            usage: { total_tokens: 9 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"items":["fresh"]}' }, finish_reason: 'stop' }],
            usage: { total_tokens: 4 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const input = {
      config: {
        apiKey: 'test-key',
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'test-model',
      },
      schema: z.object({ items: z.array(z.string()).min(1) }),
      system: 'Return JSON',
      user: 'Return one item',
    };

    await expect(chatJson(input)).rejects.toThrow(/output was truncated/);
    await expect(chatJson(input)).resolves.toEqual({ items: ['fresh'] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('parses fenced JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '```json\n{"items":["fenced"]}\n```' }, finish_reason: 'stop' }],
            usage: { total_tokens: 4 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(
      chatJson({
        config: {
          apiKey: 'test-key',
          baseURL: 'https://openrouter.ai/api/v1',
          model: 'test-model',
        },
        schema: z.object({ items: z.array(z.string()).min(1) }),
        system: 'Return JSON',
        user: 'Return one item',
      }),
    ).resolves.toEqual({ items: ['fenced'] });
  });

  it('extracts balanced JSON from prefixed model prose', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Sure, here is the JSON:\n{"items":["balanced"]}\nThanks.' }, finish_reason: 'stop' }],
            usage: { total_tokens: 7 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(
      chatJson({
        config: {
          apiKey: 'test-key',
          baseURL: 'https://openrouter.ai/api/v1',
          model: 'test-model',
        },
        schema: z.object({ items: z.array(z.string()).min(1) }),
        system: 'Return JSON',
        user: 'Return one item',
      }),
    ).resolves.toEqual({ items: ['balanced'] });
  });

  it('does not keep schema-mismatched JSON in the chat completion cache', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"items":[]}' }, finish_reason: 'stop' }],
            usage: { total_tokens: 3 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"items":["valid"]}' }, finish_reason: 'stop' }],
            usage: { total_tokens: 4 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const input = {
      config: {
        apiKey: 'test-key',
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'test-model',
      },
      schema: z.object({ items: z.array(z.string()).min(1) }),
      system: 'Return JSON',
      user: 'Return one item',
    };

    await expect(chatJson(input)).rejects.toThrow(/schema mismatch/);
    await expect(chatJson(input)).resolves.toEqual({ items: ['valid'] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not keep malformed JSON in the chat completion cache', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'not json' }, finish_reason: 'stop' }],
            usage: { total_tokens: 3 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"items":["fresh"]}' }, finish_reason: 'stop' }],
            usage: { total_tokens: 4 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const input = {
      config: {
        apiKey: 'test-key',
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'test-model',
      },
      schema: z.object({ items: z.array(z.string()).min(1) }),
      system: 'Return JSON',
      user: 'Return one item',
    };

    await expect(chatJson(input)).rejects.toThrow(/valid JSON/);
    await expect(chatJson(input)).resolves.toEqual({ items: ['fresh'] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
