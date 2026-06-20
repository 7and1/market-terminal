import { type ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { ToolSearchBox } from './ToolSearchBox';

import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { PageBackground } from '@/components/layout/page-background';
import { PageContainer } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/Badge';

export interface ToolFeature {
  icon: ReactNode;
  title: string;
  description: string;
}

export interface ToolApiSurface {
  method: 'GET' | 'POST';
  path: string;
  description: string;
  example?: string;
}

export interface RelatedToolLink {
  href: string;
  title: string;
  description: string;
}

interface ToolPageLayoutProps {
  title: string;
  description: string;
  keywords: string[];
  features: ToolFeature[];
  searchPlaceholder: string;
  exampleOutput?: ReactNode;
  statsLine: string;
  jsonLd?: Record<string, unknown>;
  ctaTitle?: string;
  ctaDesc?: string;
  exampleOutputLabel?: string;
  liveDemo?: ReactNode;
  liveDemoTitle?: string;
  liveDemoDesc?: string;
  useCases?: string[];
  apiSurface?: ToolApiSurface[];
  relatedTools?: RelatedToolLink[];
  showHeroSearch?: boolean;
}

export function ToolPageLayout({
  title,
  description,
  features,
  searchPlaceholder,
  exampleOutput,
  statsLine,
  jsonLd,
  ctaTitle = 'Ready to analyze?',
  ctaDesc = 'Enter any market topic and get evidence-backed insights in seconds.',
  exampleOutputLabel = 'Example Output',
  liveDemo,
  liveDemoTitle = 'Live Tool',
  liveDemoDesc = 'Run the public-facing version of this capability directly in the browser.',
  useCases = [],
  apiSurface = [],
  relatedTools = [],
  showHeroSearch = true,
}: ToolPageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <PageBackground />
      <SiteHeader />

      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <main className="flex-1">
        <PageContainer className="py-14 sm:py-20">
          {/* Hero */}
          <div className="text-center">
            <h1 className="text-3xl font-semibold leading-tight text-white/92 sm:text-5xl">
              {title}
            </h1>
            <p className="mx-auto mt-4 max-w-[660px] text-sm text-white/60 sm:text-base">
              {description}
            </p>
            {showHeroSearch ? <ToolSearchBox placeholder={searchPlaceholder} /> : null}
          </div>

          {liveDemo ? (
            <div className="mt-16">
              <h2 className="text-center text-xl font-semibold text-white/88 sm:text-2xl">{liveDemoTitle}</h2>
              <p className="mx-auto mt-2 max-w-[760px] text-center text-sm leading-relaxed text-white/55">
                {liveDemoDesc}
              </p>
              <div className="mt-5">{liveDemo}</div>
            </div>
          ) : null}

          {/* Features */}
          <div className="mt-16 grid gap-4 sm:grid-cols-2">
            {features.map((f) => (
              <Card key={f.title} className="p-5">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--blue)]">
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-white/88">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-white/52">
                  {f.description}
                </p>
              </Card>
            ))}
          </div>

          {useCases.length > 0 && (
            <div className="mt-16">
              <h2 className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
                Best-Fit Use Cases
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {useCases.map((item) => (
                  <Card key={item} className="p-4 text-sm leading-relaxed text-white/68">
                    {item}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {exampleOutput ? (
            <div className="mt-16">
              <h2 className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
                {exampleOutputLabel}
              </h2>
              <Card className="overflow-hidden p-5 sm:p-6">
                {exampleOutput}
              </Card>
            </div>
          ) : null}

          {/* Stats */}
          <p className="mt-10 text-center text-xs text-white/40">{statsLine}</p>

          {apiSurface.length > 0 && (
            <div className="mt-16">
              <h2 className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
                API Surface
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {apiSurface.map((api) => (
                  <Card key={`${api.method}:${api.path}`} className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={api.method === 'GET' ? 'teal' : 'orange'}>{api.method}</Badge>
                      <code className="text-sm text-white/82">{api.path}</code>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-white/58">{api.description}</p>
                    {api.example ? (
                      <pre className="mt-4 overflow-x-auto rounded-xl border border-white/8 bg-black/25 p-3 text-xs text-white/68">
                        <code>{api.example}</code>
                      </pre>
                    ) : null}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {relatedTools.length > 0 && (
            <div className="mt-16">
              <h2 className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
                Related Tools
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {relatedTools.map((tool) => (
                  <Link key={tool.href} href={tool.href}>
                    <Card className="h-full p-5 transition hover:border-white/20 hover:bg-white/[0.06]">
                      <h3 className="text-sm font-semibold text-white/86">{tool.title}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-white/52">{tool.description}</p>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="mt-14 text-center">
            <h2 className="text-xl font-semibold text-white/88 sm:text-2xl">
              {ctaTitle}
            </h2>
            <p className="mt-2 text-sm text-white/52">
              {ctaDesc}
            </p>
            <ToolSearchBox placeholder={searchPlaceholder} />
          </div>
        </PageContainer>
      </main>

      <SiteFooter />
    </div>
  );
}
