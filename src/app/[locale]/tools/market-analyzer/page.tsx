import type { Metadata } from 'next';
import { Activity, Database, Link2, Layers } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ToolPageLayout } from '@/components/tools/ToolPageLayout';
import { getRelatedTools } from '@/lib/tool-catalog';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const canonical = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/tools/market-analyzer`;

  return {
    title: t('trendAnalyzerTitle'),
    description: t('trendAnalyzerDesc'),
    keywords: [
      'trend analyzer',
      'trendanalysis.ai',
      'AI market research',
      'evidence-based analysis',
      'market sentiment tool',
    ],
    openGraph: {
      title: t('trendAnalyzerTitle'),
      description: t('trendAnalyzerDesc'),
      type: 'website',
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('trendAnalyzerTitle'),
      description: t('trendAnalyzerDesc'),
    },
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}/tools/market-analyzer`,
        es: `${baseUrl}/es/tools/market-analyzer`,
        zh: `${baseUrl}/zh/tools/market-analyzer`,
        'x-default': `${baseUrl}/tools/market-analyzer`,
      },
    },
  };
}

const features = [
  {
    icon: <Activity className="h-4 w-4" />,
    title: 'Live Data Pipeline',
    description:
      'Real-time SERP queries and web scraping via Bright Data. Fresh signals from news, analysis, and social sources within seconds.',
  },
  {
    icon: <Database className="h-4 w-4" />,
    title: 'AI-Powered Analysis',
    description:
      'LLM extracts entities, catalysts, and sentiment from each evidence source. Every claim is linked back to its original URL.',
  },
  {
    icon: <Link2 className="h-4 w-4" />,
    title: 'Evidence Linking',
    description:
      'Automatic relationship detection between assets, events, and entities. Confidence-scored edges connect related evidence items.',
  },
  {
    icon: <Layers className="h-4 w-4" />,
    title: 'Multi-Source Aggregation',
    description:
      'Combines news articles, financial reports, social media, and analysis pieces into a single unified evidence workspace.',
  },
];

function ExampleOutput() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-white/80">
              Bitcoin drops below $62K as Mt. Gox begins repayments
            </p>
            <p className="mt-1 text-[11px] text-white/45">reuters.com</p>
          </div>
          <span className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
            Bearish
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/55">
            BTC
          </span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/55">
            Mt. Gox
          </span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/55">
            Repayment
          </span>
        </div>
      </div>
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-white/80">
              Spot Bitcoin ETF inflows hit $300M despite price dip
            </p>
            <p className="mt-1 text-[11px] text-white/45">coindesk.com</p>
          </div>
          <span className="shrink-0 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-400">
            Bullish
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/55">
            BTC
          </span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/55">
            ETF
          </span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/55">
            Institutional
          </span>
        </div>
      </div>
    </div>
  );
}

export default async function MarketAnalyzerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const relatedTools = getRelatedTools('market-analyzer', 'research')
    .slice(0, 3)
    .map((tool) => ({
      href: tool.href,
      title: tool.title,
      description: tool.description,
    }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Trend Analyzer',
    description:
      'AI-powered trend analyzer that aggregates live data from multiple sources for evidence-based market research.',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    inLanguage: locale,
    featureList: [
      'Live SERP-backed discovery',
      'Evidence extraction',
      'Sentiment and entity analysis',
      'Graph-ready research artifacts',
    ],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  return (
    <ToolPageLayout
      title="Trend Analyzer"
      description="Search any market topic and get AI-generated evidence maps with live data, sentiment analysis, and entity extraction from multiple sources."
      keywords={['trend analyzer', 'AI market research tool']}
      features={features}
      useCases={[
        'Run a fast evidence-backed brief for a stock, crypto asset, macro theme, or earnings event.',
        'Turn a broad market question into traceable evidence before publishing a report or snapshot.',
        'Demonstrate the full TrendAnalysis.ai pipeline, not just the terminal shell, from search through linked artifacts.',
      ]}
      searchPlaceholder="e.g. NVDA earnings impact, BTC halving effects..."
      exampleOutput={<ExampleOutput />}
      statsLine="Aggregates 10+ sources per query across news, analysis, and social channels."
      apiSurface={[
        {
          method: 'POST',
          path: '/api/run',
          description:
            'Launches the full research workflow that powers this tool, including planning, search, evidence extraction, graph construction, and report artifacts.',
          example: 'POST /api/run { "topic": "NVDA earnings impact", "mode": "fast" }',
        },
        {
          method: 'GET',
          path: '/api/serp',
          description:
            'Use the read-only search layer independently when you want to validate query freshness before triggering a full run.',
          example: 'GET /api/serp?q=NVDA%20earnings&vertical=news&recency=d',
        },
      ]}
      relatedTools={relatedTools}
      jsonLd={jsonLd}
    />
  );
}
