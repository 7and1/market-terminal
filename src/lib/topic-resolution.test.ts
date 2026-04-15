import { beforeEach, describe, expect, it, vi } from 'vitest';

const getReportHead = vi.fn();
const listPublished = vi.fn();
const listCurrentPublished = vi.fn();
const listQueryAliases = vi.fn();
const updateSessionReportKey = vi.fn();
const upsertQueryAlias = vi.fn();
const upsertReportHead = vi.fn();
const hasDb = vi.fn();
const getAIConfig = vi.fn();
const chatJson = vi.fn();

vi.mock('@/lib/db', () => ({
  getReportHead,
  listPublished,
  listCurrentPublished,
  listQueryAliases,
  updateSessionReportKey,
  upsertQueryAlias,
  upsertReportHead,
}));

vi.mock('@/lib/env', () => ({
  env: {
    features: {
      queryResolution: true,
      queryResolutionTieBreaker: false,
    },
  },
  hasDb,
}));

vi.mock('@/lib/ai', () => ({
  getAIConfig,
  chatJson,
}));

async function loadModule() {
  vi.resetModules();
  return import('@/lib/topic-resolution');
}

function buildCurrentReport({
  topic,
  assetKey,
  reportKey,
  canonicalLabel,
  slug,
}: {
  topic: string;
  assetKey: string;
  reportKey: string;
  canonicalLabel: string;
  slug: string;
}) {
  return {
    session: {
      sessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f',
      topic,
      reportKey,
      status: 'ready',
      step: 'ready',
      progress: 1,
      meta: {},
      published: true,
      slug,
      assetKey,
      _creationTime: Date.UTC(2026, 2, 26, 10, 0),
    },
    head: {
      reportKey,
      canonicalLabel,
      subjectKey: assetKey,
      currentSessionId: '8d0e2f3d-a338-46a8-bfdc-a626751f6e5f',
      currentSlug: slug,
      createdAt: '2026-03-26T10:00:00.000Z',
      updatedAt: '2026-03-26T10:00:00.000Z',
    },
  };
}

describe('topic-resolution', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hasDb.mockReturnValue(true);
    listPublished.mockResolvedValue([]);
    listCurrentPublished.mockResolvedValue([]);
    listQueryAliases.mockResolvedValue([]);
    getReportHead.mockResolvedValue(null);
    getAIConfig.mockReturnValue(null);
  });

  it('rejects clearly off-domain queries', async () => {
    const { resolveTopicQuery } = await loadModule();
    await expect(resolveTopicQuery({ input: 'What is the weather tomorrow in New York?', surface: 'terminal' })).resolves.toMatchObject({
      decision: 'reject',
      code: 'OFF_DOMAIN_QUERY',
    });
  });

  it('reuses a current report for a specific semantic match', async () => {
    listCurrentPublished.mockResolvedValue([
      buildCurrentReport({
        topic: 'Why is NVDA moving after earnings today?',
        assetKey: 'nvda',
        reportKey: 'nvda-earnings-impact-earnings',
        canonicalLabel: 'NVDA after earnings',
        slug: 'nvda-after-earnings-2026-03-26-abcd',
      }),
    ]);
    const { resolveTopicQuery } = await loadModule();
    const result = await resolveTopicQuery({ input: 'NVDA after earnings', surface: 'terminal' });

    expect(result).toMatchObject({
      decision: 'reuse',
      reuseType: 'report',
      canonicalLabel: 'NVDA after earnings',
      publicSurface: 'report',
      priorityTier: 'v1',
    });
  });

  it('reuses an asset hub for a broad subject hit', async () => {
    listCurrentPublished.mockResolvedValue([
      buildCurrentReport({
        topic: 'Bitcoin price move',
        assetKey: 'bitcoin',
        reportKey: 'bitcoin-price-move',
        canonicalLabel: 'Bitcoin price move',
        slug: 'bitcoin-price-move-2026-03-26-abcd',
      }),
    ]);
    const { resolveTopicQuery } = await loadModule();
    const result = await resolveTopicQuery({ input: 'Bitcoin', surface: 'landing' });

    expect(result).toMatchObject({
      decision: 'reuse',
      reuseType: 'asset',
      assetKey: 'bitcoin',
      publicSurface: 'asset_hub',
      priorityTier: 'v1',
    });
  });

  it('prefers asset reuse for broad subjects even when a general report head exists', async () => {
    listCurrentPublished.mockResolvedValue([
      buildCurrentReport({
        topic: 'NVDA',
        assetKey: 'nvda',
        reportKey: 'nvda-general',
        canonicalLabel: 'NVDA',
        slug: 'nvda-2026-03-26-abcd',
      }),
    ]);
    const { resolveTopicQuery } = await loadModule();
    const result = await resolveTopicQuery({ input: 'NVDA', surface: 'terminal' });

    expect(result).toMatchObject({
      decision: 'reuse',
      reuseType: 'asset',
    });
    if (result.decision === 'reuse') {
      expect(result.assetKey).toBe('nvda');
    }
  });

  it('routes curated comparison queries to stable public report heads', async () => {
    const { resolveTopicQuery } = await loadModule();
    const first = await resolveTopicQuery({ input: 'Gold vs Bitcoin today', surface: 'terminal' });
    const second = await resolveTopicQuery({ input: 'Bitcoin vs Gold today', surface: 'terminal' });

    expect(first).toMatchObject({
      decision: 'run',
      visibility: 'public',
    });
    expect(second).toMatchObject({
      decision: 'run',
      visibility: 'public',
    });
    if (first.decision === 'run' && second.decision === 'run') {
      expect(first.canonicalLabel).toBe('Gold vs Bitcoin');
      expect(second.canonicalLabel).toBe('Gold vs Bitcoin');
      expect(first.reportKey).toBe('gold-vs-bitcoin-comparison');
      expect(second.reportKey).toBe('gold-vs-bitcoin-comparison');
    }
  });

  it('fails closed for explicit multi-subject comparison queries', async () => {
    const { resolveTopicQuery } = await loadModule();
    const result = await resolveTopicQuery({ input: 'Gold vs Bitcoin vs Ethereum today', surface: 'terminal' });

    expect(result).toMatchObject({
      decision: 'run_private',
      visibility: 'private',
    });
    if (result.decision === 'run_private') {
      expect(result.canonicalLabel).toContain('Gold');
      expect(result.canonicalLabel).toContain('Bitcoin');
      expect(result.canonicalLabel).toContain('Ethereum');
      expect(result.message).toContain('private');
    }
  });

  it('resolves positive zh queries to public canonical heads', async () => {
    const { resolveTopicQuery } = await loadModule();
    const comparison = await resolveTopicQuery({
      input: '黄金对比比特币',
      surface: 'terminal',
      locale: 'zh',
    });
    const subject = await resolveTopicQuery({
      input: '为什么黄金今天在波动？',
      surface: 'terminal',
      locale: 'zh',
    });

    expect(comparison).toMatchObject({
      decision: 'run',
      visibility: 'public',
    });
    expect(subject).toMatchObject({
      decision: 'run',
      visibility: 'public',
    });
    if (comparison.decision === 'run' && subject.decision === 'run') {
      expect(comparison.canonicalLabel).toBe('Gold vs Bitcoin');
      expect(comparison.reportKey).toBe('gold-vs-bitcoin-comparison');
      expect(subject.canonicalLabel).toBe('Gold price move');
      expect(subject.reportKey).toBe('gold-price-move');
      expect(subject.assetKey).toBe('gold');
    }
  });

  it('resolves positive es queries to public canonical heads', async () => {
    const { resolveTopicQuery } = await loadModule();
    const comparison = await resolveTopicQuery({
      input: 'Oro vs Bitcoin hoy',
      surface: 'terminal',
      locale: 'es',
    });
    const subject = await resolveTopicQuery({
      input: '¿Por qué cae el oro hoy?',
      surface: 'terminal',
      locale: 'es',
    });

    expect(comparison).toMatchObject({
      decision: 'run',
      visibility: 'public',
    });
    expect(subject).toMatchObject({
      decision: 'run',
      visibility: 'public',
    });
    if (comparison.decision === 'run' && subject.decision === 'run') {
      expect(comparison.canonicalLabel).toBe('Gold vs Bitcoin');
      expect(comparison.reportKey).toBe('gold-vs-bitcoin-comparison');
      expect(subject.canonicalLabel).toBe('Gold price move');
      expect(subject.reportKey).toBe('gold-price-move');
      expect(subject.assetKey).toBe('gold');
    }
  });

  it('supports newly curated comparison pairs from the catalog config', async () => {
    const { resolveTopicQuery } = await loadModule();
    const result = await resolveTopicQuery({ input: 'Tech vs rates right now', surface: 'terminal' });

    expect(result).toMatchObject({
      decision: 'run',
      visibility: 'public',
    });
    if (result.decision === 'run') {
      expect(result.canonicalLabel).toBe('Rates vs Tech');
      expect(result.reportKey).toBe('rates-vs-tech-comparison');
      expect(result.assetKey).toBe('rates');
    }
  });

  it('maps implicit relationship queries onto curated comparison heads', async () => {
    const { resolveTopicQuery } = await loadModule();
    const result = await resolveTopicQuery({
      input: 'How are yields and the dollar affecting tech right now?',
      surface: 'landing',
    });

    expect(result).toMatchObject({
      decision: 'run',
      visibility: 'public',
    });
    if (result.decision === 'run') {
      expect(result.canonicalLabel).toBe('Rates vs Tech');
      expect(result.reportKey).toBe('rates-vs-tech-comparison');
      expect(result.assetKey).toBe('rates');
    }
  });

  it('keeps non-curated comparison queries private-only', async () => {
    const { resolveTopicQuery } = await loadModule();
    const result = await resolveTopicQuery({ input: 'Gold vs Ethereum today', surface: 'terminal' });

    expect(result).toMatchObject({
      decision: 'run_private',
      visibility: 'private',
    });
    if (result.decision === 'run_private') {
      expect(result.canonicalLabel).toContain('Gold');
      expect(result.canonicalLabel).toContain('Ethereum');
    }
  });

  it('localizes private-only query messaging when locale is provided', async () => {
    const { resolveTopicQuery } = await loadModule();
    const result = await resolveTopicQuery({ input: 'Gold vs Ethereum today', surface: 'terminal', locale: 'zh' });

    expect(result).toMatchObject({
      decision: 'run_private',
      visibility: 'private',
    });
    if (result.decision === 'run_private') {
      expect(result.message).toBe('这是一个有效的复合市场查询，但在 v1 中只会保留为私有。运行后会保存一个长期私有会话，不会生成公开报告页。');
    }
  });

  it('does not match latin aliases across word boundaries', async () => {
    const { resolveTopicQuery } = await loadModule();
    const metals = await resolveTopicQuery({ input: 'metals outlook', surface: 'terminal' });
    const spoiling = await resolveTopicQuery({ input: 'spoiling crops', surface: 'terminal' });

    expect(metals).toMatchObject({
      decision: 'run_private',
      canonicalLabel: 'Metals Outlook',
      visibility: 'private',
    });
    expect(spoiling).toMatchObject({
      decision: 'run_private',
      canonicalLabel: 'Spoiling Crops',
      visibility: 'private',
    });
  });
});
