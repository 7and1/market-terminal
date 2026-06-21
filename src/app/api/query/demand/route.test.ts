import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasDb = vi.fn();
const listQueryDemand = vi.fn();

vi.mock('@/lib/db', () => ({
  hasDb,
  listQueryDemand,
}));

describe('/api/query/demand GET', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.OPERATOR_TOKEN = 'operator-secret';
    hasDb.mockReturnValue(true);
    listQueryDemand.mockResolvedValue([
      {
        normalized: 'ai healthcare stocks',
        sampleInput: 'AI healthcare stocks',
        count: 3,
        rejectCount: 1,
        privateCount: 2,
        ambiguousCount: 0,
        surfaces: ['landing'],
        locales: ['en'],
        firstSeenAt: '2026-03-01T00:00:00.000Z',
        latestSeenAt: '2026-03-03T00:00:00.000Z',
      },
    ]);
  });

  it('requires operator auth', async () => {
    const { GET } = await import('@/app/api/query/demand/route');
    const response = await GET(new Request('http://localhost/api/query/demand'));

    expect(response.status).toBe(403);
    expect(listQueryDemand).not.toHaveBeenCalled();
  });

  it('returns bounded demand rows for operators', async () => {
    const { GET } = await import('@/app/api/query/demand/route');
    const response = await GET(
      new Request('http://localhost/api/query/demand?days=14&limit=12', {
        headers: { 'x-operator-token': 'operator-secret' },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(listQueryDemand).toHaveBeenCalledWith({ days: 14, limit: 12 });
    expect(json).toMatchObject({
      windowDays: 14,
      items: [
        {
          normalized: 'ai healthcare stocks',
          count: 3,
          privateCount: 2,
        },
      ],
    });
  });

  it('returns 400 when database is unavailable', async () => {
    hasDb.mockReturnValue(false);

    const { GET } = await import('@/app/api/query/demand/route');
    const response = await GET(
      new Request('http://localhost/api/query/demand', {
        headers: { 'x-operator-token': 'operator-secret' },
      }),
    );

    expect(response.status).toBe(400);
    expect(listQueryDemand).not.toHaveBeenCalled();
  });
});
