import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildCacheKey,
  clearServerCaches,
  getOrComputeCached,
  invalidateServerCache,
} from '@/lib/server-cache';

describe('server-cache', () => {
  afterEach(() => {
    clearServerCaches();
  });

  it('escapes string cache key parts to avoid delimiter collisions', () => {
    expect(buildCacheKey(['a::b', 'c'])).not.toBe(buildCacheKey(['a', 'b::c']));
    expect(buildCacheKey(['plain'])).toBe('7:"plain"');
  });

  it('keeps nullish and structured parts distinct', () => {
    expect(buildCacheKey([null])).not.toBe(buildCacheKey([undefined]));
    expect(buildCacheKey([{ a: 'b::c' }, 'd'])).not.toBe(buildCacheKey([{ a: 'b' }, 'c::d']));
  });

  it('invalidates one cached key without clearing unrelated entries', async () => {
    const firstLoader = vi.fn(async () => 'first');
    const secondLoader = vi.fn(async () => 'second');

    await expect(getOrComputeCached({ key: 'a', ttlMs: 60_000, loader: firstLoader })).resolves
      .toBe('first');
    await expect(getOrComputeCached({ key: 'b', ttlMs: 60_000, loader: secondLoader })).resolves
      .toBe('second');
    invalidateServerCache('a');

    await expect(getOrComputeCached({ key: 'a', ttlMs: 60_000, loader: async () => 'new-first' })).resolves
      .toBe('new-first');
    await expect(getOrComputeCached({ key: 'b', ttlMs: 60_000, loader: async () => 'new-second' })).resolves
      .toBe('second');
  });

  it('skips storing values rejected by shouldCache while still returning them', async () => {
    const loader = vi.fn()
      .mockResolvedValueOnce('skip')
      .mockResolvedValueOnce('keep');

    await expect(getOrComputeCached({
      key: 'conditional',
      ttlMs: 60_000,
      loader,
      shouldCache: (value) => value !== 'skip',
    })).resolves.toBe('skip');

    await expect(getOrComputeCached({
      key: 'conditional',
      ttlMs: 60_000,
      loader,
      shouldCache: (value) => value !== 'skip',
    })).resolves.toBe('keep');

    await expect(getOrComputeCached({
      key: 'conditional',
      ttlMs: 60_000,
      loader,
      shouldCache: (value) => value !== 'skip',
    })).resolves.toBe('keep');
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
