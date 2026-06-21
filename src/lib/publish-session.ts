import {
  findApprovedDynamicCatalogHeadForTopic,
  getReportHead,
  listByAsset,
  publishSession,
  upsertAssetDailyMetric,
  type ReportHeadRow,
  type SessionRow,
} from '@/lib/db';
import { filterPublishableSessions, summarizeSessionQuality } from '@/lib/report-quality';
import { aggregateAssetData } from '@/lib/asset-aggregation';
import {
  deriveCanonicalLabelFromTopic,
  deriveReportKeyFromTopic,
  deriveTopicVisibility,
  normalizeAssetKeyFromTopic,
  syncPublishedSessionTargets,
} from '@/lib/topic-resolution';

const SLUG_SUFFIX_LENGTHS = [4, 8, 12] as const;
const FALLBACK_ASSET_KEY = 'asset';
const FALLBACK_SLUG_KEY = 'report';

export type PromoteReadySessionResult =
  | {
      ok: true;
      alreadyPublished: boolean;
      slug: string;
      assetKey: string;
      reportKey: string;
      canonicalLabel: string;
      subjectKey: string;
      previousHead: ReportHeadRow | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
      code:
        | 'SESSION_NOT_READY'
        | 'INSUFFICIENT_REPORT_QUALITY'
        | 'PRIVATE_ONLY_SESSION'
        | 'PUBLISH_FAILED';
      quality?: ReturnType<typeof summarizeSessionQuality>;
      visibility?: 'private';
      canonicalLabel?: string;
    };

function slugifyKey(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned.slice(0, 40) || FALLBACK_SLUG_KEY;
}

function generateSlug(slugBase: string, sessionId: string, suffixLength: number): string {
  const date = new Date().toISOString().slice(0, 10);
  const key = slugifyKey(slugBase);
  const short = sessionId.replace(/-/g, '').slice(0, suffixLength) || 'sess';
  return `${key}-${date}-${short}`;
}

function isSlugConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const pg = error as { code?: string; constraint?: string };
  if (pg.code !== '23505') return false;
  return !pg.constraint || pg.constraint.includes('slug');
}

async function materializePublishedAssetMetrics(assetKey: string) {
  const sessions = filterPublishableSessions(await listByAsset(assetKey, 500));
  if (!sessions.length) return;
  const aggregation = aggregateAssetData(sessions, assetKey);
  const metricDate = new Date().toISOString().slice(0, 10);
  await upsertAssetDailyMetric({
    assetKey,
    metricDate,
    summary: aggregation as unknown as Record<string, unknown>,
    metrics: {
      totalAnalyses: aggregation.totalAnalyses,
      latestAnalysisDate: aggregation.latestAnalysisDate,
      latestSentiment: aggregation.latestSentiment,
      reportCount: aggregation.reports.length,
      catalystCount: aggregation.topCatalysts.length,
      entityCount: aggregation.topEntities.length,
      peerAssetCount: aggregation.peerAssets.length,
    },
  });
}

export async function promoteReadySessionToPublicHead(
  session: SessionRow,
  options?: {
    locale?: string;
  },
): Promise<PromoteReadySessionResult> {
  const locale = options?.locale;
  const topicVisibility = deriveTopicVisibility(session.topic, locale);
  const dynamicHead = topicVisibility.visibility === 'private'
    ? await findApprovedDynamicCatalogHeadForTopic(session.topic).catch(() => null)
    : null;
  const dynamicAssetKey = dynamicHead?.assetKey || dynamicHead?.key || null;
  const dynamicReportKey = dynamicHead
    ? dynamicHead.reportKey || `${dynamicAssetKey || dynamicHead.key}-general`
    : null;
  const effectiveVisibility = dynamicHead
    ? {
        visibility: 'public' as const,
        canonicalLabel: dynamicHead.label,
        assetKey: dynamicAssetKey,
        reportKey: dynamicReportKey,
        subjectKey: dynamicHead.key,
        publicSurface: dynamicHead.publicSurface,
        priorityTier: dynamicHead.priorityTier,
      }
    : topicVisibility;
  const derivedReportKey = deriveReportKeyFromTopic(session.topic, locale);
  const trustedReportKey =
    effectiveVisibility.visibility === 'public'
      ? effectiveVisibility.reportKey || deriveReportKeyFromTopic(session.topic, locale)
      : null;
  const trustedCanonicalLabel = effectiveVisibility.canonicalLabel || deriveCanonicalLabelFromTopic(session.topic, locale);
  const trustedAssetKey = effectiveVisibility.assetKey || normalizeAssetKeyFromTopic(session.topic, locale) || FALLBACK_ASSET_KEY;
  if (session.status !== 'ready') {
    return {
      ok: false,
      status: 400,
      error: 'Session is not ready',
      code: 'SESSION_NOT_READY',
    };
  }

  if (session.published && session.slug) {
    return {
      ok: true,
      alreadyPublished: true,
      slug: session.slug,
      assetKey: trustedAssetKey,
      reportKey: trustedReportKey || session.reportKey || derivedReportKey,
      canonicalLabel: trustedCanonicalLabel,
      subjectKey: effectiveVisibility.subjectKey || trustedAssetKey,
      previousHead: trustedReportKey ? await getReportHead(trustedReportKey).catch(() => null) : null,
    };
  }

  const quality = summarizeSessionQuality(session);
  if (!quality.publishable) {
    return {
      ok: false,
      status: 422,
      error: [
        'This run does not meet the public report threshold yet.',
        ...quality.issues,
      ].join(' '),
      code: 'INSUFFICIENT_REPORT_QUALITY',
      quality,
    };
  }

  if (effectiveVisibility.visibility !== 'public') {
    return {
      ok: false,
      status: 422,
      error:
        'This analysis remains a private saved session because the query does not map to a canonical public asset head.',
      code: 'PRIVATE_ONLY_SESSION',
      visibility: 'private',
      canonicalLabel: topicVisibility.canonicalLabel,
    };
  }

  const assetKey = trustedAssetKey;
  const reportKey = trustedReportKey || derivedReportKey;
  const slugBase = reportKey || effectiveVisibility.canonicalLabel || session.topic;
  const previousHead = await getReportHead(reportKey).catch(() => null);

  let resolvedSlug = '';
  for (const suffixLength of SLUG_SUFFIX_LENGTHS) {
    const slug = generateSlug(slugBase, session.sessionId, suffixLength);
    try {
      await publishSession(session.sessionId, slug, assetKey, reportKey);
      resolvedSlug = slug;
      break;
    } catch (error) {
      if (!isSlugConflict(error) || suffixLength === SLUG_SUFFIX_LENGTHS[SLUG_SUFFIX_LENGTHS.length - 1]) {
        const message = error instanceof Error ? error.message : 'publish failed';
        return {
          ok: false,
          status: 500,
          error: message,
          code: 'PUBLISH_FAILED',
        };
      }
    }
  }

  if (!resolvedSlug) {
    return {
      ok: false,
      status: 500,
      error: 'Could not generate a unique slug',
      code: 'PUBLISH_FAILED',
    };
  }

  const sync = await syncPublishedSessionTargets({
    session: {
      ...session,
      reportKey,
      assetKey,
      slug: resolvedSlug,
      published: true,
    },
    slug: resolvedSlug,
    assetKey,
    locale,
  });

  await materializePublishedAssetMetrics(assetKey).catch(() => {});

  return {
    ok: true,
    alreadyPublished: false,
    slug: resolvedSlug,
    assetKey,
    reportKey: sync.reportKey,
    canonicalLabel: sync.canonicalLabel,
    subjectKey: sync.subjectKey,
    previousHead,
  };
}
