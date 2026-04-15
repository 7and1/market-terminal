import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasDb = vi.fn();
const getMonitor = vi.fn();
const listMonitorRuns = vi.fn();
const toPublicMonitor = vi.fn();

vi.mock('@/lib/db', () => ({
  hasDb,
  getMonitor,
  listMonitorRuns,
  toPublicMonitor,
}));

describe('/api/monitors/[id]/runs GET', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.OPERATOR_TOKEN = 'operator-secret';
    hasDb.mockReturnValue(true);
    toPublicMonitor.mockImplementation((monitor) => monitor ? { ...monitor, notifyWebhookUrl: null, hasNotifyWebhook: Boolean(monitor.notifyWebhookUrl) } : null);
  });

  it('returns 403 without operator auth', async () => {
    const { GET } = await import('@/app/api/monitors/[id]/runs/route');
    const response = await GET(
      new Request('http://x/r?limit=5'),
      { params: Promise.resolve({ id: '1cb63266-2f69-4bb6-97c2-2d62e5f14df5' }) },
    );

    expect(response.status).toBe(403);
  });

  it('returns monitor runs', async () => {
    getMonitor.mockResolvedValue({ id: 'm1', name: 'BTC Watch', notifyWebhookUrl: 'https://hooks.example/secret' });
    listMonitorRuns.mockResolvedValue([{ id: 'r1', status: 'ready' }]);

    const { GET } = await import('@/app/api/monitors/[id]/runs/route');
    const response = await GET(
      new Request('http://x/r?limit=5', {
        headers: { 'x-operator-token': 'operator-secret' },
      }),
      { params: Promise.resolve({ id: '1cb63266-2f69-4bb6-97c2-2d62e5f14df5' }) },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(listMonitorRuns).toHaveBeenCalledWith('1cb63266-2f69-4bb6-97c2-2d62e5f14df5', 5);
    expect(json.runs).toHaveLength(1);
    expect(json.monitor).toMatchObject({ id: 'm1', notifyWebhookUrl: null, hasNotifyWebhook: true });
  });
});
