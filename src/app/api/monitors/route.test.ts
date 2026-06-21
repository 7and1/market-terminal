import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasDb = vi.fn();
const listMonitors = vi.fn();
const createMonitor = vi.fn();
const toPublicMonitor = vi.fn();

vi.mock('@/lib/db', () => ({
  hasDb,
  listMonitors,
  createMonitor,
  toPublicMonitor,
}));

describe('/api/monitors', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.OPERATOR_TOKEN = 'operator-secret';
    hasDb.mockReturnValue(true);
    toPublicMonitor.mockImplementation((monitor) => monitor ? { ...monitor, notifyWebhookUrl: null, hasNotifyWebhook: Boolean(monitor.notifyWebhookUrl) } : null);
  });

  it('returns 403 without operator auth', async () => {
    const { GET } = await import('@/app/api/monitors/route');
    const response = await GET(new Request('http://localhost/api/monitors'));

    expect(response.status).toBe(403);
  });

  it('returns 403 instead of throwing on malformed operator cookie values', async () => {
    const { GET } = await import('@/app/api/monitors/route');
    const response = await GET(
      new Request('http://localhost/api/monitors', {
        headers: {
          cookie: 'mt_operator_token=%E0%A4%A',
        },
      }),
    );

    expect(response.status).toBe(403);
  });

  it('lists monitors', async () => {
    listMonitors.mockResolvedValue([{ id: 'm1', name: 'BTC Watch', notifyWebhookUrl: 'https://hooks.example/secret' }]);

    const { GET } = await import('@/app/api/monitors/route');
    const response = await GET(
      new Request('http://localhost/api/monitors', {
        headers: { 'x-operator-token': 'operator-secret' },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.monitors).toHaveLength(1);
    expect(json.monitors[0]).toMatchObject({ notifyWebhookUrl: null, hasNotifyWebhook: true });
  });

  it('creates a monitor', async () => {
    createMonitor.mockResolvedValue({ id: 'm1', name: 'BTC Watch', notifyWebhookUrl: 'https://hooks.example/secret' });

    const { POST } = await import('@/app/api/monitors/route');
    const response = await POST(
      new Request('http://localhost/api/monitors', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-operator-token': 'operator-secret' },
        body: JSON.stringify({
          name: 'BTC Watch',
          topic: 'Bitcoin macro drivers',
          mode: 'deep',
          cadenceMinutes: 60,
        }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(createMonitor).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'BTC Watch',
        cadenceMinutes: 60,
        runIntent: 'monitor',
      }),
    );
    expect(json.monitor).toMatchObject({ id: 'm1', notifyWebhookUrl: null, hasNotifyWebhook: true });
  });
});
