import type { Metadata } from 'next';
import { Clock3, Globe2, Layers3, SearchCode } from 'lucide-react';
import { setRequestLocale } from 'next-intl/server';

import { PublicApiPlayground } from '@/components/tools/PublicApiPlayground';
import { ToolPageLayout } from '@/components/tools/ToolPageLayout';
import { getRelatedTools } from '@/lib/tool-catalog';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const canonical = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/tools/serp-explorer`;
  const title = 'SERP Explorer - Bright Data Search Intelligence';
  const description =
    'Inspect live web and news SERP results with recency filters, normalized result payloads, and a productized frontend for the TrendAnalysis.ai search backend.';

  return {
    title,
    description,
    keywords: [
      'SERP explorer',
      'Bright Data SERP',
      'news SERP API',
      'search intelligence tool',
      'Google news API explorer',
    ],
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}/tools/serp-explorer`,
        es: `${baseUrl}/es/tools/serp-explorer`,
        zh: `${baseUrl}/zh/tools/serp-explorer`,
        'x-default': `${baseUrl}/tools/serp-explorer`,
      },
    },
  };
}

const features = [
  {
    icon: <SearchCode className="h-4 w-4" />,
    title: 'Normalized SERP payloads',
    description:
      'Use the same backend search layer that powers the research pipeline, with normalized result lists suitable for debugging or external use.',
  },
  {
    icon: <Globe2 className="h-4 w-4" />,
    title: 'Web and news verticals',
    description:
      'Switch between broad web discovery and news-specific search surfaces without rebuilding the query path.',
  },
  {
    icon: <Clock3 className="h-4 w-4" />,
    title: 'Recency-aware search',
    description:
      'Filter by recent hour, day, week, month, or year to focus on moving narratives rather than stale search results.',
  },
  {
    icon: <Layers3 className="h-4 w-4" />,
    title: 'Upstream debugging surface',
    description:
      'Turn the internal search stage into a public-facing inspection layer so the product shows where evidence collection starts.',
  },
];

export default async function SerpExplorerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const relatedTools = getRelatedTools('serp-explorer', 'data')
    .slice(0, 3)
    .map((tool) => ({
      href: tool.href,
      title: tool.title,
      description: tool.description,
    }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SERP Explorer',
    description:
      'Public-facing SERP exploration tool backed by the TrendAnalysis.ai search stage and Bright Data search collection.',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    inLanguage: locale,
    featureList: [
      'Web and news search',
      'Recency filters',
      'Normalized result payloads',
      'Bright Data-backed discovery',
    ],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  return (
    <ToolPageLayout
      title="SERP Explorer"
      description="Inspect live web and news search results with recency filters and a dedicated frontend around the TrendAnalysis.ai search backend."
      keywords={['SERP explorer', 'Bright Data search API']}
      features={features}
      showHeroSearch={false}
      liveDemoTitle="Run a live SERP query"
      liveDemoDesc="Test the browser-safe `/api/serp` flow directly on this page, then move into the terminal only when you need evidence extraction and clustering."
      liveDemo={
        <PublicApiPlayground
          initialEndpointId="serp"
          lockedEndpointId="serp"
          title="Try the live SERP endpoint"
          description="This playground hits the same read-only SERP route described below, including vertical, recency, and response-format controls."
        />
      }
      useCases={[
        'Validate whether a topic has enough fresh news coverage before triggering a full run.',
        'Inspect how web versus news search changes the evidence pool for the same market query.',
        'Show prospects and partners that the search layer itself is a reusable product surface.',
      ]}
      searchPlaceholder="e.g. NVDA earnings, Fed rate outlook, oil market..."
      statsLine="Exposes the same search-stage capability that seeds TrendAnalysis.ai evidence collection."
      apiSurface={[
        {
          method: 'GET',
          path: '/api/serp',
          description:
            'Run a read-only search query against the backend SERP layer. Supports `q`, `vertical`, `format`, and `recency`.',
          example: 'GET /api/serp?q=NVDA%20earnings&vertical=news&recency=d&format=light',
        },
      ]}
      relatedTools={relatedTools}
      jsonLd={jsonLd}
      ctaTitle="Want the full workflow after search?"
      ctaDesc="Use the terminal to turn raw search discovery into evidence extraction, clustering, and graph analysis."
    />
  );
}
