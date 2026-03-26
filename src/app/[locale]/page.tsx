import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import LandingClient from '@/components/landing/LandingClient';
import { listPublished } from '@/lib/db';
import { filterPublishableSessions } from '@/lib/report-quality';
import { firstEvidenceSentiment } from '@/lib/session-data';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const canonical = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}`;

  return {
    title: { absolute: t('homeTitle') },
    description: t('homeDesc'),
    keywords: [
      'market explanation',
      'asset analysis',
      'market reports',
      'evidence-based market research',
      'market catalysts',
      'asset hub',
    ],
    openGraph: {
      title: t('homeTitle'),
      description: t('homeDesc'),
      type: 'website',
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('homeTitle'),
      description: t('homeDesc'),
    },
    alternates: {
      canonical,
      languages: {
        en: baseUrl,
        es: `${baseUrl}/es`,
        zh: `${baseUrl}/zh`,
        'x-default': baseUrl,
      },
    },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const localePrefix = locale === 'en' ? '' : `/${locale}`;
  const pageUrl = `${baseUrl}${localePrefix}`;

  let trendingTopics: { assetKey: string; label: string; count: number; sentiment: string | null }[] = [];

  try {
    const sessions = filterPublishableSessions(await listPublished());
    const grouped = new Map<string, { count: number; sentiment: string | null }>();

    for (const s of sessions) {
      const ak = s.assetKey as string | undefined;
      if (!ak) continue;

      const existing = grouped.get(ak);
      if (!existing) {
        const sentiment = firstEvidenceSentiment(s.meta);
        grouped.set(ak, { count: 1, sentiment });
      } else {
        existing.count += 1;
      }
    }

    trendingTopics = Array.from(grouped.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([assetKey, data]) => ({
        assetKey,
        label: decodeURIComponent(assetKey).replace(/-/g, ' '),
        count: data.count,
        sentiment: data.sentiment,
      }));
  } catch {
    // Non-critical — render without trending
  }

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'TrendAnalysis.ai',
      url: baseUrl,
      logo: `${baseUrl}/icon`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'TrendAnalysis.ai',
      url: pageUrl,
      description:
        'Evidence-first market explanations with asset hubs, published reports, recurring catalysts, and live supporting data.',
      inLanguage: locale,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${baseUrl}${localePrefix}/terminal?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    ...(trendingTopics.length > 0
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Trending market topics',
            itemListElement: trendingTopics.slice(0, 8).map((topic, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: topic.label,
              url: `${baseUrl}${localePrefix}/asset/${topic.assetKey}`,
            })),
          },
        ]
      : []),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <LandingClient trendingTopics={trendingTopics} />
    </>
  );
}
