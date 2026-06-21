import type { GraphEdge, GraphNode } from '@/components/terminal/types';
import type { EvidenceItem, StoryCluster, TapeItem } from '@/lib/types';

export type VideoItem = {
  id: string;
  title: string;
  url: string;
  channel: string;
  thumbnail: string;
  provider: 'YouTube';
};

export type VideosResponse = {
  topic: string;
  fetchedAt: number;
  mode: 'brightdata' | 'unavailable';
  items: VideoItem[];
  error?: string;
};

export type PriceResponse = {
  ok: boolean;
  topic: string;
  symbol?: string;
  provider: string;
  fetchedAt: number;
  series: number[];
  timestamps: number[];
  last?: number | null;
  error?: string;
};

export type Session = {
  id: string;
  topic: string;
  startedAt: number;
  step:
    | 'idle'
    | 'plan'
    | 'search'
    | 'scrape'
    | 'extract'
    | 'link'
    | 'cluster'
    | 'render'
    | 'ready';
  progress: number;
  tape: TapeItem[];
  clusters: StoryCluster[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  evidence: EvidenceItem[];
  series: number[];
  seriesTs: number[];
  videosSnapshot?: VideosResponse | null;
  priceSnapshot?: PriceResponse | null;
  snapshotMode?: boolean;
};

export type SessionSnapshotArtifacts = {
  evidence?: EvidenceItem[];
  tape?: TapeItem[];
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  clusters?: StoryCluster[];
  price?: PriceResponse | null;
  videos?: VideosResponse | null;
};

export type SessionSnapshotMeta = {
  mode?: 'fast' | 'deep';
  provider?: string;
  model?: string;
  plan?: {
    queries: string[];
    angles?: string[];
    usedAI: boolean;
  };
  selectedUrls?: string[];
  artifacts?: SessionSnapshotArtifacts;
};

export type PriceScaleMode = 'price' | 'indexed';
