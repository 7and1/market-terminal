import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSnapshotAuthCookie } from '@/lib/session-write-auth';

const hasDb = vi.fn();
const getSession = vi.fn();
const patchMeta = vi.fn();
const insertEventBatch = vi.fn();

vi.mock('@/lib/db', () => ({
  hasDb,
  getSession,
  patchMeta,
  insertEventBatch,
}));

describe('/api/sessions/snapshot POST', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hasDb.mockReturnValue(true);
    patchMeta.mockResolvedValue(undefined);
    insertEventBatch.mockResolvedValue(undefined);
    process.env.DATABASE_URL = 'postgres://snapshot:test@localhost:5432/app';
  });

  it('returns 403 when the snapshot write is not authorized', async () => {
    const { POST } = await import('@/app/api/sessions/snapshot/route');
    const response = await POST(
      new Request('http://localhost/api/sessions/snapshot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f',
          price: { ok: true },
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(getSession).not.toHaveBeenCalled();
    expect(patchMeta).not.toHaveBeenCalled();
  });

  it('returns 400 when no snapshot payload is provided', async () => {
    const { POST } = await import('@/app/api/sessions/snapshot/route');
    const response = await POST(
      new Request('http://localhost/api/sessions/snapshot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(patchMeta).not.toHaveBeenCalled();
  });

  it('merges artifacts and appends price/video snapshot events', async () => {
    getSession.mockResolvedValue({
      sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f',
      meta: {
        artifacts: {
          evidence: [{ id: 'ev-1', title: 'Existing evidence' }],
          tape: [{ id: 't-1', title: 'Existing tape' }],
        },
      },
    });

    const price = { ok: true, topic: 'Bitcoin', provider: 'coingecko', series: [1], timestamps: [2] };
    const videos = { topic: 'Bitcoin', fetchedAt: 123, mode: 'brightdata', items: [] };
    const sessionId = '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f';
    const snapshotCookie = createSnapshotAuthCookie(sessionId);

    const { POST } = await import('@/app/api/sessions/snapshot/route');
    const response = await POST(
      new Request('http://localhost/api/sessions/snapshot', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(snapshotCookie ? { cookie: snapshotCookie } : {}),
        },
        body: JSON.stringify({
          sessionId,
          price,
          videos,
        }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(patchMeta).toHaveBeenCalledWith(sessionId, {
      artifacts: {
        evidence: [{ id: 'ev-1', title: 'Existing evidence' }],
        tape: [{ id: 't-1', title: 'Existing tape' }],
        price,
        videos,
      },
    });
    expect(insertEventBatch).toHaveBeenCalledWith([
      {
        sessionId,
        type: 'price.snapshot',
        payload: price,
      },
      {
        sessionId,
        type: 'videos.snapshot',
        payload: videos,
      },
    ]);
  });
});
