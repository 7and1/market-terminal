import type { SessionRow } from '@/lib/db';
import { evidenceItems, getArtifacts } from '@/lib/session-data';
import type { EvidenceItem } from '@/lib/types';

export type SourceTier = 'official' | 'primary' | 'secondary';

export type ReportQuality = {
  evidenceCount: number;
  uniqueDomainCount: number;
  latestEvidenceAt: number | null;
  officialCount: number;
  primaryCount: number;
  secondaryCount: number;
  primaryLikeCount: number;
  topDomains: string[];
  publishable: boolean;
  issues: string[];
};

const PRIMARY_SOURCE_DOMAINS = [
  /(^|\.)reuters\.com$/i,
  /(^|\.)bloomberg\.com$/i,
  /(^|\.)cnbc\.com$/i,
  /(^|\.)wsj\.com$/i,
  /(^|\.)ft\.com$/i,
  /(^|\.)apnews\.com$/i,
  /(^|\.)marketwatch\.com$/i,
  /(^|\.)finance\.yahoo\.com$/i,
  /(^|\.)investing\.com$/i,
  /(^|\.)theinformation\.com$/i,
  /(^|\.)barrons\.com$/i,
  /(^|\.)semafor\.com$/i,
] as const;

const OFFICIAL_SOURCE_DOMAINS = [
  /(^|\.)sec\.gov$/i,
  /(^|\.)federalreserve\.gov$/i,
  /(^|\.)treasury\.gov$/i,
  /(^|\.)bls\.gov$/i,
  /(^|\.)bea\.gov$/i,
  /(^|\.)census\.gov$/i,
  /(^|\.)ecb\.europa\.eu$/i,
  /(^|\.)europa\.eu$/i,
  /(^|\.)imf\.org$/i,
  /(^|\.)worldbank\.org$/i,
  /(^|\.)oecd\.org$/i,
] as const;

const OFFICIAL_PATH_HINTS = /(investor|earnings|financial-results|financial-reports|quarterly-results|annual-report|press-release|newsroom|sec-filings?|shareholder)/i;
const OFFICIAL_TEXT_HINTS = /(investor relations|earnings call|quarterly results|annual report|shareholder letter|official filing|official release)/i;

function evidenceTimestamp(item: EvidenceItem) {
  const publishedAt = typeof item.publishedAt === 'number' ? item.publishedAt : 0;
  const observedAt = typeof item.observedAt === 'number' ? item.observedAt : 0;
  return Math.max(publishedAt, observedAt, 0) || null;
}

export function domainOfUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function classifySourceTier({ url, source }: { url: string; source?: string | null }): SourceTier {
  let pathname = '';
  try {
    pathname = new URL(url).pathname || '';
  } catch {
    pathname = '';
  }

  const domain = domainOfUrl(url);
  const sourceText = String(source || '').trim();
  const combined = `${domain} ${pathname} ${sourceText}`.toLowerCase();

  if (
    OFFICIAL_SOURCE_DOMAINS.some((pattern) => pattern.test(domain)) ||
    domain.startsWith('investor.') ||
    /\.gov$/i.test(domain) ||
    OFFICIAL_PATH_HINTS.test(combined) ||
    OFFICIAL_TEXT_HINTS.test(sourceText)
  ) {
    return 'official';
  }

  if (PRIMARY_SOURCE_DOMAINS.some((pattern) => pattern.test(domain))) {
    return 'primary';
  }

  return 'secondary';
}

export function summarizeReportQuality(evidence: EvidenceItem[]): ReportQuality {
  const domains = new Map<string, number>();
  let officialCount = 0;
  let primaryCount = 0;
  let secondaryCount = 0;
  let latestEvidenceAt: number | null = null;

  for (const item of evidence) {
    const domain = domainOfUrl(item.url);
    domains.set(domain, (domains.get(domain) || 0) + 1);

    const ts = evidenceTimestamp(item);
    if (typeof ts === 'number' && (!latestEvidenceAt || ts > latestEvidenceAt)) {
      latestEvidenceAt = ts;
    }

    const tier = classifySourceTier(item);
    if (tier === 'official') officialCount += 1;
    else if (tier === 'primary') primaryCount += 1;
    else secondaryCount += 1;
  }

  const evidenceCount = evidence.length;
  const uniqueDomainCount = domains.size;
  const primaryLikeCount = officialCount + primaryCount;
  const issues: string[] = [];

  if (evidenceCount < 5) {
    issues.push(`Need at least 5 evidence items; found ${evidenceCount}.`);
  }
  if (uniqueDomainCount < 3) {
    issues.push(`Need at least 3 unique domains; found ${uniqueDomainCount}.`);
  }
  if (primaryLikeCount < 1) {
    issues.push('Need at least 1 official or primary market source.');
  }

  return {
    evidenceCount,
    uniqueDomainCount,
    latestEvidenceAt,
    officialCount,
    primaryCount,
    secondaryCount,
    primaryLikeCount,
    topDomains: Array.from(domains.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([domain]) => domain)
      .slice(0, 6),
    publishable: issues.length === 0,
    issues,
  };
}

export function summarizeSessionQuality(session: Pick<SessionRow, 'meta'>): ReportQuality {
  const evidence = evidenceItems(getArtifacts(session.meta).evidence);
  return summarizeReportQuality(evidence);
}

export function filterPublishableSessions<T extends Pick<SessionRow, 'meta'>>(sessions: T[]): T[] {
  return sessions.filter((session) => summarizeSessionQuality(session).publishable);
}

export function pickKeyEvidence(evidence: EvidenceItem[], limit = 3): EvidenceItem[] {
  return [...evidence]
    .sort((a, b) => {
      const tierScore = (item: EvidenceItem) => {
        const tier = classifySourceTier(item);
        if (tier === 'official') return 3;
        if (tier === 'primary') return 2;
        return 1;
      };
      const confidenceA = typeof a.aiSummary?.confidence === 'number' ? a.aiSummary.confidence : 0;
      const confidenceB = typeof b.aiSummary?.confidence === 'number' ? b.aiSummary.confidence : 0;
      const tsA = evidenceTimestamp(a) || 0;
      const tsB = evidenceTimestamp(b) || 0;

      return (
        tierScore(b) - tierScore(a) ||
        confidenceB - confidenceA ||
        tsB - tsA
      );
    })
    .slice(0, limit);
}

export function collectTopLabels(
  evidence: EvidenceItem[],
  key: 'catalysts' | 'entities',
  limit = 6,
): string[] {
  const counts = new Map<string, number>();

  for (const item of evidence) {
    for (const raw of item.aiSummary?.[key] || []) {
      const label = String(raw || '').trim();
      if (!label) continue;
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label)
    .slice(0, limit);
}
