import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { ArrowUpRight, Lock, ShieldCheck, Waves } from 'lucide-react';
import { setRequestLocale } from 'next-intl/server';

import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { PageBackground } from '@/components/layout/page-background';
import { PageContainer } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/Badge';
import { PublicApiPlayground } from '@/components/tools/PublicApiPlayground';
import { privateApiPaths, publicApiEntries, toolCatalog } from '@/lib/tool-catalog';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const canonical = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/tools/api`;
  const title = 'TrendAnalysis API - Public Read-Only Research Endpoints';
  const description =
    'Browse the safe public API surface for TrendAnalysis.ai, including health, SERP, price, and video endpoints, while keeping internal runtime routes private.';

  return {
    title,
    description,
    keywords: [
      'TrendAnalysis API',
      'market research API',
      'SERP API',
      'price API',
      'video discovery API',
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
        en: `${baseUrl}/tools/api`,
        es: `${baseUrl}/es/tools/api`,
        zh: `${baseUrl}/zh/tools/api`,
        'x-default': `${baseUrl}/tools/api`,
      },
    },
  };
}

export default async function DeveloperApiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const apiBaseUrl = `${baseUrl}${basePath}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'TrendAnalysis.ai Developer API',
    description:
      'Reference page for the safe public read-only API routes exposed by TrendAnalysis.ai.',
    inLanguage: locale,
  };

  const relatedTools = toolCatalog
    .filter((tool) => tool.section === 'data')
    .slice(0, 3)
    .map((tool) => ({
      href: tool.href,
      title: tool.title,
      description: tool.description,
    }));

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
            <Badge variant="blue">Public read-only API</Badge>
            <h1 className="mt-5 text-3xl font-semibold leading-tight text-white/92 sm:text-5xl">
              Developer API
            </h1>
            <p className="mx-auto mt-4 max-w-[760px] text-sm leading-relaxed text-white/60 sm:text-base">
              TrendAnalysis.ai already has a useful read-only API surface. This page turns it into a
              productized integration layer while keeping session mutation, chat, and runtime control
              routes private.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--blue)]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-sm font-semibold text-white/86">Safe by default</h2>
              <p className="mt-2 text-sm text-white/58">
                Public examples focus on stateless, read-only endpoints that do not mutate sessions or launch runs.
              </p>
            </Card>
            <Card className="p-5">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--blue)]">
                <Waves className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-sm font-semibold text-white/86">Composable capabilities</h2>
              <p className="mt-2 text-sm text-white/58">
                Health, SERP, price, and video routes can each stand alone as a widget, docs example, or integration test.
              </p>
            </Card>
            <Card className="p-5">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--blue)]">
                <Lock className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-sm font-semibold text-white/86">Runtime isolation</h2>
              <p className="mt-2 text-sm text-white/58">
                Write-oriented and stateful routes stay out of the public discovery surface to avoid accidental misuse.
              </p>
            </Card>
          </div>

          <section className="mt-16">
            <h2 className="text-xl font-semibold text-white/88 sm:text-2xl">Interactive playground</h2>
            <p className="mt-2 max-w-[760px] text-sm leading-relaxed text-white/55">
              This playground only targets public GET routes. It is meant for inspection, onboarding, and light demos,
              not for launching runs or mutating session state.
            </p>
            <div className="mt-5">
              <PublicApiPlayground />
            </div>
          </section>

          <section className="mt-16">
            <h2 className="text-xl font-semibold text-white/88 sm:text-2xl">Public endpoints</h2>
            <p className="mt-2 max-w-[760px] text-sm leading-relaxed text-white/55">
              These are the routes best suited for external docs, product demos, and light client-side exploration.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {publicApiEntries.map((entry) => (
                <Card key={entry.path} className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="teal">{entry.method}</Badge>
                    <code className="text-sm text-white/84">{entry.path}</code>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-white/86">{entry.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/58">{entry.description}</p>
                  {entry.exampleQuery ? (
                    <pre className="mt-4 overflow-x-auto rounded-xl border border-white/8 bg-black/25 p-3 text-xs text-white/68">
                      <code>{entry.exampleQuery}</code>
                    </pre>
                  ) : null}
                  {entry.exampleQuery ? (
                    <pre className="mt-3 overflow-x-auto rounded-xl border border-white/8 bg-black/25 p-3 text-xs text-white/54">
                      <code>{`curl "${apiBaseUrl}${entry.exampleQuery}"`}</code>
                    </pre>
                  ) : null}
                  {entry.exampleQuery ? (
                    <a
                      href={`${apiBaseUrl}${entry.exampleQuery}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/74 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      Open example <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </Card>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <h2 className="text-xl font-semibold text-white/88 sm:text-2xl">Private runtime routes</h2>
            <p className="mt-2 max-w-[760px] text-sm leading-relaxed text-white/55">
              These endpoints are intentionally not part of the public SEO surface because they create runs, mutate state, or expose internal operational views.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {privateApiPaths.map((path) => (
                <Card key={path} className="p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="orange">Private</Badge>
                    <code className="text-sm text-white/80">{path}</code>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <h2 className="text-xl font-semibold text-white/88 sm:text-2xl">Integration notes</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-white/86">Read-only by design</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/58">
                  Keep public docs anchored on stateless GET calls. Session creation, chat, and monitor control should
                  remain outside public-facing examples.
                </p>
              </Card>
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-white/86">Good for widgets</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/58">
                  `health`, `serp`, `price`, and `videos` can power landing-page modules, internal debug tools, or
                  partner-facing demos without exposing runtime internals.
                </p>
              </Card>
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-white/86">Escalate to terminal later</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/58">
                  Once a user outgrows a simple GET response, route them into the full terminal flow for evidence
                  extraction, linking, clustering, and publishable outputs.
                </p>
              </Card>
            </div>
          </section>

          <section className="mt-16">
            <h2 className="text-xl font-semibold text-white/88 sm:text-2xl">Related tools</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {relatedTools.map((tool) => (
                <Link key={tool.href} href={tool.href}>
                  <Card className="h-full p-5 transition hover:border-white/20 hover:bg-white/[0.06]">
                    <h3 className="text-sm font-semibold text-white/86">{tool.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-white/52">{tool.description}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        </PageContainer>
      </main>

      <SiteFooter />
    </div>
  );
}
