import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Code2,
  GitBranch,
  Newspaper,
  PlaySquare,
  Search,
} from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { PageBackground } from '@/components/layout/page-background';
import { PageContainer } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/Badge';
import { toolCatalog, toolSections } from '@/lib/tool-catalog';

const ICONS = {
  'market-analyzer': BarChart3,
  'evidence-graph': GitBranch,
  'news-analyzer': Newspaper,
  'serp-explorer': Search,
  'price-snapshot': Activity,
  'video-radar': PlaySquare,
  api: Code2,
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const canonical = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/tools`;

  return {
    title: t('toolsTitle'),
    description: t('toolsDesc'),
    keywords: [
      'market research tools',
      'stock analysis tools',
      'trend analyzer',
      'evidence graph',
      'news analyzer',
      'SERP explorer',
      'market API',
    ],
    openGraph: {
      title: t('toolsTitle'),
      description: t('toolsDesc'),
      type: 'website',
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('toolsTitle'),
      description: t('toolsDesc'),
    },
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}/tools`,
        es: `${baseUrl}/es/tools`,
        zh: `${baseUrl}/zh/tools`,
        'x-default': `${baseUrl}/tools`,
      },
    },
  };
}

export default async function ToolsIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'TrendAnalysis.ai Tools',
    description:
      'Evidence-first market research tools and read-only API surfaces powered by live search, price, video, and graph pipelines.',
    inLanguage: locale,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: toolCatalog.map((tool, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: tool.title,
        description: tool.description,
        url: `${baseUrl}${locale === 'en' ? '' : `/${locale}`}${tool.href}`,
      })),
    },
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PageBackground />
      <SiteHeader />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="flex-1">
        <PageContainer className="py-14 sm:py-20">
          <div className="text-center">
            <Badge variant="blue">Secondary entry points</Badge>
            <h1 className="mt-5 text-3xl font-semibold leading-tight text-white/92 sm:text-5xl">
              Tools that support the asset and report engine
            </h1>
            <p className="mx-auto mt-4 max-w-[760px] text-sm text-white/60 sm:text-base">
              TrendAnalysis.ai should primarily win through asset hubs and published reports. These
              pages exist as supporting entry points for users who want to inspect one workflow,
              one data surface, or one read-only API before moving deeper into the core content.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                Start with assets
              </div>
              <p className="mt-2 text-sm text-white/62">
                Asset hubs and published reports are the main product surfaces. Use tools only when
                you need to inspect a specific workflow behind them.
              </p>
            </Card>
            <Card className="p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                Use tools selectively
              </div>
              <p className="mt-2 text-sm text-white/62">
                These pages are best for narrow tasks like checking SERPs, pulling a price
                snapshot, or validating one research flow before reading a report.
              </p>
            </Card>
            <Card className="p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                Route back to content
              </div>
              <p className="mt-2 text-sm text-white/62">
                Every tool page should send users back into fresher, deeper surfaces such as asset
                hubs, recent reports, or the full terminal.
              </p>
            </Card>
          </div>

          <div className="mt-14 space-y-12">
            {toolSections.map((section) => {
              const sectionTools = toolCatalog.filter((tool) => tool.section === section.id);

              return (
                <section key={section.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
                        {section.id}
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold text-white/90">{section.title}</h2>
                      <p className="mt-2 max-w-[760px] text-sm text-white/55">{section.description}</p>
                    </div>
                    <div className="text-xs text-white/38">
                      {sectionTools.length} page{sectionTools.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {sectionTools.map((tool) => {
                      const Icon = ICONS[tool.slug as keyof typeof ICONS] || BarChart3;
                      return (
                        <Link key={tool.href} href={tool.href} className="group">
                          <Card className="h-full p-6 transition hover:border-white/20 hover:bg-white/[0.06]">
                            <div className="mb-4 flex items-start justify-between gap-3">
                              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--blue)]">
                                <Icon className="h-5 w-5" />
                              </div>
                              {tool.endpoint ? (
                                <Badge variant={tool.endpoint.method === 'GET' ? 'teal' : 'orange'}>
                                  {tool.endpoint.method}
                                </Badge>
                              ) : (
                                <Badge variant="blue">Docs</Badge>
                              )}
                            </div>
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-white/88">
                              {tool.title}
                              <ArrowUpRight className="h-3.5 w-3.5 text-white/40 transition group-hover:text-white/70" />
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-white/52">
                              {tool.description}
                            </p>
                            {tool.endpoint ? (
                              <div className="mt-4 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-xs text-white/60">
                                <span className="text-white/38">Endpoint:</span>{' '}
                                <code>{tool.endpoint.path}</code>
                              </div>
                            ) : null}
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </PageContainer>
      </main>

      <SiteFooter />
    </div>
  );
}
