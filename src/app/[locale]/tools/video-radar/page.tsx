import type { Metadata } from 'next';
import { PlaySquare, Radar, SearchCode, Youtube } from 'lucide-react';
import { setRequestLocale } from 'next-intl/server';

import { PublicApiPlayground } from '@/components/tools/PublicApiPlayground';
import { ToolPageLayout } from '@/components/tools/ToolPageLayout';
import { getRelatedTools } from '@/lib/tool-catalog';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const canonical = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/tools/video-radar`;
  const title = 'Video Radar - Topic Video Discovery Tool';
  const description =
    'Find topic-specific YouTube videos via Bright Data search collection and metadata enrichment, then expose that backend capability as a standalone discovery tool.';

  return {
    title,
    description,
    keywords: [
      'video radar',
      'YouTube discovery API',
      'market video search',
      'topic video explorer',
      'Bright Data video discovery',
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
        en: `${baseUrl}/tools/video-radar`,
        es: `${baseUrl}/es/tools/video-radar`,
        zh: `${baseUrl}/zh/tools/video-radar`,
        'x-default': `${baseUrl}/tools/video-radar`,
      },
    },
  };
}

const features = [
  {
    icon: <Radar className="h-4 w-4" />,
    title: 'Topic-led discovery',
    description:
      'Search for video coverage around a company, asset, or macro theme without forcing users through the full terminal workflow.',
  },
  {
    icon: <SearchCode className="h-4 w-4" />,
    title: 'SERP-first sourcing',
    description:
      'Use Bright Data SERP collection to find candidate YouTube URLs before enriching them with title, channel, and thumbnail metadata.',
  },
  {
    icon: <Youtube className="h-4 w-4" />,
    title: 'YouTube metadata enrichment',
    description:
      'Resolve channel names, thumbnails, and canonical URLs to turn raw search findings into a frontend-ready media surface.',
  },
  {
    icon: <PlaySquare className="h-4 w-4" />,
    title: 'Reusable media block',
    description:
      'Expose the same capability used in the terminal media panel as a standalone tool page for demos and distribution.',
  },
];

function ExampleOutput() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ['NVDA outlook: data center demand stays hot', 'Macro Tape'],
        ['What moved bitcoin today?', 'Market Signal TV'],
        ['Fed meeting recap and cross-asset effects', 'Rates Briefing'],
      ].map(([title, channel]) => (
        <div key={title} className="rounded-xl border border-white/8 bg-black/20 p-3">
          <div className="aspect-video rounded-lg border border-white/6 bg-white/[0.04]" />
          <div className="mt-3 text-sm font-semibold text-white/80">{title}</div>
          <div className="mt-1 text-xs text-white/46">{channel}</div>
        </div>
      ))}
    </div>
  );
}

export default async function VideoRadarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const relatedTools = getRelatedTools('video-radar', 'data')
    .slice(0, 3)
    .map((tool) => ({
      href: tool.href,
      title: tool.title,
      description: tool.description,
    }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Video Radar',
    description:
      'Topic-specific video discovery tool built on top of TrendAnalysis.ai Bright Data SERP collection and media enrichment.',
    applicationCategory: 'MediaApplication',
    operatingSystem: 'Web',
    inLanguage: locale,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  return (
    <ToolPageLayout
      title="Video Radar"
      description="Discover topic-specific video coverage through a dedicated frontend around the same backend capability that powers terminal media discovery."
      keywords={['video radar', 'topic video discovery']}
      features={features}
      showHeroSearch={false}
      liveDemoTitle="Run live video discovery"
      liveDemoDesc="Query the public `/api/videos` endpoint here to inspect live topic-led video results before deciding whether to open a broader terminal workflow."
      liveDemo={
        <PublicApiPlayground
          initialEndpointId="videos"
          lockedEndpointId="videos"
          title="Try the live video endpoint"
          description="This browser playground hits the same read-only video discovery route documented on the page, including topic and result-limit controls."
        />
      }
      useCases={[
        'Find explainer and commentary videos for a market topic before running deeper analysis.',
        'Turn the terminal media panel backend into a public SEO landing page with its own search intent.',
        'Give partners a simple example of how TrendAnalysis.ai can expose composable content discovery APIs.',
      ]}
      searchPlaceholder="e.g. NVDA, bitcoin, Fed meeting, oil market..."
      exampleOutput={<ExampleOutput />}
      statsLine="Built on Bright Data search collection plus YouTube metadata enrichment."
      apiSurface={[
        {
          method: 'GET',
          path: '/api/videos',
          description:
            'Search topic-related videos with optional `limit`, returning canonical URLs, channels, thumbnails, and provider metadata.',
          example: 'GET /api/videos?topic=NVDA&limit=4',
        },
      ]}
      relatedTools={relatedTools}
      jsonLd={jsonLd}
      ctaTitle="Need videos inside a broader evidence map?"
      ctaDesc="The terminal combines media discovery with search, evidence extraction, graphing, and narrative clustering."
    />
  );
}
