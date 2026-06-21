import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LandingClient } from '@/components/landing';
import { getLandingProjection } from '@/lib/public-read-model';

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
      'market question',
      'asset analysis',
      'market reports',
      'evidence-based market research',
      'market catalysts',
      'asset hub',
      'macro analysis',
      'market-moving news',
    ],
    category: 'market research',
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
  const metadataT = await getTranslations({ locale, namespace: 'metadata' });
  const landingT = await getTranslations({ locale, namespace: 'landing' });

  const { trendingTopics } = await getLandingProjection();

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${baseUrl}#organization`,
      name: 'TrendAnalysis.ai',
      url: baseUrl,
      logo: `${baseUrl}/icon`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${baseUrl}#website`,
      name: 'TrendAnalysis.ai',
      url: pageUrl,
      description: metadataT('homeDesc'),
      publisher: {
        '@id': `${baseUrl}#organization`,
      },
      inLanguage: locale,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${baseUrl}${localePrefix}/terminal?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: metadataT('homeTitle'),
      description: metadataT('homeDesc'),
      isPartOf: {
        '@id': `${baseUrl}#website`,
      },
      about: ['market research', 'asset analysis', 'macro themes'],
      inLanguage: locale,
    },
    ...(trendingTopics.length > 0
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: landingT('trendingNow'),
            itemListOrder: 'https://schema.org/ItemListOrderDescending',
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
