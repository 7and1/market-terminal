'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  FileText,
  GitBranch,
  LineChart,
  Search,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { PageBackground } from '@/components/layout/page-background';
import { QueryResolutionPanel, type QueryResolutionPanelState } from '@/components/query/QueryResolutionPanel';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { getLandingExamples } from '@/lib/query-copy';
import { apiPath } from '@/lib/utils';

const LAST_SESSION_KEY = 'market_terminal:last_session_id';

const SENTIMENT_DOT: Record<string, string> = {
  bullish: 'bg-emerald-400',
  bearish: 'bg-red-400',
  mixed: 'bg-amber-400',
  neutral: 'bg-white/40',
};

const REPORT_ROW_DOTS = ['bg-emerald-400/80', 'bg-amber-400/80', 'bg-[var(--blue)]'];

function isLikelySessionId(raw: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
}

type TrendingTopic = {
  assetKey: string;
  label: string;
  count: number;
  sentiment: string | null;
  summary: string | null;
  evidenceCount: number;
  domainCount: number;
};

export default function LandingClient({ trendingTopics = [] }: { trendingTopics?: TrendingTopic[] }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('landing');
  const tc = useTranslations('common');
  const landingExamples = getLandingExamples(locale);
  const publishedReportTopics = trendingTopics.slice(0, 3);
  const flowSteps = [
    {
      step: '01',
      title: t('flowQuestionTitle'),
      description: t('flowQuestionDesc'),
    },
    {
      step: '02',
      title: t('flowResolveTitle'),
      description: t('flowResolveDesc'),
    },
    {
      step: '03',
      title: t('flowRunTitle'),
      description: t('flowRunDesc'),
    },
  ];
  const [query, setQuery] = useState('');
  const [typedHint, setTypedHint] = useState('');
  const [activeExample, setActiveExample] = useState<string>(landingExamples[0] ?? '');
  const [resolution, setResolution] = useState<QueryResolutionPanelState | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [lastSessionId, setLastSessionId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const snapshotId = params.get('sessionId');
    if (snapshotId) {
      router.replace(`/terminal?sessionId=${encodeURIComponent(snapshotId)}`);
      return;
    }
    const legacyQuery = (params.get('q') || params.get('topic') || '').trim();
    if (legacyQuery) {
      router.replace(`/terminal?q=${encodeURIComponent(legacyQuery)}`);
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = (window.localStorage.getItem(LAST_SESSION_KEY) || '').trim();
    if (!stored) return;
    if (!isLikelySessionId(stored)) {
      window.localStorage.removeItem(LAST_SESSION_KEY);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const validateStoredSession = async () => {
      const params = new URLSearchParams({ sessionId: stored, limit: '1' });
      try {
        const res = await fetch(apiPath(`/api/sessions/events?${params.toString()}`), {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (cancelled) return;
        if (res.ok) {
          setLastSessionId(stored);
          return;
        }
        if ([400, 403, 404].includes(res.status)) {
          window.localStorage.removeItem(LAST_SESSION_KEY);
        }
        setLastSessionId('');
      } catch {
        if (!cancelled) setLastSessionId('');
      }
    };

    void validateStoredSession();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (query.trim()) return;
    if (landingExamples.length === 0) return;

    let stopped = false;
    let timer: number | null = null;
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const schedule = (ms: number) => {
      timer = window.setTimeout(tick, ms);
    };

    const tick = () => {
      if (stopped) return;
      const phrase = landingExamples[phraseIndex % landingExamples.length];
      setActiveExample(phrase);

      if (!deleting) {
        charIndex = Math.min(phrase.length, charIndex + 1);
        setTypedHint(phrase.slice(0, charIndex));
        if (charIndex === phrase.length) {
          deleting = true;
          schedule(1100);
          return;
        }
        schedule(30);
        return;
      }

      charIndex = Math.max(0, charIndex - 1);
      setTypedHint(phrase.slice(0, charIndex));
      if (charIndex === 0) {
        deleting = false;
        phraseIndex += 1;
        schedule(240);
        return;
      }
      schedule(18);
    };

    schedule(280);
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [landingExamples, query]);

  const buildTerminalUrl = ({
    typedQuery,
    reportKey,
    runReason,
  }: {
    typedQuery: string;
    reportKey?: string | null;
    runReason: 'direct' | 'refresh' | 'run_as_typed';
  }) => {
    const params = new URLSearchParams({
      q: typedQuery,
      runAt: String(Date.now()),
      runReason,
    });
    if (reportKey) params.set('reportKey', reportKey);
    return `/terminal?${params.toString()}`;
  };

  const runSearch = async () => {
    const cleaned = query.trim() || activeExample.trim();
    if (!cleaned) return;
    setResolving(true);
    setResolveError(null);
    setResolution(null);
    try {
      const res = await fetch(apiPath('/api/query/resolve'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: cleaned, surface: 'landing', locale }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : t('resolveFailed'));

      if (data.decision === 'reject') {
        const message = typeof data.message === 'string' ? data.message : t('rejectFallback');
        const examples = Array.isArray(data.supportedExamples)
          ? data.supportedExamples.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 3)
          : [];
        setResolveError([message, examples.length ? t('tryExamples', { examples: examples.join(' | ') }) : ''].filter(Boolean).join(' '));
        return;
      }

      if (data.decision === 'reuse' || data.decision === 'ambiguous' || data.decision === 'run_private') {
        setResolution(data as QueryResolutionPanelState);
        return;
      }

      router.push(
        buildTerminalUrl({
          typedQuery: cleaned,
          reportKey: typeof data.reportKey === 'string' ? data.reportKey : null,
          runReason: 'direct',
        }),
      );
    } catch (error) {
      setResolveError(error instanceof Error ? error.message : t('resolveFailed'));
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PageBackground />
      <SiteHeader />

      <main className="mx-auto max-w-[1120px] px-4 pb-14 pt-12 sm:pt-20 flex-1">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-6 sm:-inset-10">
            <TrendingUp className="finance-float absolute left-[4%] top-[8%] h-7 w-7 text-[rgba(120,196,255,0.35)]" style={{ animationDelay: '0.1s' }} />
            <LineChart className="finance-float absolute right-[6%] top-[14%] h-7 w-7 text-[rgba(120,196,255,0.34)]" style={{ animationDelay: '0.3s' }} />
            <Activity className="finance-float absolute left-[10%] top-[72%] h-6 w-6 text-[rgba(0,102,255,0.3)]" style={{ animationDelay: '0.8s' }} />
            <BarChart3 className="finance-float absolute right-[8%] top-[68%] h-6 w-6 text-[rgba(120,196,255,0.3)]" style={{ animationDelay: '1.2s' }} />
          </div>

          <section className="relative overflow-hidden py-4 text-center sm:py-8">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[rgba(0,102,255,0.45)] bg-[rgba(0,102,255,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(182,220,255,0.95)]">
              <Sparkles className="h-3.5 w-3.5" />
              {t('badge')}
            </div>

            <h1 className="mt-5 text-3xl font-semibold leading-tight text-white/92 sm:text-5xl">
              {t('heroTitle1')}
              <br />
              {t('heroTitle2')}
            </h1>
            <p className="mx-auto mt-4 max-w-[760px] text-sm text-white/66 sm:text-base">
              {t('heroDesc')}
            </p>
            <div className="mx-auto mt-5 flex max-w-[760px] flex-wrap items-center justify-center gap-2 text-[11px] text-white/58">
              <span className="rounded-full border border-[rgba(0,102,255,0.32)] bg-[rgba(0,102,255,0.1)] px-3 py-1 font-medium text-[rgba(199,228,255,0.94)]">
                {t('heroQuestionLabel')}
              </span>
              <span>{t('heroQuestionHint')}</span>
            </div>

            <form
              className="mx-auto mt-7 max-w-[860px] rounded-xl border border-white/12 bg-black/28 p-2 shadow-[0_24px_90px_-58px_rgba(0,102,255,0.7)] sm:p-2.5"
              aria-busy={resolving}
              onSubmit={(e) => {
                e.preventDefault();
                runSearch();
              }}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border bg-white/[0.03] px-3 sm:px-4 transition-all ${query.trim() ? 'border-white/8' : 'border-[rgba(0,102,255,0.3)] shadow-[0_0_20px_-4px_rgba(0,102,255,0.25)]'}`}>
                  <Search className="h-4 w-4 shrink-0 text-white/46" />
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setResolution(null);
                      setResolveError(null);
                    }}
                    placeholder={query.trim() ? t('searchPlaceholder') : typedHint || t('searchPlaceholder')}
                    className="h-11 w-full border-0 bg-transparent text-sm text-white/90 outline-none placeholder:text-white/42 focus-visible:ring-2 focus-visible:ring-[rgba(0,102,255,0.35)] focus-visible:ring-offset-0"
                    aria-label={t('searchAriaLabel')}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={resolving || (!query.trim() && !activeExample.trim())}
                  size="lg"
                  className="border-[rgba(0,102,255,0.42)] bg-[rgba(0,102,255,0.2)] text-[rgba(199,228,255,0.98)] hover:bg-[rgba(0,102,255,0.28)]"
                >
                  {resolving ? t('resolvingCta') : tc('analyze')}
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </div>
            </form>

            {resolution ? (
              <QueryResolutionPanel
                resolution={resolution}
                className="mx-auto mt-4 max-w-[860px] text-left"
                onDismiss={() => setResolution(null)}
                onRunAsTyped={(next) =>
                  router.push(
                    buildTerminalUrl({
                      typedQuery: next.typedQuery,
                      runReason: 'run_as_typed',
                    }),
                  )
                }
                onRunPrivate={(next) =>
                  router.push(
                    buildTerminalUrl({
                      typedQuery: next.typedQuery,
                      runReason: 'direct',
                    }),
                  )
                }
                onScrapeAgain={(next) =>
                  router.push(
                    buildTerminalUrl({
                      typedQuery: next.typedQuery,
                      reportKey: next.reuseType === 'report' ? next.currentReport?.reportKey : null,
                      runReason: 'refresh',
                    }),
                  )
                }
              />
            ) : null}
            {resolveError ? (
              <div className="mx-auto mt-4 max-w-[860px] rounded-2xl border border-[rgba(255,190,125,0.25)] bg-[rgba(255,190,125,0.06)] px-4 py-3 text-left text-sm text-[rgba(255,212,170,0.92)]">
                {resolveError}
              </div>
            ) : null}

            <div className="mx-auto mt-4 grid max-w-[860px] gap-2 text-left sm:grid-cols-3">
              {flowSteps.map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(182,220,255,0.72)]">
                    {item.step}
                  </div>
                  <div className="mt-1 text-sm font-medium text-white/86">{item.title}</div>
                  <p className="mt-1 text-xs leading-relaxed text-white/56">{item.description}</p>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-3 max-w-[860px] text-left text-[11px] leading-relaxed text-white/48 sm:text-center">
              {t('marketOnlyHint')}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-white/52">
              <span>{t('publicRoutesLabel')}</span>
              <Link
                href="/trending"
                className="font-medium text-[var(--blue)] transition hover:text-white/82"
              >
                {t('hubReportsCta')}
              </Link>
              <span className="text-white/20">&middot;</span>
              <Link
                href="/asset"
                className="font-medium text-[var(--blue)] transition hover:text-white/82"
              >
                {t('hubAssetsCta')}
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {landingExamples.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="inline-flex h-8 items-center rounded-full border border-white/12 bg-white/[0.03] px-3 text-xs text-white/66 transition hover:bg-white/[0.06] hover:text-white/84 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,102,255,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(4,10,24,0.92)]"
                  onClick={() => setQuery(example)}
                >
                  {example}
                </button>
              ))}
              {lastSessionId ? (
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-full border border-[rgba(0,102,255,0.32)] bg-[rgba(0,102,255,0.14)] px-3 text-xs text-[rgba(199,228,255,0.96)] transition hover:bg-[rgba(0,102,255,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,102,255,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(4,10,24,0.92)]"
                  onClick={() => router.push(`/terminal?sessionId=${encodeURIComponent(lastSessionId)}`)}
                >
                  {t('resumeLastSession')}
                </button>
              ) : null}
            </div>

            <div className="mt-9 text-left sm:text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/42">
                {t('continueTitle')}
              </div>
              <p className="mx-auto mt-2 max-w-[680px] text-sm leading-relaxed text-white/58">
                {t('continueDesc')}
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Card className="p-4 text-left">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/42">
                  {t('terminalCardTitle')}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/56">
                  {t('terminalCardDesc')}
                </p>
                <Link
                  href="/terminal"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--blue)] transition hover:text-white/82"
                >
                  {t('terminalCardCta')} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Card>

              <Card className="p-4 text-left">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/42">
                  {t('hubReportsTitle')}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/56">
                  {t('hubReportsDesc')}
                </p>
                <Link
                  href="/trending"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--blue)] transition hover:text-white/82"
                >
                  {t('hubReportsCta')} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Card>

              <Card className="p-4 text-left">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/42">
                  {t('hubAssetsTitle')}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/56">
                  {t('hubAssetsDesc')}
                </p>
                <Link
                  href="/asset"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--blue)] transition hover:text-white/82"
                >
                  {t('hubAssetsCta')} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Card>
            </div>

            {/* Trending Section */}
            {trendingTopics.length > 0 && (
              <div className="mt-6">
                <div className="mb-2.5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/48">
                  <TrendingUp className="h-3.5 w-3.5 text-[var(--blue)]" />
                  {t('trendingNow')}
                  <Link
                    href="/trending"
                    className="ml-1 normal-case tracking-normal text-[var(--blue)] transition hover:text-white/80"
                  >
                    {tc('viewAll')} &rarr;
                  </Link>
                </div>
                <p className="mx-auto mb-3 max-w-[680px] text-center text-xs leading-relaxed text-white/52">
                  {t('trendingNowDesc')}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {trendingTopics.map((tt) => (
                    <Link
                      key={tt.assetKey}
                      href={`/asset/${tt.assetKey}`}
                      className="block"
                    >
                      <Card className="h-full p-4 text-left transition hover:border-white/20 hover:bg-white/[0.06]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold text-white/86">
                            {tt.label.charAt(0).toUpperCase() + tt.label.slice(1)}
                          </div>
                          {tt.sentiment ? (
                            <span className={`mt-1 h-2 w-2 rounded-full ${SENTIMENT_DOT[tt.sentiment] ?? SENTIMENT_DOT.neutral}`} />
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-white/54">
                          {tt.summary || t('trendingFallbackSummary')}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/42">
                          <span>{tt.count} {t('trendingAnalysesLabel')}</span>
                          <span className="text-white/20">&middot;</span>
                          <span>{tt.evidenceCount} {t('trendingEvidenceLabel')}</span>
                          <span className="text-white/20">&middot;</span>
                          <span>{tt.domainCount} {t('trendingDomainsLabel')}</span>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Feature Cards */}
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Card className="p-4 text-center">
                <div className="inline-flex items-center justify-center gap-2 text-xs font-semibold tracking-[0.12em] text-white/48 uppercase">
                  <Zap className="h-3.5 w-3.5 text-[var(--blue)]" />
                  {t('realTimeIntel')}
                </div>
                <p className="mt-2 text-[11px] text-white/50">{t('realTimeIntelDesc')}</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                  {[t('stepPlan'), t('stepSearch'), t('stepExtract'), t('stepAnalyze')].map((step) => (
                    <span
                      key={step}
                      className="inline-flex h-6 items-center rounded-full border border-white/12 bg-white/[0.04] px-2 text-[10px] text-white/72"
                    >
                      {step}
                    </span>
                  ))}
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="pipeline-progress h-full rounded-full bg-gradient-to-r from-[var(--blue)] via-[rgba(120,196,255,0.95)] to-[rgba(170,209,255,0.95)]" />
                </div>
              </Card>

              <Card className="p-4 text-center">
                <div className="inline-flex items-center justify-center gap-2 text-xs font-semibold tracking-[0.12em] text-white/48 uppercase">
                  <GitBranch className="h-3.5 w-3.5 text-[var(--blue)]" />
                  {t('knowledgeGraphs')}
                </div>
                <p className="mt-2 text-[11px] text-white/50">{t('knowledgeGraphsDesc')}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[t('viewGraph'), t('viewMindMap'), t('viewFlow'), t('viewTimeline')].map((view) => (
                    <span
                      key={view}
                      className="inline-flex h-7 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] text-[10px] font-semibold text-white/75"
                    >
                      {view}
                    </span>
                  ))}
                </div>
              </Card>

              <Card className="p-4 text-center">
                <div className="inline-flex items-center justify-center gap-2 text-xs font-semibold tracking-[0.12em] text-white/48 uppercase">
                  <FileText className="h-3.5 w-3.5 text-[var(--blue)]" />
                  {t('publishedReports')}
                </div>
                <p className="mt-2 text-[11px] text-white/50">{t('publishedReportsDesc')}</p>
                {publishedReportTopics.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {publishedReportTopics.map((topic, index) => (
                      <Link
                        key={topic.assetKey}
                        href={`/asset/${topic.assetKey}`}
                        className="mx-auto flex h-7 w-[92%] items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-2 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${REPORT_ROW_DOTS[index] ?? REPORT_ROW_DOTS[0]}`} />
                        <span className="truncate text-[9px] text-white/50">
                          {topic.label.charAt(0).toUpperCase() + topic.label.slice(1)}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="mx-auto mt-3 flex min-h-20 w-[92%] items-center justify-center rounded-lg border border-dashed border-white/12 bg-white/[0.025] px-3 text-[11px] leading-relaxed text-white/45">
                    {tc('noPublishedAnalyses')}
                  </div>
                )}
              </Card>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
