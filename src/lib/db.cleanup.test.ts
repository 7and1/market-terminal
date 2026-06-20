import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(() => ({
      query,
      on: vi.fn(),
    })),
  },
}));

describe('deleteExpired unit smoke', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://example.test/db';
    query.mockResolvedValue({ rowCount: 3 });
  });

  it('returns the deleted session row count', async () => {
    const { deleteExpired } = await import('@/lib/db');

    await expect(deleteExpired()).resolves.toBe(3);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
