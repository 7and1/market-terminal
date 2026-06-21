import type { Metadata } from 'next';
import { GitBranch, Boxes, Workflow, Zap } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ToolPageLayout } from '@/components/tools/ToolPageLayout';
import { getRelatedTools } from '@/lib/tool-catalog';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const canonical = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/tools/evidence-graph`;

  return {
    title: t('evidenceGraphTitle'),
    description: t('evidenceGraphDesc'),
    keywords: [
      'market evidence graph',
      'news impact visualization',
      'market knowledge graph',
      'asset relationship graph',
      'market network analysis',
    ],
    openGraph: {
      title: t('evidenceGraphTitle'),
      description: t('evidenceGraphDesc'),
      type: 'website',
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('evidenceGraphTitle'),
      description: t('evidenceGraphDesc'),
    },
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}/tools/evidence-graph`,
        es: `${baseUrl}/es/tools/evidence-graph`,
        zh: `${baseUrl}/zh/tools/evidence-graph`,
        'x-default': `${baseUrl}/tools/evidence-graph`,
      },
    },
  };
}

const features = [
  {
    icon: <GitBranch className="h-4 w-4" />,
    title: 'Knowledge Graph',
    description:
      'Automatically generated graph connecting assets, events, entities, and sources. Up to 24 nodes and 36 edges per analysis.',
  },
  {
    icon: <Boxes className="h-4 w-4" />,
    title: 'Typed Nodes',
    description:
      'Five node types: asset (stocks, crypto), event (earnings, policy), entity (companies, people), source (articles), and media (videos, podcasts).',
  },
  {
    icon: <Workflow className="h-4 w-4" />,
    title: 'Confidence-Scored Edges',
    description:
      'Four edge types: mentions, co-moves, hypothesis, and same-story. Each edge carries a confidence score and links back to supporting evidence.',
  },
  {
    icon: <Zap className="h-4 w-4" />,
    title: 'Impact Detection',
    description:
      'Spillover analysis detects cross-asset impact chains. Orphan repair ensures every node connects to the broader evidence network.',
  },
];

export default async function EvidenceGraphPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const relatedTools = getRelatedTools('evidence-graph', 'research')
    .slice(0, 3)
    .map((tool) => ({
      href: tool.href,
      title: tool.title,
      description: tool.description,
    }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Evidence Graph Builder',
    description:
      'Interactive market knowledge graph builder that visualizes relationships between assets, events, entities, and news sources.',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    inLanguage: locale,
    featureList: [
      'Typed graph nodes',
      'Confidence-scored edges',
      'Cross-asset impact detection',
      'Evidence-linked relationships',
    ],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  return (
    <ToolPageLayout
      title="Evidence Graph Builder"
      description="Visualize how assets, events, entities, and sources connect. Build interactive knowledge graphs from live market data with confidence-scored relationships."
      keywords={['market evidence graph', 'news impact visualization']}
      features={features}
      useCases={[
        'Show how one catalyst propagates across assets, entities, and source narratives.',
        'Turn raw evidence into a board-ready graph view for research, sales, or partner demos.',
        'Expose the graph-building layer as a product capability instead of hiding it inside the terminal UI.',
      ]}
      searchPlaceholder="e.g. tech sector earnings, AI infrastructure supply chain..."
      statsLine="Generates up to 24 nodes and 36 edges per analysis with 4 relationship types."
      apiSurface={[
        {
          method: 'POST',
          path: '/api/run',
          description:
            'Runs the full graph-producing workflow and persists the artifacts needed for graph, mind map, flow, and timeline views.',
          example: 'POST /api/run { "topic": "AI infrastructure supply chain", "mode": "deep" }',
        },
        {
          method: 'GET',
          path: '/api/serp',
          description:
            'Use the read-only search layer to inspect the upstream evidence pool before converting it into graph nodes and relationships.',
          example: 'GET /api/serp?q=tech%20sector%20earnings&vertical=news&recency=w',
        },
      ]}
      relatedTools={relatedTools}
      jsonLd={jsonLd}
    />
  );
}
