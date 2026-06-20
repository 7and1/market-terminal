import type { SerpResult } from '@/lib/brightdata';
import { parsePublishedAtFromSnippet } from '@/lib/pipeline-time';
import type { EvidenceItem } from '@/lib/run-pipeline/contracts';
import { getTopicSearchHints } from '@/lib/topic-catalog';

export function sleep(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(new Error('aborted'));
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      },
      { once: true },
    );
  });
}

export function domainFromUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

export function filterStaleEvidence(evidence: EvidenceItem[], observedAt: number, maxAgeDays: number) {
  const maxAgeMs = Math.max(1, Math.round(maxAgeDays)) * 86_400_000;
  const keep = evidence.filter((item) => item.timeKind !== 'published' || observedAt - item.publishedAt <= maxAgeMs);
  return { keep, dropped: Math.max(0, evidence.length - keep.length) };
}

export function parseStatusFromBrightDataErrorMessage(message: string) {
  const match = message.match(/\((\d{3})\)/);
  if (!match) return null;
  const status = Number(match[1]);
  return Number.isFinite(status) ? status : null;
}

function uniqueByUrl(results: SerpResult[], limit: number) {
  const seen = new Set<string>();
  const out: SerpResult[] = [];
  for (const result of results) {
    if (!result.url || seen.has(result.url)) continue;
    seen.add(result.url);
    out.push(result);
    if (out.length >= limit) break;
  }
  return out;
}

function termMatches(text: string, term: string): boolean {
  const normalized = String(term || '').toLowerCase().trim();
  if (!normalized) return false;
  if (/^[a-z0-9]+$/.test(normalized)) {
    return new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
  }
  return text.includes(normalized);
}

function scoreSerpResult(result: SerpResult, topic?: string): number {
  const domain = domainFromUrl(result.url);
  const hay = `${result.title || ''} ${result.snippet || ''}`.toLowerCase();
  const hints = topic ? getTopicSearchHints(topic) : null;

  let score = 0;
  if (/\b(today|latest|update|breaking|hours?|day|week)\b/.test(hay)) score += 2;
  if (/\b(news|headline|rumou?r|report|filing|approval|lawsuit)\b/.test(hay)) score += 2;
  if (/\b(earnings|guidance|policy|regulation|macro|supply|demand|inventory|geopolitics|sentiment|analyst|forecast)\b/.test(hay)) score += 1.2;
  if (/\b(price|chart|quote|market cap|live)\b/.test(hay)) score += 0.35;
  if (/(reuters|bloomberg|cnbc|ft\.com|wsj\.com|investopedia)\b/.test(domain)) score += 1.5;
  if (hints?.preferredDomains?.some((preferred) => domain.includes(preferred.toLowerCase()))) score += 1.5;
  if (hints?.domainKeywords?.some((term) => termMatches(hay, term))) score += 2;
  if (hints?.impactKeywords?.some((term) => termMatches(hay, term))) score += 1.2;
  if (hints?.knownActors?.some((actor) => termMatches(hay, actor))) score += 1;
  if (/(tradingview|marketwatch|investing\.com)\b/.test(domain)) score -= 0.4;
  if (/(perplexity\.ai|arxiv\.org|wikipedia\.org|github\.com|quora\.com|medium\.com)\b/.test(domain)) score -= 2.2;
  if (/(reddit\.com)\b/.test(domain)) score -= 1.2;

  return score;
}

export function pickSerpDiverse(results: SerpResult[], limit: number, topic?: string) {
  const uniq = uniqueByUrl(results, 80);
  const ranked = uniq
    .map((result) => ({ result, score: scoreSerpResult(result, topic) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.result);

  const perDomainCap = 2;
  const domainCounts = new Map<string, number>();
  const out: SerpResult[] = [];

  for (const result of ranked) {
    const domain = domainFromUrl(result.url);
    const count = domainCounts.get(domain) ?? 0;
    if (count >= perDomainCap) continue;
    out.push(result);
    domainCounts.set(domain, count + 1);
    if (out.length >= limit) return out;
  }

  for (const result of uniq) {
    if (out.some((item) => item.url === result.url)) continue;
    out.push(result);
    if (out.length >= limit) break;
  }
  return out;
}

export function asEvidenceFromSerp(results: SerpResult[], startedAt: number): EvidenceItem[] {
  return results.map((result, idx) => {
    const observedAt = startedAt;
    const publishedAt = parsePublishedAtFromSnippet(result.snippet, observedAt);
    return {
      id: `ev_${idx + 1}`,
      title: result.title || result.url,
      url: result.url,
      source: domainFromUrl(result.url),
      observedAt,
      publishedAt: publishedAt ?? observedAt,
      timeKind: publishedAt ? 'published' : 'observed',
      excerpt: result.snippet,
      excerptSource: 'serp',
    };
  });
}

export function slugId(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);
}

export function truncateText(raw: string, max: number) {
  const text = (raw || '').trim();
  if (text.length <= max) return text;
  if (max <= 3) return text.slice(0, max);
  return `${text.slice(0, max - 3).trimEnd()}...`;
}

export function safeErrorText(err: unknown, max = 220) {
  const raw = err instanceof Error ? err.message : String(err || 'error');
  return truncateText(raw, max);
}

export function extractOutputPreviewFromReason(reason: string): string | null {
  const text = String(reason || '');
  const match = text.match(/First 220 chars:\s*([\s\S]+)$/i);
  if (!match?.[1]) return null;
  return truncateText(match[1].replace(/\s+/g, ' ').trim(), 220) || null;
}
