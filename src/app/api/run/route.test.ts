import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasBrightData = vi.fn();
const hasDb = vi.fn();
const getAIConfig = vi.fn();
const chatJson = vi.fn();
const createSession = vi.fn();
const updateStep = vi.fn();
const updateStatus = vi.fn();
const insertEvent = vi.fn();
const materializeSessionEvidence = vi.fn();
const checkRateLimitCounter = vi.fn();
const findApprovedDynamicCatalogHeadForTopic = vi.fn();
const selectStageModel = vi.fn();
const runSearchStage = vi.fn();
const buildEvidenceHybrid = vi.fn();
const summarizeEvidence = vi.fn();
const getProviderUsage = vi.fn();

vi.mock('@/lib/env', () => ({
  env: {
    ai: {
      allowClientApiKeys: false,
      openrouter: {
        modelPlan: '',
        modelSummaries: '',
        modelArtifacts: '',
      },
    },
    pipeline: {
      minEvidenceForReady: 3,
      deepScrapeCount: 8,
      rawDocReuseHours: 6,
    },
  },
  hasBrightData,
  hasDb,
}));

vi.mock('@/lib/ai', () => ({
  getAIConfig,
  chatJson,
}));

vi.mock('@/lib/db', () => ({
  createSession,
  updateStep,
  updateStatus,
  insertEvent,
  materializeSessionEvidence,
  checkRateLimitCounter,
  findApprovedDynamicCatalogHeadForTopic,
}));

vi.mock('@/lib/modelRouting', () => ({
  selectStageModel,
}));

vi.mock('@/lib/budget-guard', () => ({
  getProviderUsage,
}));

vi.mock('@/lib/run-pipeline/stages/search', () => ({
  runSearchStage,
}));

vi.mock('@/lib/run-pipeline/stages/evidence', () => ({
  buildEvidenceHybrid,
  summarizeEvidence,
}));

async function readSseEvents(response: Response) {
  const text = await response.text();
  return text
    .split('\n\n')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const eventLine = chunk.split('\n').find((line) => line.startsWith('event: '));
      const dataLine = chunk.split('\n').find((line) => line.startsWith('data: '));
      return {
        event: eventLine?.replace('event: ', '') || '',
        data: dataLine ? JSON.parse(dataLine.replace('data: ', '')) : null,
      };
    });
}

describe('/api/run POST', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    delete process.env.TRUST_PROXY_HEADERS;
    delete process.env.DATABASE_URL;
    hasBrightData.mockReturnValue(false);
    hasDb.mockReturnValue(false);
    getAIConfig.mockReturnValue(null);
    selectStageModel.mockReturnValue(undefined);
    runSearchStage.mockResolvedValue([]);
    buildEvidenceHybrid.mockResolvedValue([]);
    summarizeEvidence.mockImplementation(async ({ evidence }: { evidence: unknown[] }) => evidence);
    getProviderUsage.mockResolvedValue({ ok: true, calls: 1, limit: 2000 });
    createSession.mockResolvedValue(undefined);
    updateStep.mockResolvedValue(undefined);
    updateStatus.mockResolvedValue(undefined);
    insertEvent.mockResolvedValue(undefined);
    materializeSessionEvidence.mockResolvedValue(undefined);
    checkRateLimitCounter.mockResolvedValue({ allowed: true, remaining: 9, limit: 10, resetMs: 60_000 });
    findApprovedDynamicCatalogHeadForTopic.mockResolvedValue(null);
  });

  it('returns 400 for invalid request bodies', async () => {
    const { POST } = await import('@/app/api/run/route');
    const response = await POST(
      new Request('http://localhost/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Invalid request body');
  });

  it('returns 422 for clearly off-domain queries', async () => {
    const { POST } = await import('@/app/api/run/route');
    const response = await POST(
      new Request('http://localhost/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: 'What is the weather tomorrow in New York?' }),
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Off-domain query',
      code: 'OFF_DOMAIN_QUERY',
      scope: 'market-only',
    });
  });

  it('returns localized off-domain guidance when locale is provided', async () => {
    const { POST } = await import('@/app/api/run/route');
    const response = await POST(
      new Request('http://localhost/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: '明天的天气怎么样？', locale: 'zh' }),
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: 'OFF_DOMAIN_QUERY',
      message: '这个工作区用于市场研究，不提供独立天气预报。请改成询问天气对某个资产、商品或板块的影响。',
      supportedExamples: [
        '为什么 BTC 今天下跌？',
        '是什么推动了 NVDA 财报后的走势？',
        '收益率现在如何影响黄金？',
        '明天的天气会影响天然气价格吗？',
      ],
    });
  });

  it('keeps market-adjacent weather impact queries eligible for the pipeline', async () => {
    process.env.DATABASE_URL = 'postgres://snapshot:test@localhost:5432/app';
    const { POST } = await import('@/app/api/run/route');
    const response = await POST(
      new Request('http://localhost/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: 'Will tomorrow weather affect natural gas prices?', mode: 'fast' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('mt_snapshot_');
  });

  it('emits an error SSE run when Bright Data is unavailable', async () => {
    const { POST } = await import('@/app/api/run/route');
    const response = await POST(
      new Request('http://localhost/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: 'Bitcoin', mode: 'fast' }),
      }),
    );

    expect(response.status).toBe(200);
    const events = await readSseEvents(response);
    const eventNames = events.map((item) => item.event);

    expect(eventNames).toContain('session');
    expect(eventNames).toContain('plan');
    expect(eventNames).toContain('perf.summary');
    expect(eventNames).toContain('error');
    expect(eventNames).not.toContain('ready');
    expect(eventNames).not.toContain('done');
    expect(eventNames.indexOf('perf.summary')).toBeLessThan(eventNames.indexOf('error'));
  });

  it('retries session creation when the first database insert attempt fails', async () => {
    process.env.DATABASE_URL = 'postgres://snapshot:test@localhost:5432/app';
    hasDb.mockReturnValue(true);
    createSession.mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'));
    createSession.mockResolvedValue(undefined);

    const { POST } = await import('@/app/api/run/route');
    const response = await POST(
      new Request('http://localhost/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: 'Bitcoin', mode: 'fast' }),
      }),
    );

    expect(response.status).toBe(200);
    await response.text();
    expect(createSession).toHaveBeenCalledTimes(2);
  });

  it('emits perf.summary before error on pipeline failure', async () => {
    hasBrightData.mockReturnValue(true);
    runSearchStage.mockRejectedValueOnce(new Error('search exploded'));

    const { POST } = await import('@/app/api/run/route');
    const response = await POST(
      new Request('http://localhost/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: 'Gold', mode: 'fast' }),
      }),
    );

    const events = await readSseEvents(response);
    const eventNames = events.map((item) => item.event);

    expect(eventNames).toContain('perf.summary');
    expect(eventNames).toContain('error');
    expect(eventNames.indexOf('perf.summary')).toBeLessThan(eventNames.indexOf('error'));
  });

  it('rate limits repeated requests and returns limit headers', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    const { POST } = await import('@/app/api/run/route');
    const makeRequest = () =>
      new Request('http://localhost/api/run', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.10',
        },
        body: JSON.stringify({ topic: 'What is the weather tomorrow in New York?' }),
      });

    for (let idx = 0; idx < 10; idx += 1) {
      const response = await POST(makeRequest());
      expect(response.status).toBe(422);
      expect(response.headers.get('x-ratelimit-limit')).toBe('10');
    }

    const blocked = await POST(makeRequest());
    expect(blocked.status).toBe(429);
    await expect(blocked.json()).resolves.toMatchObject({
      error: 'Too many requests',
    });
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect(blocked.headers.get('x-ratelimit-remaining')).toBe('0');
  });

  it('rejects refresh requests whose report head does not match the typed topic', async () => {
    const { POST } = await import('@/app/api/run/route');
    const response = await POST(
      new Request('http://localhost/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'Gold vs Ethereum today',
          runReason: 'refresh',
          reportKey: 'bitcoin-price-move',
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain('Invalid refresh target');
  });

  it('preserves an approved dynamic catalog report key when starting a run', async () => {
    process.env.DATABASE_URL = 'postgres://snapshot:test@localhost:5432/app';
    hasDb.mockReturnValue(true);
    findApprovedDynamicCatalogHeadForTopic.mockResolvedValue({
      key: 'ai-healthcare-stocks',
      label: 'AI Healthcare Stocks',
      assetKey: 'ai-healthcare-stocks',
      reportKey: 'ai-healthcare-stocks-general',
      publicSurface: 'asset_hub',
      priorityTier: 'secondary',
      aliases: ['AI healthcare stocks'],
      status: 'approved',
      score: 3,
      meta: {},
      createdAt: '2026-03-26T10:00:00.000Z',
      updatedAt: '2026-03-26T10:00:00.000Z',
    });

    const { POST } = await import('@/app/api/run/route');
    const response = await POST(
      new Request('http://localhost/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'AI healthcare stocks',
          mode: 'fast',
          reportKey: 'ai-healthcare-stocks-general',
        }),
      }),
    );

    expect(response.status).toBe(200);
    await response.text();
    expect(findApprovedDynamicCatalogHeadForTopic).toHaveBeenCalledWith('AI healthcare stocks');
    expect(createSession).toHaveBeenCalledWith(
      expect.any(String),
      'AI healthcare stocks',
      'running',
      'plan',
      0.05,
      expect.objectContaining({
        reportKey: 'ai-healthcare-stocks-general',
        assetKey: 'ai-healthcare-stocks',
      }),
      'ai-healthcare-stocks-general',
    );
  });
});
