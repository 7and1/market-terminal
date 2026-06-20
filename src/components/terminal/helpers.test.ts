import { describe, expect, it } from 'vitest';

import { buildMediaGraph } from '@/components/terminal/helpers';
import type { VideosResponse } from '@/components/terminal/model';
import type { EvidenceItem } from '@/lib/types';

const evidence: EvidenceItem[] = [
  {
    id: 'ev_1',
    title: 'Reuters AI infrastructure spending report',
    url: 'https://reuters.example.test/ai',
    source: 'Reuters',
    publishedAt: Date.parse('2026-06-12T10:00:00.000Z'),
    observedAt: Date.parse('2026-06-12T10:00:00.000Z'),
    timeKind: 'published',
    excerpt: 'Cloud capex and AI infrastructure demand are rising.',
  },
];

function videos(overrides: Partial<VideosResponse> = {}): VideosResponse {
  return {
    topic: 'AI infrastructure',
    fetchedAt: Date.parse('2026-06-12T10:02:00.000Z'),
    mode: 'brightdata',
    items: [
      {
        id: 'abcdefghijk',
        title: 'Unrelated market video',
        url: 'https://www.youtube.com/watch?v=abcdefghijk',
        channel: 'Market Channel',
        thumbnail: '',
        provider: 'YouTube',
      },
    ],
    ...overrides,
  };
}

describe('terminal helpers buildMediaGraph', () => {
  it('does not render media graph nodes for unavailable video discovery', () => {
    const graph = buildMediaGraph({
      topic: 'AI infrastructure',
      videos: videos({ mode: 'unavailable', items: [] }),
      evidence,
      baseNodes: [{ id: 'asset', type: 'asset', label: 'AI infra' }],
    });

    expect(graph).toEqual({ mediaNodes: [], mediaEdges: [] });
  });

  it('does not attach unrelated first evidence to media edges', () => {
    const graph = buildMediaGraph({
      topic: 'AI infrastructure',
      videos: videos(),
      evidence,
      baseNodes: [{ id: 'asset', type: 'asset', label: 'AI infra' }],
    });

    expect(graph.mediaEdges).toHaveLength(1);
    expect(graph.mediaEdges[0]).toMatchObject({
      evidenceIds: [],
      origin: 'heuristic',
    });
  });

  it('keeps direct evidence links when video and evidence overlap', () => {
    const graph = buildMediaGraph({
      topic: 'AI infrastructure',
      videos: videos({
        items: [
          {
            id: 'abcdefghijk',
            title: 'AI infrastructure spending report',
            url: 'https://www.youtube.com/watch?v=abcdefghijk',
            channel: 'Reuters',
            thumbnail: '',
            provider: 'YouTube',
          },
        ],
      }),
      evidence,
      baseNodes: [{ id: 'asset', type: 'asset', label: 'AI infra' }],
    });

    expect(graph.mediaEdges[0]).toMatchObject({
      evidenceIds: ['ev_1'],
      origin: 'heuristic',
    });
  });
});
