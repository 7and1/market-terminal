export type ToolSectionId = 'research' | 'data' | 'developer';

export type ToolCatalogEntry = {
  href: `/tools/${string}`;
  slug: string;
  title: string;
  description: string;
  section: ToolSectionId;
  endpoint?: {
    method: 'GET' | 'POST';
    path: `/api/${string}`;
  };
};

export type ToolSection = {
  id: ToolSectionId;
  title: string;
  description: string;
};

export type PublicApiEntry = {
  method: 'GET';
  path: `/api/${string}`;
  title: string;
  description: string;
  exampleQuery?: string;
};

export const toolSections: ToolSection[] = [
  {
    id: 'research',
    title: 'Research workflows',
    description:
      'Full analysis flows that turn live search, evidence extraction, clustering, and graph linking into reusable research surfaces.',
  },
  {
    id: 'data',
    title: 'Backend capabilities as tools',
    description:
      'Standalone tool pages that expose individual read-only backend capabilities for discovery, demos, and long-tail SEO.',
  },
  {
    id: 'developer',
    title: 'Developer surfaces',
    description:
      'Public docs and endpoint references for teams that want to test the read-only API surface directly.',
  },
];

export const toolCatalog: ToolCatalogEntry[] = [
  {
    href: '/tools/market-analyzer',
    slug: 'market-analyzer',
    title: 'Trend Analyzer',
    description:
      'Search any market topic and get an AI-generated evidence map with live data, sentiment, and entity extraction.',
    section: 'research',
    endpoint: {
      method: 'POST',
      path: '/api/run',
    },
  },
  {
    href: '/tools/evidence-graph',
    slug: 'evidence-graph',
    title: 'Evidence Graph Builder',
    description:
      'Visualize how assets, events, entities, and sources connect inside an interactive, confidence-scored knowledge graph.',
    section: 'research',
    endpoint: {
      method: 'POST',
      path: '/api/run',
    },
  },
  {
    href: '/tools/news-analyzer',
    slug: 'news-analyzer',
    title: 'News Impact Analyzer',
    description:
      'Track story clusters, timeline shifts, catalyst chains, and sentiment changes across market-moving events.',
    section: 'research',
    endpoint: {
      method: 'POST',
      path: '/api/run',
    },
  },
  {
    href: '/tools/serp-explorer',
    slug: 'serp-explorer',
    title: 'SERP Explorer',
    description:
      'Query Bright Data-backed web or news SERPs with recency filters to inspect the upstream search layer directly.',
    section: 'data',
    endpoint: {
      method: 'GET',
      path: '/api/serp',
    },
  },
  {
    href: '/tools/price-snapshot',
    slug: 'price-snapshot',
    title: 'Price Snapshot',
    description:
      'Pull a fast price series for mapped assets like BTC, ETH, SOL, and gold proxies through the public price endpoint.',
    section: 'data',
    endpoint: {
      method: 'GET',
      path: '/api/price',
    },
  },
  {
    href: '/tools/video-radar',
    slug: 'video-radar',
    title: 'Video Radar',
    description:
      'Discover topic-specific YouTube videos through Bright Data SERP collection and oEmbed enrichment.',
    section: 'data',
    endpoint: {
      method: 'GET',
      path: '/api/videos',
    },
  },
  {
    href: '/tools/api',
    slug: 'api',
    title: 'Developer API',
    description:
      'Browse the safe read-only API surface, endpoint examples, and which routes remain private for runtime operations.',
    section: 'developer',
  },
];

export const publicApiEntries: PublicApiEntry[] = [
  {
    method: 'GET',
    path: '/api/health',
    title: 'Health Probe',
    description:
      'Returns public service readiness. Operator-authenticated probe mode can also check Bright Data, AI, and database connectivity.',
    exampleQuery: '/api/health',
  },
  {
    method: 'GET',
    path: '/api/serp',
    title: 'SERP Search',
    description:
      'Runs web or news search through Bright Data and returns normalized search results for a topic query.',
    exampleQuery: '/api/serp?q=NVDA%20earnings&vertical=news&recency=d',
  },
  {
    method: 'GET',
    path: '/api/price',
    title: 'Price Snapshot',
    description:
      'Fetches recent price series data for supported mapped topics such as BTC, ETH, SOL, and gold proxies.',
    exampleQuery: '/api/price?topic=BTC',
  },
  {
    method: 'GET',
    path: '/api/videos',
    title: 'Video Discovery',
    description:
      'Finds topic-related YouTube videos using Bright Data SERP collection and metadata enrichment.',
    exampleQuery: '/api/videos?topic=NVDA&limit=4',
  },
];

export const privateApiPaths = [
  '/api/run',
  '/api/chat',
  '/api/sessions',
  '/api/monitors',
] as const;

export const publicToolPaths = toolCatalog.map((entry) => entry.href);

export function getToolBySlug(slug: string) {
  return toolCatalog.find((entry) => entry.slug === slug) || null;
}

export function getRelatedTools(currentSlug: string, section?: ToolSectionId) {
  return toolCatalog.filter((entry) => {
    if (entry.slug === currentSlug) return false;
    if (!section) return true;
    return entry.section === section;
  });
}
