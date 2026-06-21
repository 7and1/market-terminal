import { describe, expect, it } from 'vitest';

import type { GraphEdge, GraphNode } from '@/components/terminal/types';
import type { EvidenceItem } from '@/lib/run-pipeline/contracts';
import { enforceLinkCoherence, enrichEntitiesFromEvidence, enrichGraphFromTapeAndEvidence, ensureMinimumGraph } from '@/lib/run-pipeline/graph-heuristics';

const observedAt = Date.parse('2026-06-12T10:00:00.000Z');

const evidence: EvidenceItem[] = [
  {
    id: 'ev1',
    title: 'Matched source evidence',
    url: 'https://matched.example.test/story',
    source: 'matched.example.test',
    publishedAt: observedAt,
    observedAt,
    timeKind: 'published',
    excerpt: 'A directly matched source item.',
    excerptSource: 'serp',
  },
];

function assertNoDanglingEdges(nodes: GraphNode[], edges: GraphEdge[]) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  for (const edge of edges) {
    expect(nodeIds.has(edge.from)).toBe(true);
    expect(nodeIds.has(edge.to)).toBe(true);
    expect(edge.from).not.toBe(edge.to);
  }
}

describe('graph heuristics', () => {
  it('marks seed edges as heuristic while preserving direct evidence', () => {
    const graph = ensureMinimumGraph({
      topic: 'AI infrastructure stocks',
      evidence,
      nodes: [],
      edges: [],
    });

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      origin: 'heuristic',
      evidenceIds: ['ev1'],
    });
    assertNoDanglingEdges(graph.nodes, graph.edges);
  });

  it('does not attach unrelated first evidence to orphan heuristic links', () => {
    const graph = enrichGraphFromTapeAndEvidence({
      topic: 'AI infrastructure stocks',
      evidence,
      tape: [],
      nodes: [
        { id: 'asset', type: 'asset', label: 'AI infra' },
        { id: 'unmatched_source', type: 'source', label: 'unmatched.example.test' },
        { id: 'orphan_event', type: 'event', label: 'Orphan catalyst' },
      ],
      edges: [],
    });

    const inferred = graph.edges.filter((edge) => edge.from === 'unmatched_source' || edge.from === 'orphan_event');
    expect(inferred.length).toBeGreaterThan(0);
    expect(inferred.every((edge) => edge.origin === 'heuristic')).toBe(true);
    expect(inferred.every((edge) => edge.evidenceIds.length === 0)).toBe(true);
    assertNoDanglingEdges(graph.nodes, graph.edges);
  });

  it('keeps coherence edges without fabricating evidence anchors', () => {
    const graph = enforceLinkCoherence({
      evidence,
      nodes: [
        { id: 'asset', type: 'asset', label: 'AI infra' },
        { id: 'source', type: 'source', label: 'unmatched.example.test' },
        { id: 'event', type: 'event', label: 'Uncited catalyst' },
      ],
      edges: [],
    });

    expect(graph.edges).toHaveLength(2);
    expect(graph.edges.every((edge) => edge.origin === 'heuristic')).toBe(true);
    expect(graph.edges.every((edge) => edge.evidenceIds.length === 0)).toBe(true);
    assertNoDanglingEdges(graph.nodes, graph.edges);
  });

  it('does not extract crypto venue actors for unrelated generic topics', () => {
    const graph = enrichEntitiesFromEvidence({
      topic: 'AI infrastructure stocks',
      evidence: [
        {
          ...evidence[0]!,
          title: 'Coinbase comments on market structure',
          excerpt: 'Coinbase was mentioned in a market-structure note.',
        },
      ],
      nodes: [{ id: 'asset', type: 'asset', label: 'AI infra' }],
      edges: [],
    });

    expect(graph.nodes.some((node) => node.label === 'Coinbase')).toBe(false);
  });

  it('uses catalog actors for matching crypto topics', () => {
    const graph = enrichEntitiesFromEvidence({
      topic: 'Bitcoin',
      evidence: [
        {
          ...evidence[0]!,
          title: 'Coinbase comments on Bitcoin market structure',
          excerpt: 'Coinbase was mentioned in a bitcoin market-structure note.',
        },
      ],
      nodes: [{ id: 'asset', type: 'asset', label: 'Bitcoin' }],
      edges: [],
    });

    expect(graph.nodes).toContainEqual(expect.objectContaining({ label: 'Coinbase' }));
  });
});
