import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasDb = vi.fn();
const triggerMonitorRun = vi.fn();
const toPublicMonitor = vi.fn();

vi.mock('@/lib/db', () => ({
  hasDb,
  toPublicMonitor,
}));

vi.mock('@/lib/monitoring', () => ({
  triggerMonitorRun,
}));

describe('/api/monitors/[id]/run POST', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.OPERATOR_TOKEN = 'operator-secret';
    hasDb.mockReturnValue(true);
    toPublicMonitor.mockImplementation((monitor) => monitor ? { ...monitor, notifyWebhookUrl: null, hasNotifyWebhook: Boolean(monitor.notifyWebhookUrl) } : null);
  });

  it('returns 403 without operator auth', async () => {
    const { POST } = await import('@/app/api/monitors/[id]/run/route');
    const response = await POST(
      new Request('http://localhost/api/monitors/id/run', { method: 'POST' }),
      { params: Promise.resolve({ id: '1cb63266-2f69-4bb6-97c2-2d62e5f14df5' }) },
    );

    expect(response.status).toBe(403);
  });

  it('returns 409 when the monitor already has an active run', async () => {
    triggerMonitorRun.mockResolvedValue({ status: 'conflict', run: null, monitor: { id: 'm1' } });

    const { POST } = await import('@/app/api/monitors/[id]/run/route');
    const response = await POST(
      new Request('http://localhost/api/monitors/id/run', {
        method: 'POST',
        headers: { 'x-operator-token': 'operator-secret' },
      }),
      { params: Promise.resolve({ id: '1cb63266-2f69-4bb6-97c2-2d62e5f14df5' }) },
    );

    expect(response.status).toBe(409);
  });

  it('queues a monitor run', async () => {
    triggerMonitorRun.mockResolvedValue({
      status: 'queued',
      monitor: { id: 'm1', name: 'BTC Watch', notifyWebhookUrl: 'https://hooks.example/secret' },
      run: { id: 'r1', status: 'queued' },
    });

    const { POST } = await import('@/app/api/monitors/[id]/run/route');
    const response = await POST(
      new Request('http://localhost/api/monitors/id/run', {
        method: 'POST',
        headers: { 'x-operator-token': 'operator-secret' },
      }),
      { params: Promise.resolve({ id: '1cb63266-2f69-4bb6-97c2-2d62e5f14df5' }) },
    );
    const json = await response.json();

    expect(response.status).toBe(202);
    expect(json.run.id).toBe('r1');
    expect(json.monitor).toMatchObject({ id: 'm1', notifyWebhookUrl: null, hasNotifyWebhook: true });
  });
});
