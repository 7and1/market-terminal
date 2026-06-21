import type { Metadata } from 'next';
import { Clock, Layers, Brain, TrendingUp } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ToolPageLayout } from '@/components/tools/ToolPageLayout';
import { getRelatedTools } from '@/lib/tool-catalog';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const canonical = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/tools/news-analyzer`;

  return {
    title: t('newsAnalyzerTitle'),
    description: t('newsAnalyzerDesc'),
    keywords: [
      'news impact on stocks',
      'market news analyzer',
      'news sentiment analysis',
      'market catalyst tracker',
      'news timeline tool',
    ],
    openGraph: {
      title: t('newsAnalyzerTitle'),
      description: t('newsAnalyzerDesc'),
      type: 'website',
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('newsAnalyzerTitle'),
      description: t('newsAnalyzerDesc'),
    },
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}/tools/news-analyzer`,
        es: `${baseUrl}/es/tools/news-analyzer`,
        zh: `${baseUrl}/zh/tools/news-analyzer`,
        'x-default': `${baseUrl}/tools/news-analyzer`,
      },
    },
  };
}

const features = [
  {
    icon: <Clock className="h-4 w-4" />,
    title: 'Timeline View',
    description:
      'Chronological event tape showing market-moving events with tags, timestamps, and linked evidence for each entry.',
  },
  {
    icon: <Layers className="h-4 w-4" />,
    title: 'Story Clustering',
    description:
      'Groups related evidence into story clusters with momentum indicators: rising, steady, or fading. Up to 6 clusters per analysis.',
  },
  {
    icon: <Brain className="h-4 w-4" />,
    title: 'Sentiment Analysis',
    description:
      'Per-source sentiment scoring with confidence levels. Aggregated view shows net market sentiment across all evidence items.',
  },
  {
    icon: <TrendingUp className="h-4 w-4" />,
    title: 'Catalyst Tracking',
    description:
      'Identifies and chains market catalysts across sources. Tracks how a single event propagates through related assets and narratives.',
  },
];

export default async function NewsAnalyzerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const relatedTools = getRelatedTools('news-analyzer', 'research')
    .slice(0, 3)
    .map((tool) => ({
      href: tool.href,
      title: tool.title,
      description: tool.description,
    }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'News Impact Analyzer',
    description:
      'Market news impact analyzer with timeline visualization, story clustering, sentiment analysis, and catalyst tracking.',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    inLanguage: locale,
    featureList: [
      'Timeline view',
      'Story clustering',
      'Sentiment scoring',
      'Catalyst tracking',
    ],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  return (
    <ToolPageLayout
      title="News Impact Analyzer"
      description="Track how news stories cluster, detect momentum shifts, and follow catalyst chains across market events with timeline visualization and sentiment scoring."
      keywords={['news impact on stocks', 'market news analyzer']}
      features={features}
      useCases={[
        'Follow how one headline evolves into a broader market narrative over hours or days.',
        'Separate rising stories from fading noise before pushing a topic into a deeper research workflow.',
        'Package the timeline and catalyst layer as a dedicated product capability for news-driven users.',
      ]}
      searchPlaceholder="e.g. Fed rate decision impact, oil price catalysts..."
      statsLine="Tracks up to 12 timeline events and 6 story clusters per analysis session."
      apiSurface={[
        {
          method: 'POST',
          path: '/api/run',
          description:
            'Produces the clustered news artifacts, tape items, and evidence summaries that back this analyzer.',
          example: 'POST /api/run { "topic": "Fed rate decision impact", "mode": "fast" }',
        },
        {
          method: 'GET',
          path: '/api/videos',
          description:
            'Pairs the written news layer with topic-specific video discovery when you want to extend a narrative into multimedia coverage.',
          example: 'GET /api/videos?topic=Fed%20rate%20decision&limit=4',
        },
      ]}
      relatedTools={relatedTools}
      jsonLd={jsonLd}
    />
  );
}
