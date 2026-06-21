export type NodeType = 'asset' | 'event' | 'entity' | 'source' | 'media';
export type EdgeType = 'mentions' | 'co_moves' | 'hypothesis' | 'same_story';

export type GraphNode = {
  id: string;
  type: NodeType;
  label: string;
  meta?: {
    provider?: string;
    kind?: string;
    url?: string;
    evidenceIds?: string[];
  };
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  confidence: number;
  evidenceIds: string[];
  origin?: 'ai' | 'heuristic';
  rationale?: string;
};
