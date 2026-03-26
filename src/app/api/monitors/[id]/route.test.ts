import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasDb = vi.fn();
const getMonitor = vi.fn();
const updateMonitor = vi.fn();
const toPublicMonitor = vi.fn();

vi.mock('@/lib/db', () => ({
  hasDb,
  getMonitor,
  updateMonitor,
  toPublicMonitor,
}));

describe('/api/monitors/[id] PATCH', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hasDb.mockReturnValue(true);
    toPublicMonitor.mockImplementation((monitor) => monitor ? { ...monitor, notifyWebhookUrl: null, hasNotifyWebhook: Boolean(monitor.notifyWebhookUrl) } : null);
  });

  it('returns 404 when the monitor does not exist', async () => {
    getMonitor.mockResolvedValue(null);

    const { PATCH } = await import('@/app/api/monitors/[id]/route');
    const response = await PATCH(
      new Request('http://localhost/api/monitors/id', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ id: '1cb63266-2f69-4bb6-97c2-2d62e5f14df5' }) },
    );

    expect(response.status).toBe(404);
  });

  it('updates a monitor', async () => {
    getMonitor.mockResolvedValue({ id: 'm1' });
    updateMonitor.mockResolvedValue({ id: 'm1', active: false, notifyWebhookUrl: 'https://hooks.example/secret' });

    const { PATCH } = await import('@/app/api/monitors/[id]/route');
    const response = await PATCH(
      new Request('http://localhost/api/monitors/id', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: false, cadenceMinutes: 360 }),
      }),
      { params: Promise.resolve({ id: '1cb63266-2f69-4bb6-97c2-2d62e5f14df5' }) },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(updateMonitor).toHaveBeenCalledWith(
      '1cb63266-2f69-4bb6-97c2-2d62e5f14df5',
      expect.objectContaining({ active: false, cadenceMinutes: 360 }),
    );
    expect(json.monitor).toMatchObject({ id: 'm1', notifyWebhookUrl: null, hasNotifyWebhook: true });
  });
});
