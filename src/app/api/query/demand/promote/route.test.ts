import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasDb = vi.fn();
const upsertDynamicCatalogHead = vi.fn();
const upsertQueryAlias = vi.fn();
const clearServerCaches = vi.fn();
const normalizeKey = (raw: string) => raw
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, ' ')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '') || 'market';
const normalizeDynamicCatalogKey = vi.fn(normalizeKey);

vi.mock('@/lib/db', () => ({
  hasDb,
  normalizeDynamicCatalogKey,
  upsertDynamicCatalogHead,
  upsertQueryAlias,
}));

vi.mock('@/lib/server-cache', () => ({
  clearServerCaches,
}));

describe('/api/query/demand/promote POST', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.OPERATOR_TOKEN = 'operator-secret';
    hasDb.mockReturnValue(true);
    normalizeDynamicCatalogKey.mockImplementation(normalizeKey);
    upsertDynamicCatalogHead.mockResolvedValue({
      key: 'ai-healthcare-stocks',
      label: 'AI Healthcare Stocks',
      assetKey: 'ai-healthcare-stocks',
      reportKey: 'ai-healthcare-stocks-general',
      publicSurface: 'asset_hub',
      priorityTier: 'secondary',
      aliases: ['AI Healthcare Stocks', 'ai-healthcare-stocks'],
      status: 'approved',
      score: 3,
      meta: {},
      createdAt: '2026-03-26T10:00:00.000Z',
      updatedAt: '2026-03-26T10:00:00.000Z',
    });
    upsertQueryAlias.mockResolvedValue(null);
  });

  it('requires operator auth', async () => {
    const { POST } = await import('@/app/api/query/demand/promote/route');
    const response = await POST(new Request('http://localhost/api/query/demand/promote', {
      method: 'POST',
      body: JSON.stringify({ label: 'AI Healthcare Stocks' }),
    }));

    expect(response.status).toBe(403);
    expect(upsertDynamicCatalogHead).not.toHaveBeenCalled();
  });

  it('promotes a demand row into an approved dynamic catalog head', async () => {
    const { POST } = await import('@/app/api/query/demand/promote/route');
    const response = await POST(new Request('http://localhost/api/query/demand/promote', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-operator-token': 'operator-secret',
      },
      body: JSON.stringify({
        label: 'AI Healthcare Stocks',
        aliases: ['ai healthcare stocks'],
        score: 3,
      }),
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(upsertDynamicCatalogHead).toHaveBeenCalledWith(expect.objectContaining({
      key: 'ai-healthcare-stocks',
      label: 'AI Healthcare Stocks',
      assetKey: 'ai-healthcare-stocks',
      reportKey: 'ai-healthcare-stocks-general',
      status: 'approved',
      score: 3,
    }));
    expect(upsertQueryAlias).toHaveBeenCalledWith(expect.objectContaining({
      aliasKey: 'ai-healthcare-stocks',
      targetType: 'asset',
      assetKey: 'ai-healthcare-stocks',
      source: 'manual',
    }));
    expect(clearServerCaches).toHaveBeenCalledTimes(1);
    expect(json).toMatchObject({
      item: {
        key: 'ai-healthcare-stocks',
        status: 'approved',
      },
    });
  });
});
