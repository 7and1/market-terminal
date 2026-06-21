import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSnapshotAuthCookie } from '@/lib/session-write-auth';

const hasDb = vi.fn();
const getSession = vi.fn();
const listEventsPage = vi.fn();

vi.mock('@/lib/db', () => ({
  hasDb,
  getSession,
  listEventsPage,
}));

describe('/api/sessions/events GET', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.DATABASE_URL = 'postgres://snapshot:test@localhost:5432/app';
  });

  it('returns cursor-based event pages', async () => {
    hasDb.mockReturnValue(true);
    const sessionId = '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f';
    getSession.mockResolvedValue({
      sessionId,
      topic: 'Bitcoin',
      status: 'ready',
      step: 'ready',
      progress: 1,
      meta: {},
      published: false,
      _creationTime: Date.UTC(2026, 2, 18),
    });
    listEventsPage.mockResolvedValue({
      items: [
        {
          id: 11,
          sessionId,
          type: 'step',
          payload: { step: 'ready' },
          created_at: new Date(Date.UTC(2026, 2, 18)).toISOString(),
        },
      ],
      nextCursor: 'cursor-12',
      hasMore: true,
    });

    const { GET } = await import('@/app/api/sessions/events/route');
    const response = await GET(
      new Request(
        'http://localhost/api/sessions/events?sessionId=8d0e2f3d-a338-46a8-bfdc-a626751f6e5f&limit=1&cursor=cursor-11',
        {
          headers: {
            cookie: createSnapshotAuthCookie(sessionId) || '',
          },
        },
      ),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(listEventsPage).toHaveBeenCalledWith({
      sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f',
      limit: 1,
      cursor: 'cursor-11',
    });
    expect(json.pageInfo).toEqual({ nextCursor: 'cursor-12', hasMore: true });
    expect(json.events).toHaveLength(1);
  });

  it('returns 403 when the caller does not own the session', async () => {
    hasDb.mockReturnValue(true);
    const sessionId = '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f';
    getSession.mockResolvedValue({
      sessionId,
      topic: 'Bitcoin',
      status: 'ready',
      step: 'ready',
      progress: 1,
      meta: {},
      published: false,
      _creationTime: Date.UTC(2026, 2, 18),
    });

    const { GET } = await import('@/app/api/sessions/events/route');
    const response = await GET(
      new Request('http://localhost/api/sessions/events?sessionId=8d0e2f3d-a338-46a8-bfdc-a626751f6e5f'),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.code).toBe('SESSION_PRIVATE');
    expect(listEventsPage).not.toHaveBeenCalled();
  });

  it('allows anonymous replay for published sessions', async () => {
    hasDb.mockReturnValue(true);
    const sessionId = '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f';
    getSession.mockResolvedValue({
      sessionId,
      topic: 'Bitcoin',
      status: 'ready',
      step: 'ready',
      progress: 1,
      meta: {},
      published: true,
      _creationTime: Date.UTC(2026, 2, 18),
    });
    listEventsPage.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    });

    const { GET } = await import('@/app/api/sessions/events/route');
    const response = await GET(
      new Request('http://localhost/api/sessions/events?sessionId=8d0e2f3d-a338-46a8-bfdc-a626751f6e5f'),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.session.published).toBe(true);
    expect(listEventsPage).toHaveBeenCalledWith({
      sessionId,
      limit: 250,
      cursor: undefined,
    });
  });

  it('returns 404 when the session is missing', async () => {
    hasDb.mockReturnValue(true);
    getSession.mockResolvedValue(null);
    const sessionId = '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f';

    const { GET } = await import('@/app/api/sessions/events/route');
    const response = await GET(
      new Request('http://localhost/api/sessions/events?sessionId=8d0e2f3d-a338-46a8-bfdc-a626751f6e5f', {
        headers: {
          cookie: createSnapshotAuthCookie(sessionId) || '',
        },
      }),
    );

    expect(response.status).toBe(404);
  });
});
