import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookOpen, Sparkles } from 'lucide-react';

import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { PageBackground } from '@/components/layout/page-background';
import { PageContainer } from '@/components/layout/page-container';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { Card } from '@/components/ui/card';
import { ArchitectureDiagram } from '@/components/how/ArchitectureDiagram';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';

  return {
    title: t('howItWorksTitle'),
    description: t('howItWorksDesc'),
    openGraph: {
      title: t('howItWorksTitle'),
      description: t('howItWorksDesc'),
      type: 'article',
      url: `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/how-it-works`,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('howItWorksTitle'),
      description: t('howItWorksDesc'),
    },
    alternates: {
      canonical: `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/how-it-works`,
      languages: {
        en: `${baseUrl}/how-it-works`,
        es: `${baseUrl}/es/how-it-works`,
        zh: `${baseUrl}/zh/how-it-works`,
        'x-default': `${baseUrl}/how-it-works`,
      },
    },
  };
}

export default async function ArchitecturePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'howItWorks' });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: t('title'),
    description: t('description'),
    step: [
      {
        '@type': 'HowToStep',
        name: t('dataLayerTitle'),
        text: t('dataLayerBody'),
      },
      {
        '@type': 'HowToStep',
        name: t('artifactLayerTitle'),
        text: t('artifactLayerBody'),
      },
      {
        '@type': 'HowToStep',
        name: t('uiLayerTitle'),
        text: t('uiLayerBody'),
      },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PageBackground />
      <SiteHeader />

      <main className="flex-1">
        <PageContainer size="wide" className="pb-14">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <div className="flex flex-wrap items-center gap-2 py-6">
            <Badge tone="blue" className="mono">
              evidence-first
            </Badge>
            <Badge tone="teal" className="mono">
              traceable
            </Badge>
            <a
              href="https://docs.brightdata.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/[0.06]"
            >
              <BookOpen className="h-4 w-4" />
              Bright Data docs
            </a>
          </div>

          <div className="grid gap-5">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold leading-tight text-white/92 sm:text-5xl">
                {t('title')}
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-white/60 sm:text-base">
                {t('description')}
              </p>
            </div>

            <ArchitectureDiagram />

            <Panel
              title={t('notesTitle')}
              hint={t('notesHint')}
              icon={<Sparkles className="h-4 w-4" />}
            >
              <div className="space-y-3 text-sm text-white/72">
                <Card className="p-4">
                  <div className="text-xs font-semibold tracking-[0.18em] text-white/45">{t('dataLayerTitle')}</div>
                  <div className="mt-1">
                    {t('dataLayerBody')}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs font-semibold tracking-[0.18em] text-white/45">{t('artifactLayerTitle')}</div>
                  <div className="mt-1">
                    {t('artifactLayerBody')}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs font-semibold tracking-[0.18em] text-white/45">{t('uiLayerTitle')}</div>
                  <div className="mt-1">
                    {t('uiLayerBody')}
                  </div>
                </Card>
              </div>
            </Panel>
          </div>
        </PageContainer>
      </main>

      <SiteFooter />
    </div>
  );
}
