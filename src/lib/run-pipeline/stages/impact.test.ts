import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EvidenceItem } from '@/lib/run-pipeline/contracts';
import { expandGraphImpact } from '@/lib/run-pipeline/stages/impact';

const aiMocks = vi.hoisted(() => ({
  chatJson: vi.fn(),
  getAIConfig: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    ai: {
      allowClientApiKeys: false,
      openrouter: {
        modelArtifacts: 'openrouter/test-artifacts',
      },
    },
  },
}));

vi.mock('@/lib/ai', () => ({
  chatJson: aiMocks.chatJson,
  getAIConfig: aiMocks.getAIConfig,
}));

const observedAt = Date.parse('2026-06-12T10:00:00.000Z');
const evidence: EvidenceItem[] = [
  {
    id: 'ev1',
    title: 'Federal Reserve policy affects AI infrastructure multiples',
    url: 'https://source.example.test/story',
    source: 'source.example.test',
    publishedAt: observedAt,
    observedAt,
    timeKind: 'published',
    excerpt: 'Federal Reserve policy shifts may affect AI infrastructure valuation multiples.',
    excerptSource: 'serp',
  },
];

describe('expandGraphImpact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiMocks.getAIConfig.mockReturnValue({
      apiKey: 'test-key',
      baseURL: 'https://openrouter.ai/api/v1',
      model: 'openrouter/test-artifacts',
    });
    aiMocks.chatJson.mockResolvedValue({
      addNodes: [
        { id: 'macro', type: 'entity', label: 'Federal Reserve' },
      ],
      addEdges: [
        {
          id: 'macro-edge',
          from: 'macro',
          to: 'asset',
          type: 'hypothesis',
          confidence: 0.66,
          evidenceIds: ['ev1'],
          rationale: 'Macro policy channel cited by evidence.',
        },
      ],
    });
  });

  it('sets an explicit max token cap and marks accepted impact edges as AI-origin', async () => {
    const expanded = await expandGraphImpact({
      topic: 'AI infrastructure stocks and Fed policy',
      evidence,
      nodes: [{ id: 'asset', type: 'asset', label: 'AI infra' }],
      edges: [],
    });

    expect(aiMocks.chatJson).toHaveBeenCalledWith(expect.objectContaining({
      maxTokens: 1200,
      telemetry: expect.objectContaining({ tag: 'impact' }),
    }));
    expect(expanded?.edges).toContainEqual(expect.objectContaining({
      id: 'macro-edge',
      evidenceIds: ['ev1'],
      origin: 'ai',
    }));
  });

  it('does not treat crypto-specific actors as global impact triggers for dense non-crypto graphs', async () => {
    const nodes = [
      { id: 'asset', type: 'asset' as const, label: 'AI infra' },
      ...Array.from({ length: 11 }, (_, idx) => ({ id: `event${idx}`, type: 'event' as const, label: `Event ${idx}` })),
    ];
    const edges = Array.from({ length: 10 }, (_, idx) => ({
      id: `edge${idx}`,
      from: `event${idx}`,
      to: 'asset',
      type: 'mentions' as const,
      confidence: 0.5,
      evidenceIds: ['ev1'],
    }));

    const expanded = await expandGraphImpact({
      topic: 'AI infrastructure stocks',
      evidence: [
        {
          ...evidence[0]!,
          title: 'MicroStrategy appears in unrelated market note',
          excerpt: 'MicroStrategy is mentioned, but the report is not about crypto beta.',
        },
      ],
      nodes,
      edges,
    });

    expect(expanded).toBeNull();
    expect(aiMocks.chatJson).not.toHaveBeenCalled();
  });
});
