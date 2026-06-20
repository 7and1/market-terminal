import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasDb = vi.fn();
const upsertSubscriber = vi.fn();
const isSubscriptionEmailConfigured = vi.fn();
const sendSubscriptionConfirmation = vi.fn();
const checkRouteRateLimit = vi.fn();
const isSeededAssetKey = vi.fn();

vi.mock('@/lib/db', () => ({
  hasDb,
  upsertSubscriber,
}));

vi.mock('@/lib/email', () => ({
  isSubscriptionEmailConfigured,
  sendSubscriptionConfirmation,
}));

vi.mock('@/lib/route-rate-limit', () => ({
  applyRateLimitHeaders: (target: Headers, headers: Record<string, string>) => {
    for (const [key, value] of Object.entries(headers)) target.set(key, value);
  },
  checkRouteRateLimit,
}));

vi.mock('@/lib/topic-catalog', () => ({
  isSeededAssetKey,
}));

describe('/api/subscribe POST', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.NEXT_PUBLIC_SITE_URL;
    checkRouteRateLimit.mockResolvedValue({
      ok: true,
      headers: { 'X-RateLimit-Limit': '5', 'X-RateLimit-Remaining': '4', 'X-RateLimit-Reset': '60' },
    });
    hasDb.mockReturnValue(true);
    isSubscriptionEmailConfigured.mockReturnValue(true);
    isSeededAssetKey.mockImplementation((key) => key === 'bitcoin');
    upsertSubscriber.mockResolvedValue({ status: 'pending' });
    sendSubscriptionConfirmation.mockResolvedValue(undefined);
  });

  it('returns 503 when email is not configured', async () => {
    isSubscriptionEmailConfigured.mockReturnValue(false);

    const { POST } = await import('@/app/api/subscribe/route');
    const response = await POST(
      new Request('http://localhost/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reader@example.com', assetKey: 'bitcoin' }),
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('5');
    await expect(response.json()).resolves.toMatchObject({ configured: false });
    expect(upsertSubscriber).not.toHaveBeenCalled();
  });

  it('rejects unknown assets before creating a subscriber', async () => {
    const { POST } = await import('@/app/api/subscribe/route');
    const response = await POST(
      new Request('http://localhost/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reader@example.com', assetKey: 'not-listed' }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNKNOWN_ASSET' });
    expect(upsertSubscriber).not.toHaveBeenCalled();
    expect(sendSubscriptionConfirmation).not.toHaveBeenCalled();
  });

  it('creates a pending subscriber and sends a confirmation email', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://trendanalysis.ai';

    const { POST } = await import('@/app/api/subscribe/route');
    const response = await POST(
      new Request('http://localhost/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'Reader@Example.com', assetKey: 'Bitcoin' }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(json).toEqual({ ok: true, status: 'pending' });
    expect(upsertSubscriber).toHaveBeenCalledWith({
      email: 'reader@example.com',
      assetKey: 'bitcoin',
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(sendSubscriptionConfirmation).toHaveBeenCalledWith({
      to: 'reader@example.com',
      assetKey: 'bitcoin',
      confirmUrl: expect.stringContaining('https://trendanalysis.ai/api/subscribe/confirm?token='),
      unsubscribeUrl: expect.stringContaining('https://trendanalysis.ai/api/subscribe/unsubscribe?token='),
    });
  });
});
