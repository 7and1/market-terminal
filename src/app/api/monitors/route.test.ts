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
    hasDb.mockReturnValue(true);
    toPublicMonitor.mockImplementation((monitor) => monitor ? { ...monitor, notifyWebhookUrl: null, hasNotifyWebhook: Boolean(monitor.notifyWebhookUrl) } : null);
  });

  it('lists monitors', async () => {
    listMonitors.mockResolvedValue([{ id: 'm1', name: 'BTC Watch', notifyWebhookUrl: 'https://hooks.example/secret' }]);

    const { GET } = await import('@/app/api/monitors/route');
    const response = await GET();
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
        headers: { 'content-type': 'application/json' },
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
