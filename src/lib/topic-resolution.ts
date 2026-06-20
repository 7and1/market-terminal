import { z } from 'zod';

import { chatJson, getAIConfig } from '@/lib/ai';
import {
  getReportHead,
  listApprovedDynamicCatalogHeads,
  listPublished,
  listCurrentPublished,
  listQueryAliases,
  updateSessionReportKey,
  upsertQueryAlias,
  upsertReportHead,
  type DynamicCatalogHeadRow,
  type QueryAliasRow,
  type QueryAliasSource,
  type QueryAliasTargetType,
  type SessionRow,
} from '@/lib/db';
import { env, hasDb } from '@/lib/env';
import { assessMarketQueryScope } from '@/lib/market-query-scope';
import { normalizeQueryLocale } from '@/lib/query-copy';
import {
  COMPARISON_DEFINITIONS,
  SUBJECT_BY_KEY,
  SUBJECT_DEFINITIONS,
  getCanonicalHeadByAssetKey,
  getCanonicalHeadByKey,
  getComparisonAliases,
  getComparisonByKey,
  getComparisonBySubjectSet,
  getSubjectAliases,
} from '@/lib/topic-catalog';
import { buildCacheKey, clearServerCaches, getOrComputeCached } from '@/lib/server-cache';
const QUESTION_WORDS = new Set([
  'why',
  'what',
  'how',
  'which',
  'who',
  'when',
  'where',
  'por',
  'que',
  'como',
  'cual',
  'cuales',
  'quien',
  'donde',
]);
const TIME_WORDS = new Set([
  'today',
  'tonight',
  'tomorrow',
  'yesterday',
  'week',
  'month',
  'year',
  'open',
  'close',
  'currently',
  'now',
  'right',
  'hour',
  'hours',
  'latest',
  'recent',
  'hoy',
  'ahora',
  'semana',
  'mes',
  'ano',
  'anos',
]);
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'for',
  'to',
  'of',
  'in',
  'on',
  'with',
  'this',
  'that',
  'these',
  'those',
  'after',
  'before',
  'from',
  'into',
  'over',
  'under',
  'around',
  'through',
  'last',
  'same',
  'market',
  'markets',
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'de',
  'del',
  'en',
  'por',
  'para',
  'con',
  'sin',
  'como',
  'y',
  'o',
  'desde',
  'hasta',
  'ahora',
  'mismo',
  'misma',
]);

const TIE_BREAK_SCHEMA = z.object({
  candidateId: z.string().min(1),
});

const COMPARISON_EQUIVALENT_SUBJECT_KEYS: Partial<Record<string, readonly string[]>> = {
  yields: ['rates'],
};

const MACRO_CONTEXT_SUBJECT_KEYS = new Set(['rates', 'yields', 'fed', 'cpi', 'tariffs', 'dxy']);
const POLICY_LENS_PRICE_MOVE_SUBJECT_KEYS = new Set(['fed']);

function escapeRegex(raw: string) {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function anchoredSubjectIndex(normalizedInput: string, subjectKey: string, locale?: string): number | null {
  const subject = SUBJECT_BY_KEY.get(subjectKey);
  if (!subject) return null;
  const intentRe =
    /\b(moving|moved|move|down|up|drawdown|selloff|rally|why|explain|cae|sube|mueve|movimiento|impact|drivers|read\s+through|readthrough)\b|波动|下跌|上涨|影响|原因|为什么/;
  if (!intentRe.test(normalizedInput)) return null;

  let bestIndex: number | null = null;
  for (const rawAlias of getSubjectAliases(subject, locale)) {
    const alias = normalizeText(rawAlias);
    if (!alias) continue;
    const aliasRe = escapeRegex(alias);
    const patterns = [
      new RegExp(`^(why|what|how)\\s+(is\\s+|are\\s+)?(the\\s+latest\\s+)?${aliasRe}\\b`),
      new RegExp(`^(por\\s+que|como)\\s+(es\\s+|esta\\s+)?(lo\\s+ultimo\\s+)?${aliasRe}\\b`),
      new RegExp(`^${aliasRe}\\b`),
      new RegExp(`\\b${aliasRe}\\s+(moving|moved|move|impact|drivers|read\\s+through|readthrough)\\b`),
    ];
    for (const pattern of patterns) {
      const match = normalizedInput.match(pattern);
      if (!match || match.index == null) continue;
      bestIndex = bestIndex == null ? match.index : Math.min(bestIndex, match.index);
    }
  }

  return bestIndex;
}

function isAnchoredSubjectQuery(normalizedInput: string, subjectKey: string, locale?: string) {
  return anchoredSubjectIndex(normalizedInput, subjectKey, locale) != null;
}

function findAnchoredPrimaryMatch(normalizedInput: string, locale?: string) {
  let best:
    | {
        index: number;
        match: {
          key: string;
          label: string;
          assetKey: string;
          alias: string;
        };
      }
    | null = null;

  for (const subject of SUBJECT_DEFINITIONS) {
    const index = anchoredSubjectIndex(normalizedInput, subject.key, locale);
    if (index == null) continue;
    const match = {
      key: subject.key,
      label: subject.label,
      assetKey: subject.assetKey,
      alias: getSubjectAliases(subject, locale)[0] || subject.key,
    };
    if (!best || index < best.index) {
      best = { index, match };
    }
  }
  return best?.match || null;
}

function findLeadingSubjectMatch(normalizedInput: string, locale?: string) {
  const prefixes = [
    '',
    'why is ',
    'what is ',
    'what is the latest ',
    'how is ',
    'how are ',
    'why ',
    'por que ',
    'como ',
  ];

  for (const subject of SUBJECT_DEFINITIONS) {
    for (const rawAlias of getSubjectAliases(subject, locale)) {
      const alias = normalizeText(rawAlias);
      if (!alias) continue;
      for (const prefix of prefixes) {
        const target = `${prefix}${alias}`;
        if (normalizedInput === target || normalizedInput.startsWith(`${target} `)) {
          return {
            key: subject.key,
            label: subject.label,
            assetKey: subject.assetKey,
            alias: getSubjectAliases(subject, locale)[0] || subject.key,
          };
        }
      }
    }
  }

  return null;
}

export type ResolverSurface = 'landing' | 'terminal';

export type QueryResolveReject = {
  decision: 'reject';
  code: 'OFF_DOMAIN_QUERY';
  message: string;
  supportedExamples: readonly string[];
};

export type QueryResolveReuse = {
  decision: 'reuse';
  reuseType: 'report' | 'asset';
  typedQuery: string;
  canonicalLabel: string;
  lastUpdatedAt: string | null;
  publicSurface: 'asset_hub' | 'report';
  priorityTier: 'v1' | 'secondary';
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

export type QueryResolveAmbiguous = {
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

export type QueryResolveRun = {
  decision: 'run';
  typedQuery: string;
  canonicalLabel: string | null;
  reportKey: string | null;
  visibility: 'public';
  publicSurface: 'asset_hub' | 'report';
  priorityTier: 'v1' | 'secondary';
  assetKey?: string | null;
};

export type QueryResolveRunPrivate = {
  decision: 'run_private';
  typedQuery: string;
  canonicalLabel: string;
  visibility: 'private';
  publicSurface?: 'asset_hub' | 'report';
  priorityTier?: 'v1' | 'secondary';
  assetKey?: string | null;
  message: string;
};

export type QueryResolveResult =
  | QueryResolveReject
  | QueryResolveReuse
  | QueryResolveAmbiguous
  | QueryResolveRun
  | QueryResolveRunPrivate;

type ParsedTopic = {
  normalizedInput: string;
  aliasKey: string;
  subjectKey: string;
  subjectLabel: string;
  assetKey: string | null;
  lens: string;
  anchor: string | null;
  compareTarget: string | null;
  compareLabel: string | null;
  matchCount: number;
  isBroad: boolean;
  explicitMultiSubjectComparison: boolean;
  reportKey: string | null;
  canonicalLabel: string;
};

type ReportCandidate = {
  id: string;
  label: string;
  reportKey: string;
  slug: string;
  sessionId: string;
  assetKey: string | null;
  subjectKey: string;
  updatedAt: number;
};

type AssetCandidate = {
  id: string;
  label: string;
  assetKey: string;
  reportKey?: string | null;
  publicSurface?: 'asset_hub' | 'report';
  priorityTier?: 'v1' | 'secondary';
  dynamic?: boolean;
  latestReport?: ReportCandidate;
  updatedAt: number;
};

type ResolutionCatalog = {
  reportCandidates: ReportCandidate[];
  assetCandidates: AssetCandidate[];
  aliases: QueryAliasRow[];
};

function getPrivateRunMessage(
  locale: string | undefined,
  variant: 'feature_private_only' | 'comparison_private_only' | 'fallback_private_only',
) {
  const normalizedLocale = normalizeQueryLocale(locale);

  if (normalizedLocale === 'zh') {
    switch (variant) {
      case 'feature_private_only':
        return '这个查询对 TrendAnalysis.ai 是有效的，但它不会映射到规范的公开资产头部。运行后只会保存一个私有会话。';
      case 'comparison_private_only':
        return '这是一个有效的复合市场查询，但在 v1 中只会保留为私有。运行后会保存一个长期私有会话，不会生成公开报告页。';
      case 'fallback_private_only':
      default:
        return '这个查询是有效的，但它不在规范的公开资产目录中。运行后会保存一个长期私有会话，不会生成公开报告页。';
    }
  }

  if (normalizedLocale === 'es') {
    switch (variant) {
      case 'feature_private_only':
        return 'Esta consulta es válida para TrendAnalysis.ai, pero no se asigna a una cabecera pública canónica de activo. Al ejecutarla solo se guardará una sesión privada.';
      case 'comparison_private_only':
        return 'Esta es una consulta compuesta válida de mercado, pero permanece privada en v1. Ejecutarla guardará una sesión privada de larga duración sin crear una página pública de informe.';
      case 'fallback_private_only':
      default:
        return 'Esta consulta es válida, pero queda fuera del catálogo público canónico de activos. Ejecutarla guardará una sesión privada de larga duración sin crear una página pública de informe.';
    }
  }

  switch (variant) {
    case 'feature_private_only':
      return 'This query is valid for TrendAnalysis.ai, but it does not map to a canonical public asset head. Running it will save a private session only.';
    case 'comparison_private_only':
      return 'This is a valid composite market query, but it stays private in v1. Running it will save a long-lived private session without creating a public report page.';
    case 'fallback_private_only':
    default:
      return 'This query is valid, but it is outside the canonical public asset catalog. Running it will save a long-lived private session without creating a public report page.';
  }
}

function stripDiacritics(raw: string): string {
  return raw.normalize('NFKD').replace(/\p{M}+/gu, '');
}

function normalizeText(raw: string): string {
  return stripDiacritics(raw)
    .toLowerCase()
    .replace(/＆/g, '&')
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[“”"]/g, ' ')
    .replace(/[¿?¡!]/g, ' ')
    .replace(/[：:]/g, ' ')
    .replace(/[，、]/g, ' ')
    .replace(/[（）()]/g, ' ')
    .replace(/[／/]/g, ' ')
    .replace(/[－—–-]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(raw: string): string[] {
  const normalized = normalizeText(raw);
  if (!normalized) return [];
  return normalized.split(' ').filter(Boolean);
}

function titleCase(raw: string): string {
  return raw
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function slugify(raw: string): string {
  return normalizeText(raw).replace(/\s+/g, '-');
}

function overlapScore(a: string, b: string): number {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (!left.size || !right.size) return 0;
  let hit = 0;
  for (const token of right) {
    if (left.has(token)) hit += 1;
  }
  return hit / Math.max(left.size, right.size);
}

function findSubjectMatches(normalizedInput: string, locale?: string) {
  const inputTokens = tokenize(normalizedInput);
  const matches: Array<{ key: string; label: string; assetKey: string | null; alias: string }> = [];
  for (const subject of SUBJECT_DEFINITIONS) {
    for (const rawAlias of getSubjectAliases(subject, locale)) {
      const alias = normalizeText(rawAlias);
      if (!alias) continue;
      const aliasTokens = tokenize(alias);
      const isAsciiAlias = /^[a-z0-9 ]+$/i.test(alias);
      const aliasMatched = isAsciiAlias
        ? inputMatchesAliasTokens(inputTokens, aliasTokens)
        : normalizedInput === alias || normalizedInput.includes(alias);
      if (aliasMatched) {
        matches.push({
          key: subject.key,
          label: subject.label,
          assetKey: subject.assetKey,
          alias,
        });
        break;
      }
    }
  }
  return matches;
}

function inputMatchesAliasTokens(inputTokens: string[], aliasTokens: string[]) {
  if (!inputTokens.length || !aliasTokens.length) return false;
  if (aliasTokens.length === 1) return inputTokens.includes(aliasTokens[0]);

  const aliasLength = aliasTokens.length;
  for (let idx = 0; idx <= inputTokens.length - aliasLength; idx += 1) {
    let matched = true;
    for (let offset = 0; offset < aliasLength; offset += 1) {
      if (inputTokens[idx + offset] !== aliasTokens[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }

  return false;
}

function findCuratedComparison(subjectKeys: string[]) {
  const uniqueKeys = Array.from(new Set(subjectKeys.filter(Boolean)));
  if (uniqueKeys.length !== 2) return null;
  return getComparisonBySubjectSet(uniqueKeys);
}

function comparisonSubjectVariants(subjectKey: string) {
  return [subjectKey, ...(COMPARISON_EQUIVALENT_SUBJECT_KEYS[subjectKey] || [])];
}

function subjectMatchesComparisonSlot(queryKeys: string[], slotKey: string) {
  return queryKeys.some((queryKey) => {
    if (queryKey === slotKey) return true;
    if (comparisonSubjectVariants(queryKey).includes(slotKey)) return true;
    if (comparisonSubjectVariants(slotKey).includes(queryKey)) return true;
    return false;
  });
}

function comparisonIncludesSubject(comparison: (typeof COMPARISON_DEFINITIONS)[number], subjectKey: string) {
  return (
    subjectMatchesComparisonSlot([subjectKey], comparison.primarySubjectKey) ||
    subjectMatchesComparisonSlot([subjectKey], comparison.secondarySubjectKey)
  );
}

function findCuratedComparisonByEquivalence(subjectKeys: string[]) {
  const uniqueKeys = Array.from(new Set(subjectKeys.filter(Boolean)));
  if (uniqueKeys.length < 2) return null;

  for (let leftIndex = 0; leftIndex < uniqueKeys.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < uniqueKeys.length; rightIndex += 1) {
      for (const left of comparisonSubjectVariants(uniqueKeys[leftIndex])) {
        for (const right of comparisonSubjectVariants(uniqueKeys[rightIndex])) {
          const comparison = getComparisonBySubjectSet([left, right]);
          if (comparison) return comparison;
        }
      }
    }
  }

  return null;
}

function hasComparisonIntent(normalizedInput: string) {
  return (
    /\b(vs|versus|compare|compared|relative|divergence|affect|affecting|impact|impacting|read through|readthrough|spillover|transmission)\b/.test(
      normalizedInput,
    ) || /对比|相比|影响|传导/.test(normalizedInput)
  );
}

function findImplicitCuratedComparison(normalizedInput: string, subjectKeys: string[]) {
  if (!hasComparisonIntent(normalizedInput)) return null;
  const uniqueKeys = Array.from(new Set(subjectKeys.filter(Boolean)));
  if (uniqueKeys.length < 2) return null;

  return (
    COMPARISON_DEFINITIONS.find(
      (comparison) =>
        subjectMatchesComparisonSlot(uniqueKeys, comparison.primarySubjectKey) &&
        subjectMatchesComparisonSlot(uniqueKeys, comparison.secondarySubjectKey),
    ) || null
  );
}

function deriveFallbackSubject(tokens: string[]) {
  const meaningful = tokens.filter((token) => !STOP_WORDS.has(token) && !TIME_WORDS.has(token) && !QUESTION_WORDS.has(token));
  const subjectKey = slugify(meaningful.slice(0, 3).join(' ') || tokens.slice(0, 2).join(' ') || 'market');
  return {
    key: subjectKey || 'market',
    label: titleCase(meaningful.slice(0, 3).join(' ') || tokens.slice(0, 2).join(' ') || 'Market'),
    assetKey: subjectKey || 'market',
  };
}

function deriveLens(normalizedInput: string) {
  if (/\b(vs|versus|compare|compared|relative|divergence|frente)\b/.test(normalizedInput) || /对比|相比/.test(normalizedInput)) {
    return 'comparison';
  }
  if (/\b(earnings|guidance|results|quarter|eps|resultados|beneficios|trimestre)\b/.test(normalizedInput) || /财报|业绩/.test(normalizedInput)) {
    return 'earnings-impact';
  }
  if (/\b(tariff|tariffs|policy|regulation|export control|arancel|aranceles|politica|regulacion)\b/.test(normalizedInput) || /关税|政策|监管|出口管制/.test(normalizedInput)) {
    return 'policy-impact';
  }
  if (/\b(fed|fomc|ecb|boj|rates|yields|treasury|cpi|ppi|payrolls|tasas|tipos|rendimientos|tesoro|inflacion|nominas)\b/.test(normalizedInput) || /美联储|收益率|利率|国债|通胀|非农/.test(normalizedInput)) {
    return 'macro-readthrough';
  }
  if (/\b(spillover|read through|readthrough|impact|affect|drivers|matter|moving|moved|move|down|up|drawdown|selloff|rally|why|explain|cae|sube|mueve|movimiento|afecta|afectan|impacto|explica)\b/.test(normalizedInput) || /波动|下跌|上涨|影响|原因|为什么/.test(normalizedInput)) {
    return 'price-move';
  }
  return 'general';
}

function deriveAnchor(normalizedInput: string): string | null {
  if (/\bearnings\b|\bresultados\b/.test(normalizedInput) || /财报/.test(normalizedInput)) return 'earnings';
  if (/\b(fed|fomc)\b/.test(normalizedInput) || /美联储/.test(normalizedInput)) return 'fed';
  if (/\bcpi\b|\binflation\b|\binflacion\b/.test(normalizedInput) || /通胀|cpi/.test(normalizedInput)) return 'cpi';
  if (/\brates?\b|\byields?\b|\btreasury\b|\btasas\b|\brendimientos\b/.test(normalizedInput) || /利率|收益率|国债/.test(normalizedInput)) return 'rates';
  if (/\btariff\b|\btariffs\b|\barancel\b|\baranceles\b|\bexport control\b/.test(normalizedInput) || /关税|出口管制/.test(normalizedInput)) return 'tariffs';
  if (/\bdollar\b|\bdxy\b|\busd\b/.test(normalizedInput) || /美元指数|美元/.test(normalizedInput)) return 'dollar';
  return null;
}

function buildParsedTopic(raw: string, locale?: string): ParsedTopic {
  const normalizedInput = normalizeText(raw);
  const tokens = tokenize(raw);
  const matches = findSubjectMatches(normalizedInput, locale);
  const anchoredMatch = findLeadingSubjectMatch(normalizedInput, locale) || findAnchoredPrimaryMatch(normalizedInput, locale);
  const normalizedMatches = anchoredMatch
    ? [anchoredMatch, ...matches.filter((item) => item.key !== anchoredMatch.key)]
    : matches;
  const derivedLens = deriveLens(normalizedInput);
  const anchoredPrimaryQuery = Boolean(anchoredMatch);
  const hasPriceMoveIntent =
    /\b(spillovers?|read\s+through|readthrough|transmission|impact|affect|drivers|matter|moving|moved|move|down|up|drawdown|selloff|rally|why|explain|cae|sube|mueve|movimiento|afecta|afectan|impacto|explica)\b/.test(
      normalizedInput,
    ) || /波动|下跌|上涨|影响|原因|为什么/.test(normalizedInput);
  const implicitComparisonDefinition = findImplicitCuratedComparison(
    normalizedInput,
    normalizedMatches.map((item) => item.key),
  );
  const anchoredImplicitComparisonDefinition =
    implicitComparisonDefinition && (!anchoredMatch || comparisonIncludesSubject(implicitComparisonDefinition, anchoredMatch.key))
      ? implicitComparisonDefinition
      : null;
  const comparisonIntent =
    derivedLens === 'comparison' ||
    Boolean(anchoredImplicitComparisonDefinition) ||
    (hasComparisonIntent(normalizedInput) && !anchoredPrimaryQuery);
  const effectiveMatches =
    !comparisonIntent && normalizedMatches.length > 1
      ? anchoredPrimaryQuery
        ? [normalizedMatches[0]]
        : hasPriceMoveIntent
          ? [normalizedMatches[0], ...normalizedMatches.slice(1).filter((item) => !MACRO_CONTEXT_SUBJECT_KEYS.has(item.key))]
          : normalizedMatches
      : normalizedMatches;
  const singleMatchedSubjectKey = effectiveMatches.length === 1 ? effectiveMatches[0].key : null;
  const normalizedLens =
    effectiveMatches.length === 1 &&
    hasPriceMoveIntent &&
    (derivedLens === 'macro-readthrough' ||
      (derivedLens === 'policy-impact' &&
        singleMatchedSubjectKey !== null &&
        POLICY_LENS_PRICE_MOVE_SUBJECT_KEYS.has(singleMatchedSubjectKey)))
      ? 'price-move'
      : derivedLens;
  const explicitMultiSubjectComparison = derivedLens === 'comparison' && effectiveMatches.length > 2;
  const comparisonDefinition = comparisonIntent
    ? explicitMultiSubjectComparison
      ? null
      : anchoredImplicitComparisonDefinition ||
        findCuratedComparison(effectiveMatches.map((item) => item.key)) ||
        findCuratedComparisonByEquivalence(effectiveMatches.map((item) => item.key))
    : null;
  let primary = effectiveMatches[0] ?? deriveFallbackSubject(tokens);
  let secondary = effectiveMatches.find((item) => item.key !== primary.key) ?? null;
  if (comparisonDefinition) {
    const primarySubject = SUBJECT_BY_KEY.get(comparisonDefinition.primarySubjectKey);
    const secondarySubject = SUBJECT_BY_KEY.get(comparisonDefinition.secondarySubjectKey);
    if (primarySubject) {
      primary = {
        key: primarySubject.key,
        label: primarySubject.label,
        assetKey: comparisonDefinition.primaryAssetKey,
        alias: getSubjectAliases(primarySubject, locale)[0] || primarySubject.key,
      };
    }
    if (secondarySubject) {
      secondary = {
        key: secondarySubject.key,
        label: secondarySubject.label,
        assetKey: secondarySubject.assetKey,
        alias: getSubjectAliases(secondarySubject, locale)[0] || secondarySubject.key,
      };
    }
  }
  const lens = comparisonDefinition ? 'comparison' : normalizedLens;
  const anchor = lens === 'price-move' ? null : deriveAnchor(normalizedInput);
  const comparisonTail = explicitMultiSubjectComparison ? effectiveMatches.slice(1) : [];
  const compareTarget =
    lens === 'comparison' && secondary
      ? explicitMultiSubjectComparison
        ? comparisonTail.map((item) => item.key).join('-vs-')
        : secondary.key
      : null;
  const compareLabel =
    lens === 'comparison' && secondary
      ? explicitMultiSubjectComparison
        ? comparisonTail.map((item) => item.label).join(' vs ')
        : secondary.label
      : null;
  const plainSubjectQuery =
    effectiveMatches.length === 1 &&
    tokens.length <= 4 &&
    !compareTarget &&
    lens === 'general' &&
    !anchor &&
    !tokens.some((token) => QUESTION_WORDS.has(token));
  const isBroad =
    plainSubjectQuery ||
    (effectiveMatches.length === 1 &&
      tokens.every((token) => TIME_WORDS.has(token) || STOP_WORDS.has(token) || subjectTokenSet(primary.key, locale).has(token)));
  const reportKey =
    isBroad
      ? null
      : comparisonDefinition && lens === 'comparison'
        ? `${comparisonDefinition.key}-comparison`
        : [primary.key, compareTarget ? `vs-${compareTarget}` : null, lens !== 'general' ? lens : null, anchor && lens !== `${anchor}-impact` ? anchor : null]
          .filter(Boolean)
          .join('-')
          .replace(/-+/g, '-');
  let canonicalLabel = comparisonDefinition?.label || primary.label;
  if (!comparisonDefinition && compareTarget && compareLabel) {
    canonicalLabel = `${primary.label} vs ${compareLabel}`;
  } else if (lens === 'earnings-impact') {
    canonicalLabel = `${primary.label} after earnings`;
  } else if (lens === 'policy-impact' && anchor) {
    canonicalLabel = `${primary.label} ${anchor} impact`;
  } else if (lens === 'macro-readthrough' && anchor) {
    canonicalLabel =
      anchor === primary.key || (primary.key === 'yields' && anchor === 'rates')
        ? `${primary.label} read-through`
        : `${primary.label} ${anchor} read-through`;
  } else if (!isBroad && lens === 'price-move') {
    canonicalLabel = `${primary.label} price move`;
  }

  return {
    normalizedInput,
    aliasKey: normalizeAliasKey(raw),
    subjectKey: comparisonDefinition?.key || primary.key,
    subjectLabel: comparisonDefinition?.label || primary.label,
    assetKey: comparisonDefinition?.primaryAssetKey || primary.assetKey,
    lens,
    anchor,
    compareTarget,
    compareLabel,
    matchCount: effectiveMatches.length,
    isBroad,
    explicitMultiSubjectComparison,
    reportKey,
    canonicalLabel,
  };
}

function subjectTokenSet(subjectKey: string, locale?: string) {
  const subject = SUBJECT_BY_KEY.get(subjectKey);
  const tokens = new Set<string>();
  if (!subject) return tokens;
  for (const alias of getSubjectAliases(subject, locale)) {
    for (const token of tokenize(alias)) tokens.add(token);
  }
  return tokens;
}

function scoreReportCandidate(parsed: ParsedTopic, candidate: ReportCandidate, aliases: QueryAliasRow[]): number {
  let score = overlapScore(parsed.normalizedInput, candidate.label);
  if (candidate.reportKey === parsed.reportKey && parsed.reportKey) score = Math.max(score, 0.96);
  if (candidate.subjectKey === parsed.subjectKey) score += parsed.isBroad ? 0.08 : 0.18;
  if (candidate.assetKey && parsed.assetKey && candidate.assetKey === parsed.assetKey) score += 0.08;
  if (parsed.reportKey && candidate.assetKey === parsed.assetKey && /(^|-)general$/.test(candidate.reportKey)) {
    score -= 0.28;
  }
  if (parsed.isBroad) score -= 0.18;
  if (parsed.isBroad && /(^|-)general$/.test(candidate.reportKey)) score -= 0.2;

  const exactAlias = aliases.find((alias) => alias.targetType === 'report' && alias.reportKey === candidate.reportKey && alias.aliasKey === parsed.aliasKey);
  if (exactAlias) score = Math.max(score, Math.min(0.99, 0.9 + exactAlias.confidence * 0.1));

  return Math.max(0, Math.min(0.999, score));
}

function scoreAssetCandidate(parsed: ParsedTopic, candidate: AssetCandidate, aliases: QueryAliasRow[]): number {
  let score = overlapScore(parsed.normalizedInput, candidate.label);
  if (candidate.assetKey === parsed.assetKey) score = Math.max(score, parsed.isBroad ? 0.95 : 0.72);
  if (!parsed.isBroad) score -= 0.12;

  const exactAlias = aliases.find((alias) => alias.targetType === 'asset' && alias.assetKey === candidate.assetKey && alias.aliasKey === parsed.aliasKey);
  if (exactAlias) score = Math.max(score, Math.min(0.98, 0.88 + exactAlias.confidence * 0.1));

  return Math.max(0, Math.min(0.999, score));
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dynamicHeadAliases(head: DynamicCatalogHeadRow): QueryAliasRow[] {
  const assetKey = head.assetKey || head.key;
  const reportKey = head.reportKey || `${assetKey}-general`;
  const targetType: QueryAliasTargetType = head.publicSurface === 'report' ? 'report' : 'asset';
  return uniqueBy(
    [head.label, head.key, assetKey, reportKey, ...head.aliases]
      .map((alias) => alias.trim())
      .filter(Boolean)
      .map((alias) => ({
        aliasKey: normalizeAliasKey(alias),
        aliasLabel: alias,
        targetType,
        reportKey: targetType === 'report' ? reportKey : null,
        assetKey: targetType === 'asset' ? assetKey : null,
        source: 'manual' as QueryAliasSource,
        confidence: Math.max(0.75, Math.min(0.99, 0.88 + head.score / 100)),
        createdAt: head.createdAt,
        updatedAt: head.updatedAt,
      })),
    (alias) => alias.aliasKey,
  );
}

async function buildResolutionCatalog(): Promise<ResolutionCatalog> {
  if (!hasDb()) {
    return { reportCandidates: [], assetCandidates: [], aliases: [] };
  }

  return getOrComputeCached({
    key: buildCacheKey(['topic-resolution', 'catalog']),
    ttlMs: 60_000,
    loader: async () => {
      const [currentPublished, fallbackPublished, aliases, dynamicHeads] = await Promise.all([
        listCurrentPublished(300),
        listPublished(300),
        listQueryAliases(800),
        listApprovedDynamicCatalogHeads(500),
      ]);
      const sourceRows = [
        ...currentPublished.map((item) => ({
          session: item.session,
          head: item.head,
        })),
        ...fallbackPublished
          .filter((session) => session.slug)
          .map((session) => {
            const parsed = buildParsedTopic(session.topic);
            const reportKey = session.reportKey || parsed.reportKey || `${normalizeAssetKeyFromTopic(session.topic)}-general`;
            return {
              session,
              head: {
                reportKey,
                canonicalLabel: deriveCanonicalLabelFromTopic(session.topic),
                subjectKey: deriveSubjectKeyFromTopic(session.topic),
                currentSessionId: session.sessionId,
                currentSlug: session.slug || '',
                createdAt: new Date(session._creationTime).toISOString(),
                updatedAt: new Date(session._creationTime).toISOString(),
              },
            };
          }),
      ];

      const reportCandidates = uniqueBy(
        sourceRows
          .filter((item) => item.head.currentSlug)
          .map((item) => ({
            id: item.head.reportKey,
            label: item.head.canonicalLabel || item.session.topic,
            reportKey: item.head.reportKey,
            slug: item.head.currentSlug,
            sessionId: item.head.currentSessionId,
            assetKey: item.session.assetKey,
            subjectKey: item.head.subjectKey,
            updatedAt: Date.parse(item.head.updatedAt) || item.session._creationTime,
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt),
        (item) => item.reportKey,
      );

      const assetMap = new Map<string, AssetCandidate>();
      for (const report of reportCandidates) {
        if (!report.assetKey) continue;
        const current = assetMap.get(report.assetKey);
        const label = titleCase(report.assetKey.replace(/-/g, ' '));
        if (!current || report.updatedAt > current.updatedAt) {
          assetMap.set(report.assetKey, {
            id: report.assetKey,
            label,
            assetKey: report.assetKey,
            latestReport: report,
            updatedAt: report.updatedAt,
          });
        }
      }

      for (const head of dynamicHeads) {
        const assetKey = head.assetKey || head.key;
        if (!assetKey) continue;
        const reportKey = head.reportKey || `${assetKey}-general`;
        const updatedAt = Date.parse(head.updatedAt) || Date.now();
        const current = assetMap.get(assetKey);
        assetMap.set(assetKey, {
          id: assetKey,
          label: current?.label && current.latestReport ? current.label : head.label,
          assetKey,
          reportKey,
          publicSurface: head.publicSurface,
          priorityTier: head.priorityTier,
          dynamic: true,
          latestReport: current?.latestReport,
          updatedAt: Math.max(updatedAt, current?.updatedAt || 0),
        });
      }

      return {
        reportCandidates,
        assetCandidates: Array.from(assetMap.values()).sort((a, b) => b.updatedAt - a.updatedAt),
        aliases: [
          ...aliases,
          ...dynamicHeads.flatMap(dynamicHeadAliases),
        ],
      };
    },
  });
}

async function maybeTieBreak(
  parsed: ParsedTopic,
  candidates: Array<{ id: string; label: string; score: number }>,
): Promise<string | null> {
  if (!env.features.queryResolutionTieBreaker || !candidates.length) return null;
  const cfg = getAIConfig();
  if (!cfg) return null;
  try {
    return await getOrComputeCached({
      key: buildCacheKey([
        'topic-resolution',
        'tie-break',
        parsed.normalizedInput,
        candidates.map((candidate) => ({
          id: candidate.id,
          label: candidate.label,
          score: Number(candidate.score.toFixed(3)),
        })),
      ]),
      ttlMs: 10 * 60_000,
      loader: async () => {
        const result = await chatJson({
          config: cfg,
          schema: TIE_BREAK_SCHEMA,
          temperature: 0,
          system: 'Choose the best semantic match candidate id for the given market query. Return only a valid candidateId from the list.',
          user: [
            `Query: ${parsed.normalizedInput}`,
            'Candidates:',
            ...candidates.map((candidate) => `- ${candidate.id}: ${candidate.label} (score ${candidate.score.toFixed(3)})`),
          ].join('\n'),
        });
        return result.candidateId || null;
      },
    });
  } catch {
    return null;
  }
}

export function normalizeAliasKey(raw: string): string {
  return slugify(raw || 'market');
}

export function normalizeAssetKeyFromTopic(raw: string, locale?: string): string {
  const parsed = buildParsedTopic(raw, locale);
  return parsed.assetKey || parsed.subjectKey || slugify(raw) || 'asset';
}

export function deriveTopicResolution(raw: string, locale?: string) {
  return buildParsedTopic(raw, locale);
}

export function deriveReportKeyFromTopic(raw: string, locale?: string): string {
  const parsed = buildParsedTopic(raw, locale);
  return parsed.reportKey || `${parsed.subjectKey || 'market'}-general`;
}

export function deriveCanonicalLabelFromTopic(raw: string, locale?: string): string {
  return buildParsedTopic(raw, locale).canonicalLabel;
}

export function deriveSubjectKeyFromTopic(raw: string, locale?: string): string {
  return buildParsedTopic(raw, locale).subjectKey || normalizeAssetKeyFromTopic(raw, locale);
}

export function deriveTopicVisibility(raw: string, locale?: string): {
  visibility: 'public' | 'private';
  canonicalLabel: string;
  assetKey: string | null;
  reportKey: string | null;
  subjectKey: string;
  publicSurface: 'asset_hub' | 'report';
  priorityTier: 'v1' | 'secondary';
  reason: 'canonical_subject' | 'curated_comparison' | 'comparison_or_multi_subject' | 'fallback_subject';
} {
  const parsed = buildParsedTopic(raw, locale);
  const isCuratedComparison = parsed.lens === 'comparison' && COMPARISON_DEFINITIONS.some((item) => item.key === parsed.subjectKey);
  const isKnownSubject = SUBJECT_BY_KEY.has(parsed.subjectKey);
  const isCanonicalSubject = isKnownSubject && parsed.matchCount === 1 && !parsed.compareTarget;
  const canonicalHead = getCanonicalHeadByKey(parsed.subjectKey) || (parsed.assetKey ? getCanonicalHeadByAssetKey(parsed.assetKey) : null);
  const publicSurface = canonicalHead?.publicSurface || (isCuratedComparison ? 'report' : 'asset_hub');
  const priorityTier = canonicalHead?.priorityTier || 'secondary';

  if (isCuratedComparison) {
    return {
      visibility: 'public',
      canonicalLabel: parsed.canonicalLabel,
      assetKey: parsed.assetKey,
      reportKey: parsed.reportKey,
      subjectKey: parsed.subjectKey,
      publicSurface,
      priorityTier,
      reason: 'curated_comparison',
    };
  }

  if (isCanonicalSubject) {
    return {
      visibility: 'public',
      canonicalLabel: parsed.canonicalLabel,
      assetKey: parsed.assetKey,
      reportKey: parsed.reportKey,
      subjectKey: parsed.subjectKey,
      publicSurface,
      priorityTier,
      reason: 'canonical_subject',
    };
  }

  return {
    visibility: 'private',
    canonicalLabel: parsed.canonicalLabel || parsed.subjectLabel,
    assetKey: parsed.assetKey,
    reportKey: parsed.reportKey,
    subjectKey: parsed.subjectKey,
    publicSurface,
    priorityTier,
    reason: parsed.compareTarget ? 'comparison_or_multi_subject' : isKnownSubject ? 'comparison_or_multi_subject' : 'fallback_subject',
  };
}

export async function syncPublishedSessionTargets({
  session,
  slug,
  assetKey,
  locale,
}: {
  session: SessionRow;
  slug: string;
  assetKey: string;
  locale?: string;
}): Promise<{
  reportKey: string;
  canonicalLabel: string;
  subjectKey: string;
}> {
  const parsed = buildParsedTopic(session.topic, locale);
  const reportKey = session.reportKey || parsed.reportKey || `${assetKey}-general`;
  const existingHead = await getReportHead(reportKey);
  const canonicalLabel = existingHead?.canonicalLabel || parsed.canonicalLabel || session.topic;
  const subjectKey = parsed.subjectKey || assetKey;

  await updateSessionReportKey(session.sessionId, reportKey);
  await upsertReportHead({
    reportKey,
    canonicalLabel,
    subjectKey,
    currentSessionId: session.sessionId,
    currentSlug: slug,
  });

  const aliases: Array<{
    aliasKey: string;
    aliasLabel: string;
    targetType: QueryAliasTargetType;
    reportKey?: string | null;
    assetKey?: string | null;
    source: QueryAliasSource;
    confidence: number;
  }> = [];

  if (parsed.isBroad) {
    aliases.push({
      aliasKey: normalizeAliasKey(session.topic),
      aliasLabel: session.topic,
      targetType: 'asset',
      assetKey,
      source: 'report',
      confidence: 0.98,
    });
    aliases.push({
      aliasKey: normalizeAliasKey(canonicalLabel),
      aliasLabel: canonicalLabel,
      targetType: 'asset',
      assetKey,
      source: 'report',
      confidence: 0.96,
    });
  } else {
    aliases.push({
      aliasKey: normalizeAliasKey(session.topic),
      aliasLabel: session.topic,
      targetType: 'report',
      reportKey,
      source: 'report',
      confidence: 0.99,
    });
    aliases.push({
      aliasKey: normalizeAliasKey(canonicalLabel),
      aliasLabel: canonicalLabel,
      targetType: 'report',
      reportKey,
      source: 'report',
      confidence: 0.97,
    });
    const comparisonDefinition = getComparisonByKey(subjectKey);
    if (comparisonDefinition) {
      const primaryLabel =
        SUBJECT_BY_KEY.get(comparisonDefinition.primarySubjectKey)?.label || comparisonDefinition.primarySubjectKey;
      const secondaryLabel =
        SUBJECT_BY_KEY.get(comparisonDefinition.secondarySubjectKey)?.label || comparisonDefinition.secondarySubjectKey;
      for (const label of [
        `${primaryLabel} vs ${secondaryLabel}`,
        `${secondaryLabel} vs ${primaryLabel}`,
        `${primaryLabel} versus ${secondaryLabel}`,
        `${secondaryLabel} versus ${primaryLabel}`,
        ...getComparisonAliases(comparisonDefinition, locale),
      ]) {
        aliases.push({
          aliasKey: normalizeAliasKey(label),
          aliasLabel: label,
          targetType: 'report',
          reportKey,
          source: 'report',
          confidence: 0.96,
        });
      }
    }
  }

  const subjectAliasLabel = SUBJECT_BY_KEY.get(subjectKey)?.label || titleCase(assetKey.replace(/-/g, ' '));
  aliases.push({
    aliasKey: normalizeAliasKey(subjectAliasLabel),
    aliasLabel: subjectAliasLabel,
    targetType: 'asset',
    assetKey,
    source: 'report',
    confidence: 0.94,
  });

  for (const alias of uniqueBy(aliases, (item) => item.aliasKey)) {
    await upsertQueryAlias(alias);
  }

  clearServerCaches();
  return { reportKey, canonicalLabel, subjectKey };
}

export async function resolveTopicQuery({
  input,
  surface,
  locale,
}: {
  input: string;
  surface: ResolverSurface;
  locale?: string;
}): Promise<QueryResolveResult> {
  const trimmed = input.trim();
  const scope = assessMarketQueryScope({ topic: trimmed, locale });
  if (!scope.ok) {
    return {
      decision: 'reject',
      code: 'OFF_DOMAIN_QUERY',
      message: scope.message,
      supportedExamples: scope.supportedExamples,
    };
  }

  if (!env.features.queryResolution) {
    const parsed = buildParsedTopic(trimmed, locale);
    const visibility = deriveTopicVisibility(trimmed, locale);
    if (visibility.visibility === 'private') {
      return {
        decision: 'run_private',
        typedQuery: trimmed,
        canonicalLabel: visibility.canonicalLabel,
        visibility: 'private',
        publicSurface: visibility.publicSurface,
        priorityTier: visibility.priorityTier,
        assetKey: parsed.assetKey,
        message: getPrivateRunMessage(locale, 'feature_private_only'),
      };
    }
    return {
      decision: 'run',
      typedQuery: trimmed,
      canonicalLabel: parsed.reportKey ? parsed.canonicalLabel : null,
      reportKey: parsed.reportKey,
      visibility: 'public',
      publicSurface: visibility.publicSurface,
      priorityTier: visibility.priorityTier,
      assetKey: parsed.assetKey,
    };
  }

  const parsed = buildParsedTopic(trimmed, locale);
  const visibility = deriveTopicVisibility(trimmed, locale);
  let catalog: ResolutionCatalog | null = null;
  const loadCatalog = async () => {
    if (catalog) return catalog;
    catalog = await buildResolutionCatalog();
    return catalog;
  };
  const fallbackResult = () => {
    if (visibility.visibility === 'private') {
      return {
        decision: 'run_private' as const,
        typedQuery: trimmed,
        canonicalLabel: visibility.canonicalLabel,
        visibility: 'private' as const,
        publicSurface: visibility.publicSurface,
        priorityTier: visibility.priorityTier,
        assetKey: visibility.assetKey,
        message: getPrivateRunMessage(
          locale,
          visibility.reason === 'comparison_or_multi_subject' ? 'comparison_private_only' : 'fallback_private_only',
        ),
      };
    }

    return {
      decision: 'run' as const,
      typedQuery: trimmed,
      canonicalLabel: parsed.reportKey ? parsed.canonicalLabel : null,
      reportKey: parsed.reportKey,
      visibility: 'public' as const,
      publicSurface: visibility.publicSurface,
      priorityTier: visibility.priorityTier,
      assetKey: parsed.assetKey,
    };
  };
  const buildAssetReuseResult = (latestReport?: AssetCandidate['latestReport'] | undefined) => {
    const actions: QueryResolveReuse['actions'] = ['open_asset_hub', 'scrape_again'];
    if (latestReport) actions.splice(1, 0, 'open_current_report');
    return {
      decision: 'reuse' as const,
      reuseType: 'asset' as const,
      typedQuery: trimmed,
      canonicalLabel: parsed.subjectLabel,
      lastUpdatedAt: latestReport ? new Date(latestReport.updatedAt).toISOString() : null,
      publicSurface: 'asset_hub' as const,
      priorityTier: visibility.priorityTier,
      assetKey: parsed.assetKey || undefined,
      latestReport: latestReport
        ? {
            reportKey: latestReport.reportKey,
            slug: latestReport.slug,
            sessionId: latestReport.sessionId,
          }
        : undefined,
      actions,
    };
  };
  const buildReportReuseResult = (report: ReportCandidate) => ({
    decision: 'reuse' as const,
    reuseType: 'report' as const,
    typedQuery: trimmed,
    canonicalLabel: report.label,
    lastUpdatedAt: new Date(report.updatedAt).toISOString(),
    publicSurface: 'report' as const,
    priorityTier: getCanonicalHeadByKey(report.subjectKey)?.priorityTier || visibility.priorityTier,
    assetKey: report.assetKey || undefined,
    currentReport: {
      reportKey: report.reportKey,
      slug: report.slug,
      sessionId: report.sessionId,
    },
    actions: report.assetKey
      ? (['open_current_report', 'open_asset_hub', 'scrape_again'] as QueryResolveReuse['actions'])
      : (['open_current_report', 'scrape_again'] as QueryResolveReuse['actions']),
  });
  const buildDynamicRunResult = (candidate: AssetCandidate) => ({
    decision: 'run' as const,
    typedQuery: trimmed,
    canonicalLabel: candidate.label,
    reportKey: candidate.reportKey || `${candidate.assetKey}-general`,
    visibility: 'public' as const,
    publicSurface: candidate.publicSurface || 'asset_hub',
    priorityTier: candidate.priorityTier || 'secondary',
    assetKey: candidate.assetKey,
  });

  if (parsed.explicitMultiSubjectComparison && visibility.visibility === 'private') {
    return {
      decision: 'run_private',
      typedQuery: trimmed,
      canonicalLabel: visibility.canonicalLabel,
      visibility: 'private',
      publicSurface: visibility.publicSurface,
      priorityTier: visibility.priorityTier,
      assetKey: visibility.assetKey,
      message: getPrivateRunMessage(locale, 'comparison_private_only'),
    };
  }
  if (parsed.compareTarget && visibility.visibility === 'private') {
    return {
      decision: 'run_private',
      typedQuery: trimmed,
      canonicalLabel: visibility.canonicalLabel,
      visibility: 'private',
      publicSurface: visibility.publicSurface,
      priorityTier: visibility.priorityTier,
      assetKey: visibility.assetKey,
      message: getPrivateRunMessage(locale, 'comparison_private_only'),
    };
  }
  if (visibility.reason === 'curated_comparison') {
    return {
      decision: 'run',
      typedQuery: trimmed,
      canonicalLabel: parsed.canonicalLabel,
      reportKey: parsed.reportKey,
      visibility: 'public',
      publicSurface: visibility.publicSurface,
      priorityTier: visibility.priorityTier,
      assetKey: parsed.assetKey,
    };
  }
  if (parsed.isBroad && visibility.visibility === 'public' && visibility.publicSurface === 'asset_hub' && parsed.assetKey) {
    try {
      const current = (await loadCatalog()).assetCandidates.find((candidate) => candidate.assetKey === parsed.assetKey);
      return buildAssetReuseResult(current?.latestReport);
    } catch {
      return buildAssetReuseResult();
    }
  }
  if (
    !parsed.isBroad &&
    parsed.lens === 'price-move' &&
    visibility.visibility === 'public' &&
    parsed.matchCount === 1 &&
    parsed.reportKey &&
    !parsed.compareTarget
  ) {
    try {
      const report = (await loadCatalog()).reportCandidates.find((candidate) => candidate.reportKey === parsed.reportKey);
      if (report) {
        return buildReportReuseResult(report);
      }
      return fallbackResult();
    } catch {
      return fallbackResult();
    }
  }
  try {
    catalog = await loadCatalog();
  } catch {
    return fallbackResult();
  }
  const loadedCatalog = catalog;
  const reportScores = loadedCatalog.reportCandidates
    .map((candidate) => ({
      ...candidate,
      targetType: 'report' as const,
      score: scoreReportCandidate(parsed, candidate, loadedCatalog.aliases),
    }))
    .filter((candidate) => candidate.score >= 0.45)
    .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);

  const assetScores = loadedCatalog.assetCandidates
    .map((candidate) => ({
      ...candidate,
      targetType: 'asset' as const,
      score: scoreAssetCandidate(parsed, candidate, loadedCatalog.aliases),
    }))
    .filter((candidate) => candidate.score >= 0.45)
    .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);

  const combined = uniqueBy([...reportScores, ...assetScores], (item) => `${item.targetType}:${item.id}`).sort(
    (a, b) => b.score - a.score || b.updatedAt - a.updatedAt,
  );
  const top = combined[0];
  const second = combined[1];

  if (top && second && top.score >= 0.55 && Math.abs(top.score - second.score) <= 0.05) {
    const tieWinner = await maybeTieBreak(
      parsed,
      combined.slice(0, 3).map((candidate) => ({
        id: `${candidate.targetType}:${candidate.id}`,
        label: candidate.label,
        score: candidate.score,
      })),
    );
    if (tieWinner) {
      const preferred = combined.find((candidate) => `${candidate.targetType}:${candidate.id}` === tieWinner);
      if (preferred) {
        combined.splice(0, combined.length, preferred, ...combined.filter((candidate) => candidate !== preferred));
      }
    }
  }

  const best = combined[0];
  const gap = best && second ? best.score - second.score : 1;

  if (best && best.score >= 0.85 && gap >= 0.1) {
    if (best.targetType === 'report') {
      const actions: QueryResolveReuse['actions'] = ['open_current_report', 'scrape_again'];
      if (best.assetKey) actions.splice(1, 0, 'open_asset_hub');
      return {
        decision: 'reuse',
        reuseType: 'report',
        typedQuery: trimmed,
        canonicalLabel: best.label,
        lastUpdatedAt: new Date(best.updatedAt).toISOString(),
        publicSurface: 'report',
        priorityTier: getCanonicalHeadByKey(best.subjectKey)?.priorityTier || 'secondary',
        assetKey: best.assetKey || undefined,
        currentReport: {
          reportKey: best.reportKey,
          slug: best.slug,
          sessionId: best.sessionId,
        },
        actions,
      };
    }

    if (best.dynamic && !best.latestReport) {
      return buildDynamicRunResult(best);
    }

    const actions: QueryResolveReuse['actions'] = ['open_asset_hub', 'scrape_again'];
    if (best.latestReport) actions.splice(1, 0, 'open_current_report');
    return {
      decision: 'reuse',
      reuseType: 'asset',
      typedQuery: trimmed,
      canonicalLabel: best.label,
      lastUpdatedAt: best.latestReport ? new Date(best.latestReport.updatedAt).toISOString() : null,
      publicSurface: 'asset_hub',
      priorityTier: best.priorityTier || getCanonicalHeadByAssetKey(best.assetKey)?.priorityTier || 'secondary',
      assetKey: best.assetKey,
      latestReport: best.latestReport
        ? {
            reportKey: best.latestReport.reportKey,
            slug: best.latestReport.slug,
            sessionId: best.latestReport.sessionId,
          }
        : undefined,
      actions,
    };
  }

  if (best && best.score >= 0.55) {
    const assetVsGeneralReportAmbiguity =
      best.targetType === 'asset' &&
      (visibility.visibility === 'public' || Boolean(best.dynamic)) &&
      (
        !second ||
        (
          second.targetType === 'report' &&
          second.assetKey === best.assetKey &&
          /(^|-)general$/.test(second.reportKey)
        )
      );

    if (assetVsGeneralReportAmbiguity) {
      if (best.dynamic && !best.latestReport) {
        return buildDynamicRunResult(best);
      }

      const actions: QueryResolveReuse['actions'] = ['open_asset_hub', 'scrape_again'];
      if (best.latestReport) actions.splice(1, 0, 'open_current_report');
      return {
        decision: 'reuse',
        reuseType: 'asset',
        typedQuery: trimmed,
        canonicalLabel: best.label,
        lastUpdatedAt: best.latestReport ? new Date(best.latestReport.updatedAt).toISOString() : null,
        publicSurface: 'asset_hub',
        priorityTier: best.priorityTier || getCanonicalHeadByAssetKey(best.assetKey)?.priorityTier || 'secondary',
        assetKey: best.assetKey,
        latestReport: best.latestReport
          ? {
              reportKey: best.latestReport.reportKey,
              slug: best.latestReport.slug,
              sessionId: best.latestReport.sessionId,
            }
          : undefined,
        actions,
      };
    }

    return {
      decision: 'ambiguous',
      typedQuery: trimmed,
      candidates: combined.slice(0, surface === 'landing' ? 4 : 5).map((candidate) => ({
        id: `${candidate.targetType}:${candidate.id}`,
        label: candidate.label,
        targetType: candidate.targetType,
        reportKey: candidate.targetType === 'report' ? candidate.reportKey : undefined,
        slug: candidate.targetType === 'report' ? candidate.slug : candidate.latestReport?.slug,
        assetKey: candidate.targetType === 'asset' ? candidate.assetKey : candidate.assetKey || undefined,
        score: Number(candidate.score.toFixed(3)),
      })),
      allowRunAsTyped: true,
    };
  }

  if (visibility.visibility === 'private') {
    return fallbackResult();
  }

  return fallbackResult();
}
