'use client';

import {
  Network,
  RefreshCw,
  Share,
  TrendingUp,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import type { PipelineStep } from '@/components/terminal/PipelineTimeline';

const STEP_KEY: Record<PipelineStep, string> = {
  idle: 'stepIdle',
  plan: 'stepPlan',
  search: 'stepSearch',
  scrape: 'stepScrape',
  extract: 'stepExtract',
  link: 'stepLink',
  cluster: 'stepCluster',
  render: 'stepRender',
  ready: 'stepReady',
};

export function TerminalHeader({
  step,
  progress,
  running,
  session,
  publishing,
  publishedReport,
  snapshotMode,
  terminalMode,
  warnings,
  onRerun,
  onPublish,
  pipelineContent,
  searchBarContent,
}: {
  step: PipelineStep;
  progress: number;
  running: boolean;
  session: { id: string; topic: string; step: PipelineStep } | null;
  publishing: boolean;
  publishedReport: {
    slug: string;
    locale: string;
    fullUrl: string;
    relativeUrl: string;
    alreadyPublished: boolean;
  } | null;
  snapshotMode: boolean;
  terminalMode: 'draft' | 'live' | 'replay';
  warnings: string[];
  onRerun: () => void;
  onPublish: () => void;
  pipelineContent: ReactNode;
  searchBarContent: ReactNode;
}) {
  const t = useTranslations('terminal');
  const nav = useTranslations('nav');
  const common = useTranslations('common');
  const stepLabel = t(STEP_KEY[step]);

  return (
    <header className="relative z-10">
      <div className="mx-auto max-w-[1520px] px-4 py-3">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgba(0,102,255,0.16)] via-transparent to-[rgba(255,82,28,0.12)] opacity-70" />
          <div className="relative space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/"
                  className="inline-flex h-8 items-center rounded-full border border-white/10 bg-white/[0.03] px-3 text-[11px] font-semibold text-white/68 transition hover:bg-white/[0.06]"
                >
                  {common('home')}
                </Link>
                <Link
                  href="/terminal"
                  className="inline-flex h-8 items-center rounded-full border border-[rgba(0,102,255,0.38)] bg-[rgba(0,102,255,0.14)] px-3 text-[11px] font-semibold text-[rgba(174,212,255,0.96)]"
                >
                  {nav('terminal')}
                </Link>
                <Link
                  href="/trending"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 text-[11px] font-semibold text-white/68 transition hover:bg-white/[0.06]"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  {nav('reports')}
                </Link>
                <Link
                  href="/asset"
                  className="inline-flex h-8 items-center rounded-full border border-white/10 bg-white/[0.03] px-3 text-[11px] font-semibold text-white/68 transition hover:bg-white/[0.06]"
                >
                  {common('assets')}
                </Link>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRerun}
                  disabled={!session || running}
                  className="h-8 border-white/12 bg-white/[0.03] px-3 text-[11px]"
                >
                  <RefreshCw className={cn('h-4 w-4', running ? 'animate-spin' : '')} />
                  {t('rerun')}
                </Button>
                {session && session.step === 'ready' && !running && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={publishing}
                    className="h-8 border-white/12 bg-white/[0.03] px-3 text-[11px]"
                    onClick={onPublish}
                  >
                    <Share className="h-4 w-4" />
                    {publishedReport ? common('copied') : publishing ? t('sharing') : common('share')}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5">
                  <Network className="h-5 w-5 text-white/80" />
                </div>
                <div>
                  <div className="text-xs font-semibold tracking-[0.22em] text-white/50">BRIGHT DATA</div>
                  <div className="text-lg font-semibold text-white/90">TrendAnalysis.ai</div>
                </div>
                <div className="hidden items-center gap-2 lg:flex">
                  <div className="h-2 w-2 rounded-full bg-[var(--teal)] shadow-[0_0_0_5px_rgba(20,184,166,0.12)]" />
                  <div className="text-xs text-white/55">{t('session')}: {stepLabel}</div>
                </div>
                <div className="hidden items-center gap-2 lg:flex">
                  <div className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/60">
                    {terminalMode === 'replay' ? t('modeReplay') : terminalMode === 'live' ? t('modeLive') : t('modeDraft')}
                  </div>
                </div>
              </div>

              {searchBarContent}
            </div>

            <div className="border-t border-white/10 pt-3">
              {pipelineContent}

              <div className="relative mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-gradient-to-r from-[rgba(0,102,255,0.9)] via-[rgba(255,82,28,0.85)] to-[rgba(20,184,166,0.8)] transition-[width] duration-500"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <div className="text-[11px] text-white/55">{Math.round(progress * 100)}%</div>
              </div>

              {snapshotMode ? (
                <div className="mt-2 text-xs text-[rgba(173,212,255,0.9)]">
                  {t('snapshotLoaded')}
                </div>
              ) : null}
              {publishedReport ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[rgba(173,212,255,0.92)]">
                  <span>
                    {publishedReport.alreadyPublished ? t('reportReadyExisting') : t('reportReady')}
                  </span>
                  <Link
                    href={`/report/${publishedReport.slug}`}
                    locale={publishedReport.locale}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-white/80 transition hover:bg-white/[0.08]"
                  >
                    {t('openReport')}
                  </Link>
                  <span className="text-white/45">{publishedReport.fullUrl}</span>
                </div>
              ) : null}
              {warnings.length ? (
                <div className="mt-2 text-xs text-[rgba(255,190,125,0.9)]">
                  {warnings.length === 1
                    ? t('warnings', { count: warnings.length })
                    : t('warningsPlural', { count: warnings.length })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
