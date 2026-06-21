import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EvidenceItem } from '@/lib/run-pipeline/contracts';
import { buildArtifacts } from '@/lib/run-pipeline/stages/artifacts';

const aiMocks = vi.hoisted(() => ({
  getAIConfig: vi.fn(),
  chatJson: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    ai: {
      allowClientApiKeys: false,
      openrouter: {
        modelArtifacts: '',
      },
    },
  },
}));

vi.mock('@/lib/ai', () => ({
  getAIConfig: aiMocks.getAIConfig,
  chatJson: aiMocks.chatJson,
}));

const observedAt = Date.parse('2026-06-12T10:00:00.000Z');

const evidence: EvidenceItem[] = [
  {
    id: 'ev1',
    title: 'AI capex report',
    url: 'https://source1.example.test/story',
    source: 'source1.example.test',
    publishedAt: observedAt,
    observedAt,
    timeKind: 'published',
    excerpt: 'AI infrastructure spending continues to rise.',
    excerptSource: 'serp',
  },
  {
    id: 'ev2',
    title: 'Semiconductor demand report',
    url: 'https://source2.example.test/story',
    source: 'source2.example.test',
    publishedAt: observedAt - 60_000,
    observedAt,
    timeKind: 'published',
    excerpt: 'Semiconductor demand is tied to data center buildouts.',
    excerptSource: 'serp',
  },
];

describe('buildArtifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiMocks.getAIConfig.mockReturnValue({ model: 'test-model', apiKey: 'test-key' });
    aiMocks.chatJson.mockResolvedValue({
      tape: [
        {
          title: 'AI capex cycle',
          source: 'source1.example.test',
          publishedAt: observedAt,
          tags: ['capex'],
          evidenceId: 'ev1',
        },
      ],
      nodes: [
        { id: 'asset', type: 'asset', label: 'AI infrastructure' },
        { id: 'event', type: 'event', label: 'Capex cycle' },
      ],
      edges: [
        {
          id: 'edge1',
          from: 'event',
          to: 'asset',
          type: 'mentions',
          confidence: 0.82,
          evidenceIds: ['ev1'],
          rationale: 'Evidence-backed relationship.',
        },
        {
          id: 'edge2',
          from: 'asset',
          to: 'event',
          type: 'same_story',
          confidence: 0.4,
          evidenceIds: ['missing'],
          rationale: 'Should be discarded after evidence filtering.',
        },
      ],
      clusters: [
        {
          title: 'Valid cluster',
          summary: 'This cluster keeps a real evidence anchor from the run.',
          momentum: 'rising',
          evidenceIds: ['ev1', 'missing'],
          related: ['AI infrastructure'],
        },
        {
          title: 'Unsupported cluster',
          summary: 'This cluster should be removed after invalid evidence IDs are filtered.',
          momentum: 'steady',
          evidenceIds: ['missing'],
          related: ['AI infrastructure'],
        },
      ],
      assistantMessage: 'AI infrastructure evidence points to a capex-linked market narrative.',
    });
  });

  it('drops AI clusters that have no valid evidence IDs after filtering', async () => {
    const artifacts = await buildArtifacts({
      topic: 'AI infrastructure stocks',
      evidence,
      mode: 'fast',
    });

    expect(artifacts.usedAI).toBe(true);
    expect(artifacts.clusters).toHaveLength(1);
    expect(artifacts.clusters[0]).toMatchObject({
      title: 'Valid cluster',
      evidenceIds: ['ev1'],
    });
    expect(artifacts.edges.every((edge) => edge.evidenceIds.every((id) => id === 'ev1' || id === 'ev2'))).toBe(true);
    expect(artifacts.edges.every((edge) => edge.origin === 'ai' || edge.origin === 'heuristic')).toBe(true);
  });
});
