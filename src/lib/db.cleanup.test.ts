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

describe('deleteExpired', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://example.test/db';
    query.mockResolvedValue({ rowCount: 3 });
  });

  it('keeps completed unpublished sessions and deletes only stale non-ready ones', async () => {
    const { deleteExpired } = await import('@/lib/db');

    await expect(deleteExpired()).resolves.toBe(3);
    expect(query).toHaveBeenCalledTimes(1);

    const sql = String(query.mock.calls[0]?.[0] || '');
    expect(sql).toContain(`WHERE published IS NOT TRUE`);
    expect(sql).toContain(`AND status <> 'ready'`);
    expect(sql).toContain(`AND created_at < NOW() - INTERVAL '24 hours'`);
  });
});
