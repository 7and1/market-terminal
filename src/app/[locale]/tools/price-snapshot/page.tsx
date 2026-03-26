import type { Metadata } from 'next';
import { Activity, Clock3, LineChart, ShieldCheck } from 'lucide-react';
import { setRequestLocale } from 'next-intl/server';

import { PublicApiPlayground } from '@/components/tools/PublicApiPlayground';
import { ToolPageLayout } from '@/components/tools/ToolPageLayout';
import { getRelatedTools } from '@/lib/tool-catalog';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const canonical = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/tools/price-snapshot`;
  const title = 'Price Snapshot - Topic Price API and Series Lookup';
  const description =
    'Query a lightweight public price endpoint for supported assets like BTC, ETH, SOL, and gold proxies, then use the result as a standalone tool or API demo.';

  return {
    title,
    description,
    keywords: [
      'price snapshot API',
      'BTC price series',
      'crypto price tool',
      'topic price lookup',
      'market price endpoint',
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
        en: `${baseUrl}/tools/price-snapshot`,
        es: `${baseUrl}/es/tools/price-snapshot`,
        zh: `${baseUrl}/zh/tools/price-snapshot`,
        'x-default': `${baseUrl}/tools/price-snapshot`,
      },
    },
  };
}

const features = [
  {
    icon: <Activity className="h-4 w-4" />,
    title: 'Fast topic-to-price lookup',
    description:
      'Map a supported topic such as BTC, ETH, SOL, or gold into a price series without running the full TrendAnalysis.ai pipeline.',
  },
  {
    icon: <LineChart className="h-4 w-4" />,
    title: 'Series-ready response shape',
    description:
      'Return structured timestamps, series data, provider metadata, and last price so frontend widgets can render directly.',
  },
  {
    icon: <Clock3 className="h-4 w-4" />,
    title: 'Short cache window',
    description:
      'Use a lightweight cached response window to keep the endpoint responsive while still representing recent market conditions.',
  },
  {
    icon: <ShieldCheck className="h-4 w-4" />,
    title: 'Safe public surface',
    description:
      'Expose a read-only GET route that is useful to visitors and developers without opening internal write paths or session state.',
  },
];

function ExampleOutput() {
  return (
    <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-xl border border-white/8 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">BTC Snapshot</div>
            <div className="mt-1 text-2xl font-semibold text-white/90">$68,422</div>
          </div>
          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            +1.8%
          </div>
        </div>
        <div className="mt-4 h-20 rounded-lg border border-white/6 bg-gradient-to-r from-[rgba(0,102,255,0.12)] via-[rgba(120,196,255,0.18)] to-[rgba(0,102,255,0.04)]" />
      </div>
      <div className="rounded-xl border border-white/8 bg-black/20 p-4">
        <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">Response fields</div>
        <div className="mt-3 space-y-2 text-sm text-white/70">
          <div>provider: <span className="text-white/46">coingecko</span></div>
          <div>symbol: <span className="text-white/46">BTC</span></div>
          <div>series: <span className="text-white/46">24h array</span></div>
          <div>timestamps: <span className="text-white/46">24h array</span></div>
          <div>last: <span className="text-white/46">68422</span></div>
        </div>
      </div>
    </div>
  );
}

export default async function PriceSnapshotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const relatedTools = getRelatedTools('price-snapshot', 'data')
    .slice(0, 3)
    .map((tool) => ({
      href: tool.href,
      title: tool.title,
      description: tool.description,
    }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Price Snapshot',
    description:
      'Read-only price lookup tool for supported market topics backed by the TrendAnalysis.ai public price endpoint.',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    inLanguage: locale,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  return (
    <ToolPageLayout
      title="Price Snapshot"
      description="Look up a recent price series for supported market topics through a lightweight public endpoint instead of a full pipeline run."
      keywords={['price snapshot', 'topic price lookup']}
      features={features}
      showHeroSearch={false}
      liveDemoTitle="Run a live price lookup"
      liveDemoDesc="Use the public GET endpoint directly here when you want a fast quote or chart-ready series without opening the full terminal."
      liveDemo={
        <PublicApiPlayground
          initialEndpointId="price"
          lockedEndpointId="price"
          title="Try the live price endpoint"
          description="This runs the same read-only `/api/price` route documented on the page so visitors can validate the response shape before escalating into the terminal."
        />
      }
      useCases={[
        'Give visitors an immediate asset check before they decide to run deeper research.',
        'Expose a reusable chart-ready endpoint for landing pages and lightweight widgets.',
        'Show that TrendAnalysis.ai includes small composable data products, not only one terminal experience.',
      ]}
      searchPlaceholder="e.g. BTC, ETH, SOL, gold..."
      exampleOutput={<ExampleOutput />}
      statsLine="Optimized for fast, read-only price checks on a short cache window."
      apiSurface={[
        {
          method: 'GET',
          path: '/api/price',
          description:
            'Fetch a topic price response with `topic` or `symbol`. Returns provider metadata, timestamps, series, and the latest price.',
          example: 'GET /api/price?topic=BTC',
        },
      ]}
      relatedTools={relatedTools}
      jsonLd={jsonLd}
      ctaTitle="Need the price in context?"
      ctaDesc="Run the terminal when a simple quote is not enough and you need evidence, catalysts, and narrative linkage."
    />
  );
}
