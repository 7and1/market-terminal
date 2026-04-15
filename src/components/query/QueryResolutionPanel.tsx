'use client';

import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type QueryResolutionReuse = {
  decision: 'reuse';
  reuseType: 'report' | 'asset';
  typedQuery: string;
  canonicalLabel: string;
  lastUpdatedAt: string | null;
  assetKey?: string;
  currentReport?: {
    reportKey: string;
    slug: string;
    sessionId: string;
  };
  latestReport?: {
    reportKey: string;
    slug: string;
    sessionId: string;
  };
  actions: Array<'open_current_report' | 'open_asset_hub' | 'scrape_again'>;
};

type QueryResolutionAmbiguous = {
  decision: 'ambiguous';
  typedQuery: string;
  candidates: Array<{
    id: string;
    label: string;
    targetType: 'report' | 'asset';
    reportKey?: string;
    slug?: string;
    assetKey?: string;
    score: number;
  }>;
  allowRunAsTyped: true;
};

type QueryResolutionRunPrivate = {
  decision: 'run_private';
  typedQuery: string;
  canonicalLabel: string;
  visibility: 'private';
  assetKey?: string | null;
  message: string;
};

export type QueryResolutionPanelState = QueryResolutionReuse | QueryResolutionAmbiguous | QueryResolutionRunPrivate;

function formatTimestamp(value: string | null, locale: string, unknownLabel: string) {
  if (!value) return unknownLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return unknownLabel;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function QueryResolutionPanel({
  resolution,
  onScrapeAgain,
  onRunAsTyped,
  onRunPrivate,
  onDismiss,
  className,
}: {
  resolution: QueryResolutionPanelState | null;
  onScrapeAgain: (resolution: QueryResolutionReuse) => void;
  onRunAsTyped: (resolution: QueryResolutionAmbiguous) => void;
  onRunPrivate: (resolution: QueryResolutionRunPrivate) => void;
  onDismiss?: () => void;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations('queryResolution');
  if (!resolution) return null;

  return (
    <Card className={className ?? 'p-4'}>
      {resolution.decision === 'reuse' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={resolution.reuseType === 'report' ? 'teal' : 'blue'}>
                  {resolution.reuseType === 'report' ? t('cachedReport') : t('cachedAssetHub')}
                </Badge>
                <span className="text-[11px] text-white/45">
                  {t('lastUpdated', {
                    time: formatTimestamp(resolution.lastUpdatedAt, locale, t('unknownUpdateTime')),
                  })}
                </span>
              </div>
              <h3 className="text-base font-semibold text-white/88">{resolution.canonicalLabel}</h3>
              <p className="text-sm text-white/58">{t('reuseDescription')}</p>
            </div>
            {onDismiss ? (
              <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
                {t('dismiss')}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {resolution.currentReport ? (
              <Button asChild size="sm">
                <Link href={`/report/${resolution.currentReport.slug}`}>{t('openCurrentReport')}</Link>
              </Button>
            ) : null}
            {resolution.assetKey ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/asset/${resolution.assetKey}`}>{t('openAssetHub')}</Link>
              </Button>
            ) : null}
            {resolution.latestReport && !resolution.currentReport ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/report/${resolution.latestReport.slug}`}>{t('openLatestReport')}</Link>
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={() => onScrapeAgain(resolution)}>
              {t('scrapeAgain')}
            </Button>
          </div>
        </div>
      ) : resolution.decision === 'ambiguous' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{t('ambiguousBadge')}</Badge>
                <span className="text-[11px] text-white/45">{t('ambiguousHint')}</span>
              </div>
              <h3 className="text-base font-semibold text-white/88">{t('ambiguousTitle')}</h3>
              <p className="text-sm text-white/58">{t('ambiguousDescription')}</p>
            </div>
            {onDismiss ? (
              <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
                {t('dismiss')}
              </Button>
            ) : null}
          </div>

          <div className="grid gap-2">
            {resolution.candidates.map((candidate) => {
              const href =
                candidate.targetType === 'report' && candidate.slug
                  ? `/report/${candidate.slug}`
                  : candidate.assetKey
                    ? `/asset/${candidate.assetKey}`
                    : null;
              return (
                <div
                  key={candidate.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-white/84">{candidate.label}</div>
                    <div className="mt-1 text-[11px] text-white/45">
                      {t('candidateMeta', {
                        target: candidate.targetType === 'report' ? t('currentReportMatch') : t('assetHubMatch'),
                        score: candidate.score.toFixed(3),
                      })}
                    </div>
                  </div>
                  {href ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={href}>{candidate.targetType === 'report' ? t('openReport') : t('openAssetHub')}</Link>
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => onRunAsTyped(resolution)}>
              {t('runAsTyped')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="orange">{t('privateSessionBadge')}</Badge>
                <span className="text-[11px] text-white/45">{t('privateSessionHint')}</span>
              </div>
              <h3 className="text-base font-semibold text-white/88">{resolution.canonicalLabel}</h3>
              <p className="text-sm text-white/58">{resolution.message}</p>
            </div>
            {onDismiss ? (
              <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
                {t('dismiss')}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => onRunPrivate(resolution)}>
              {t('runPrivateAnalysis')}
            </Button>
            {resolution.assetKey ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/asset/${resolution.assetKey}`}>{t('openAssetHubInstead')}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}
