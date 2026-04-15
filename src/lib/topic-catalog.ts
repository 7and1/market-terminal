import type { Locale } from '@/i18n/routing';

export type SubjectDefinition = {
  key: string;
  label: string;
  assetKey: string;
  aliases: string[];
  publicSurface: 'asset_hub';
  priorityTier: 'v1' | 'secondary';
  seedEnabled: boolean;
  defaultRunMode: 'deep' | 'fast';
  defaultCadenceMinutes: 15 | 60 | 360 | 1440;
  priceContextSupport: 'native' | 'proxy' | 'unsupported';
  defaultSeedQuery: string;
};

export type ComparisonDefinition = {
  key: string;
  label: string;
  primarySubjectKey: string;
  secondarySubjectKey: string;
  primaryAssetKey: string;
  aliases: string[];
  aliasesZh: string[];
  buyerIntentSummary: string;
  relatedComparisonKeys: string[];
  publicSurface: 'report';
  priorityTier: 'v1' | 'secondary';
  seedEnabled: boolean;
  defaultRunMode: 'deep' | 'fast';
  defaultCadenceMinutes: 15 | 60 | 360 | 1440;
  priceContextSupport: 'unsupported';
  defaultSeedQuery: string;
};

export type CanonicalHeadDefinition = {
  key: string;
  label: string;
  assetKey: string;
  headType: 'subject' | 'comparison';
  publicSurface: 'asset_hub' | 'report';
  priorityTier: 'v1' | 'secondary';
  seedEnabled: boolean;
  defaultRunMode: 'deep' | 'fast';
  defaultCadenceMinutes: 15 | 60 | 360 | 1440;
  priceContextSupport: 'native' | 'proxy' | 'unsupported';
  defaultSeedQuery: string;
};

export const SUBJECT_DEFINITIONS = [
  {
    key: 'bitcoin',
    label: 'Bitcoin',
    assetKey: 'bitcoin',
    aliases: ['bitcoin', 'btc'],
    publicSurface: 'asset_hub',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 360,
    priceContextSupport: 'native',
    defaultSeedQuery: 'Why is BTC moving today? Map the strongest catalysts in the last 24 hours.',
  },
  {
    key: 'ethereum',
    label: 'Ethereum',
    assetKey: 'ethereum',
    aliases: ['ethereum', 'eth'],
    publicSurface: 'asset_hub',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 360,
    priceContextSupport: 'native',
    defaultSeedQuery: 'Why is ETH moving today? Identify the main market and macro drivers in the last 24 hours.',
  },
  {
    key: 'solana',
    label: 'Solana',
    assetKey: 'solana',
    aliases: ['solana', 'sol'],
    publicSurface: 'asset_hub',
    priorityTier: 'secondary',
    seedEnabled: false,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'native',
    defaultSeedQuery: 'Why is SOL moving today? Track catalysts, ecosystem headlines, and cross-crypto read-through.',
  },
  {
    key: 'gold',
    label: 'Gold',
    assetKey: 'gold',
    aliases: ['gold', 'xau'],
    publicSurface: 'asset_hub',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 360,
    priceContextSupport: 'proxy',
    defaultSeedQuery: 'Why is gold moving today? Focus on yields, the dollar, safe-haven demand, and inflation signals.',
  },
  {
    key: 'oil',
    label: 'Oil',
    assetKey: 'oil',
    aliases: ['oil', 'crude oil', 'crude', 'wti', 'brent'],
    publicSurface: 'asset_hub',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 360,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Why is oil moving today? Track supply, geopolitics, OPEC, and dollar-linked macro drivers.',
  },
  {
    key: 'dxy',
    label: 'DXY',
    assetKey: 'dxy',
    aliases: ['dxy', 'dollar index', 'us dollar', 'usd'],
    publicSurface: 'asset_hub',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 360,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Why is DXY moving today? Focus on rates, Fed pricing, and cross-asset transmission.',
  },
  {
    key: 'nvda',
    label: 'NVDA',
    assetKey: 'nvda',
    aliases: ['nvda', 'nvidia'],
    publicSurface: 'asset_hub',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 360,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Why is NVDA moving today? Track earnings, AI demand, semis read-through, and policy risk.',
  },
  {
    key: 'aapl',
    label: 'AAPL',
    assetKey: 'aapl',
    aliases: ['aapl', 'apple'],
    publicSurface: 'asset_hub',
    priorityTier: 'secondary',
    seedEnabled: false,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Why is AAPL moving today? Track consumer demand, product cycle, and macro risk factors.',
  },
  {
    key: 'tsla',
    label: 'TSLA',
    assetKey: 'tsla',
    aliases: ['tsla', 'tesla'],
    publicSurface: 'asset_hub',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 360,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Why is TSLA moving today? Track delivery expectations, EV competition, policy, and risk sentiment.',
  },
  {
    key: 'msft',
    label: 'MSFT',
    assetKey: 'msft',
    aliases: ['msft', 'microsoft'],
    publicSurface: 'asset_hub',
    priorityTier: 'secondary',
    seedEnabled: false,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Why is MSFT moving today? Track cloud, AI monetization, and broad tech read-through.',
  },
  {
    key: 'meta',
    label: 'Meta',
    assetKey: 'meta',
    aliases: ['meta', 'facebook'],
    publicSurface: 'asset_hub',
    priorityTier: 'secondary',
    seedEnabled: false,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Why is Meta moving today? Track ads demand, AI spending, and large-cap tech sentiment.',
  },
  {
    key: 'amzn',
    label: 'AMZN',
    assetKey: 'amzn',
    aliases: ['amzn', 'amazon'],
    publicSurface: 'asset_hub',
    priorityTier: 'secondary',
    seedEnabled: false,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Why is AMZN moving today? Track AWS, retail demand, and broad consumer or AI catalysts.',
  },
  {
    key: 'goog',
    label: 'GOOG',
    assetKey: 'goog',
    aliases: ['goog', 'googl', 'google', 'alphabet'],
    publicSurface: 'asset_hub',
    priorityTier: 'secondary',
    seedEnabled: false,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Why is GOOG moving today? Track AI search pressure, ads, and mega-cap tech sentiment.',
  },
  {
    key: 'spy',
    label: 'SPY',
    assetKey: 'spy',
    aliases: ['spy', 's&p 500', 'sp500', 's and p 500'],
    publicSurface: 'asset_hub',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 360,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Why is SPY moving today? Map breadth, macro drivers, policy headlines, and sector spillovers.',
  },
  {
    key: 'qqq',
    label: 'QQQ',
    assetKey: 'qqq',
    aliases: ['qqq', 'nasdaq 100'],
    publicSurface: 'asset_hub',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 360,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Why is QQQ moving today? Track rates pressure, mega-cap leadership, and AI-linked sentiment.',
  },
  {
    key: 'rates',
    label: 'Rates',
    assetKey: 'rates',
    aliases: ['rates', 'interest rates', 'rate path'],
    publicSurface: 'asset_hub',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 360,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'How are rates moving today, and what is the strongest read-through to equities, gold, and the dollar?',
  },
  {
    key: 'yields',
    label: 'Yields',
    assetKey: 'yields',
    aliases: ['yields', 'treasury yields', 'bond yields'],
    publicSurface: 'asset_hub',
    priorityTier: 'secondary',
    seedEnabled: false,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'How are Treasury yields moving today, and what cross-asset reactions matter most?',
  },
  {
    key: 'fed',
    label: 'Fed',
    assetKey: 'fed',
    aliases: ['fed', 'fomc', 'federal reserve'],
    publicSurface: 'asset_hub',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'What is the latest Fed read-through for markets right now? Focus on policy path, rates, dollar, and equity spillovers.',
  },
  {
    key: 'cpi',
    label: 'CPI',
    assetKey: 'cpi',
    aliases: ['cpi', 'inflation', 'consumer price index'],
    publicSurface: 'asset_hub',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'What is the latest CPI market impact? Track rates, dollar, equities, and gold read-through.',
  },
  {
    key: 'tariffs',
    label: 'Tariffs',
    assetKey: 'tariffs',
    aliases: ['tariff', 'tariffs', 'trade war'],
    publicSurface: 'asset_hub',
    priorityTier: 'secondary',
    seedEnabled: false,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'How are tariffs affecting markets right now? Focus on semis, industrials, dollar, and macro spillovers.',
  },
  {
    key: 'semis',
    label: 'Semis',
    assetKey: 'semis',
    aliases: ['semis', 'semiconductors', 'chip stocks'],
    publicSurface: 'asset_hub',
    priorityTier: 'secondary',
    seedEnabled: false,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'What is moving semis right now? Focus on AI demand, policy headlines, and supplier read-through.',
  },
  {
    key: 'energy',
    label: 'Energy',
    assetKey: 'energy',
    aliases: ['energy', 'energy equities'],
    publicSurface: 'asset_hub',
    priorityTier: 'secondary',
    seedEnabled: false,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'What is moving energy equities right now? Track oil, natural gas, and macro risk sentiment.',
  },
  {
    key: 'tech',
    label: 'Tech',
    assetKey: 'tech',
    aliases: ['tech', 'growth stocks', 'technology stocks'],
    publicSurface: 'asset_hub',
    priorityTier: 'secondary',
    seedEnabled: false,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'What is moving tech stocks right now? Focus on rates, AI, earnings, and risk appetite.',
  },
  {
    key: 'natural-gas',
    label: 'Natural Gas',
    assetKey: 'natural-gas',
    aliases: ['natural gas', 'nat gas'],
    publicSurface: 'asset_hub',
    priorityTier: 'secondary',
    seedEnabled: false,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'What is moving natural gas right now? Track weather, storage, and supply-demand balance.',
  },
] as const satisfies readonly SubjectDefinition[];

export const SUBJECT_BY_KEY = new Map<string, (typeof SUBJECT_DEFINITIONS)[number]>(
  SUBJECT_DEFINITIONS.map((item) => [item.key, item] as const),
);

export const COMPARISON_DEFINITIONS = [
  {
    key: 'gold-vs-bitcoin',
    label: 'Gold vs Bitcoin',
    primarySubjectKey: 'gold',
    secondarySubjectKey: 'bitcoin',
    primaryAssetKey: 'gold',
    aliases: ['gold vs bitcoin', 'bitcoin vs gold', 'gold versus bitcoin', 'bitcoin versus gold'],
    aliasesZh: ['黄金 vs 比特币', '比特币 vs 黄金', '黄金对比比特币', '比特币对比黄金'],
    buyerIntentSummary: 'Use this pair to compare hard-asset, inflation-hedge, and liquidity-regime narratives across commodities and crypto.',
    relatedComparisonKeys: ['yields-vs-gold', 'bitcoin-vs-qqq'],
    publicSurface: 'report',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Gold vs Bitcoin: which macro drivers matter more right now, and what changed since the last update?',
  },
  {
    key: 'oil-vs-dxy',
    label: 'Oil vs DXY',
    primarySubjectKey: 'oil',
    secondarySubjectKey: 'dxy',
    primaryAssetKey: 'oil',
    aliases: ['oil vs dxy', 'dxy vs oil', 'crude oil vs dollar index', 'brent vs usd'],
    aliasesZh: ['原油 vs 美元指数', '美元指数 vs 原油', '油价对比美元指数'],
    buyerIntentSummary: 'Use this pair to track commodity-price sensitivity to dollar strength, macro tightening, and global growth expectations.',
    relatedComparisonKeys: ['rates-vs-tech', 'yields-vs-gold'],
    publicSurface: 'report',
    priorityTier: 'secondary',
    seedEnabled: false,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Oil vs DXY: which driver is dominating the move right now, and what changed since the last update?',
  },
  {
    key: 'spy-vs-qqq',
    label: 'SPY vs QQQ',
    primarySubjectKey: 'spy',
    secondarySubjectKey: 'qqq',
    primaryAssetKey: 'spy',
    aliases: ['spy vs qqq', 'qqq vs spy', 's&p 500 vs nasdaq 100'],
    aliasesZh: ['标普500 vs 纳指100', 'SPY vs QQQ', '纳指100 vs 标普500'],
    buyerIntentSummary: 'Use this pair to compare broad-market breadth versus growth-heavy leadership when macro and rate expectations shift.',
    relatedComparisonKeys: ['rates-vs-tech', 'bitcoin-vs-qqq'],
    publicSurface: 'report',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'SPY vs QQQ: what is driving relative leadership right now, and what changed since the last update?',
  },
  {
    key: 'rates-vs-tech',
    label: 'Rates vs Tech',
    primarySubjectKey: 'rates',
    secondarySubjectKey: 'tech',
    primaryAssetKey: 'rates',
    aliases: ['rates vs tech', 'tech vs rates', 'interest rates vs technology stocks'],
    aliasesZh: ['利率 vs 科技股', '科技股 vs 利率', '利率对比科技股'],
    buyerIntentSummary: 'Use this pair to read duration pressure, discount-rate repricing, and growth-equity sensitivity in one public comparison head.',
    relatedComparisonKeys: ['spy-vs-qqq', 'oil-vs-dxy'],
    publicSurface: 'report',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Rates vs Tech: which rate signals matter most right now, and how is the transmission into growth equities evolving?',
  },
  {
    key: 'yields-vs-gold',
    label: 'Yields vs Gold',
    primarySubjectKey: 'yields',
    secondarySubjectKey: 'gold',
    primaryAssetKey: 'yields',
    aliases: ['yields vs gold', 'gold vs yields', 'treasury yields vs gold'],
    aliasesZh: ['美债收益率 vs 黄金', '黄金 vs 美债收益率', '收益率对比黄金'],
    buyerIntentSummary: 'Use this pair to measure real-rate pressure, safe-haven demand, and inflation-hedge rotation through a single report head.',
    relatedComparisonKeys: ['gold-vs-bitcoin', 'oil-vs-dxy'],
    publicSurface: 'report',
    priorityTier: 'secondary',
    seedEnabled: false,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Yields vs Gold: what changed in the real-rate narrative, and which evidence matters now?',
  },
  {
    key: 'bitcoin-vs-qqq',
    label: 'Bitcoin vs QQQ',
    primarySubjectKey: 'bitcoin',
    secondarySubjectKey: 'qqq',
    primaryAssetKey: 'bitcoin',
    aliases: ['bitcoin vs qqq', 'qqq vs bitcoin', 'btc vs nasdaq 100'],
    aliasesZh: ['比特币 vs 纳指100', '纳指100 vs 比特币', 'BTC 对比 QQQ'],
    buyerIntentSummary: 'Use this pair to compare crypto beta and growth-equity beta when liquidity, positioning, and risk appetite move together.',
    relatedComparisonKeys: ['gold-vs-bitcoin', 'spy-vs-qqq'],
    publicSurface: 'report',
    priorityTier: 'v1',
    seedEnabled: true,
    defaultRunMode: 'deep',
    defaultCadenceMinutes: 1440,
    priceContextSupport: 'unsupported',
    defaultSeedQuery: 'Bitcoin vs QQQ: which risk-on drivers matter most right now, and what changed since the last update?',
  },
] as const satisfies readonly ComparisonDefinition[];

type LocalizedAliasMap = Partial<Record<Locale, readonly string[]>>;

const SUBJECT_LOCALIZED_ALIASES: Partial<Record<(typeof SUBJECT_DEFINITIONS)[number]['key'], LocalizedAliasMap>> = {
  bitcoin: {
    zh: ['比特币'],
  },
  ethereum: {
    zh: ['以太坊'],
    es: ['ether', 'ethereum'],
  },
  gold: {
    zh: ['黄金', '金价'],
    es: ['oro'],
  },
  oil: {
    zh: ['原油', '油价'],
    es: ['petroleo', 'petróleo', 'crudo'],
  },
  dxy: {
    zh: ['美元指数'],
    es: ['indice del dolar', 'índice del dólar', 'indice dolar', 'índice dólar'],
  },
  nvda: {
    zh: ['英伟达'],
    es: ['nvidia'],
  },
  spy: {
    zh: ['标普500'],
    es: ['sp 500', 's p 500'],
  },
  qqq: {
    zh: ['纳指100'],
    es: ['nasdaq 100', 'nasdaq100'],
  },
  rates: {
    zh: ['利率'],
    es: ['tasas', 'tipos de interes', 'tipos de interés'],
  },
  yields: {
    zh: ['收益率', '美债收益率'],
    es: ['rendimientos', 'rendimiento', 'rendimientos del tesoro'],
  },
  tech: {
    zh: ['科技股', '科技'],
    es: ['tecnologia', 'tecnología', 'acciones tecnologicas', 'acciones tecnológicas'],
  },
};

const COMPARISON_LOCALIZED_ALIASES: Partial<Record<(typeof COMPARISON_DEFINITIONS)[number]['key'], LocalizedAliasMap>> = {
  'gold-vs-bitcoin': {
    zh: ['黄金 vs 比特币', '比特币 vs 黄金', '黄金对比比特币', '比特币对比黄金'],
    es: ['oro vs bitcoin', 'bitcoin vs oro', 'oro versus bitcoin', 'bitcoin versus oro'],
  },
  'oil-vs-dxy': {
    zh: ['原油 vs 美元指数', '美元指数 vs 原油', '油价对比美元指数'],
    es: ['petroleo vs indice del dolar', 'petróleo vs índice del dólar', 'indice del dolar vs petroleo'],
  },
  'spy-vs-qqq': {
    zh: ['标普500 vs 纳指100', 'SPY vs QQQ', '纳指100 vs 标普500'],
    es: ['spy vs qqq', 's&p 500 vs nasdaq 100', 'sp 500 vs nasdaq 100'],
  },
  'rates-vs-tech': {
    zh: ['利率 vs 科技股', '科技股 vs 利率', '利率对比科技股'],
    es: ['tasas vs tecnologia', 'tasas vs tecnología', 'tecnologia vs tasas', 'tecnología vs tasas'],
  },
  'yields-vs-gold': {
    zh: ['美债收益率 vs 黄金', '黄金 vs 美债收益率', '收益率对比黄金'],
    es: ['rendimientos vs oro', 'oro vs rendimientos', 'rendimientos del tesoro vs oro'],
  },
  'bitcoin-vs-qqq': {
    zh: ['比特币 vs 纳指100', '纳指100 vs 比特币', 'BTC 对比 QQQ'],
    es: ['bitcoin vs qqq', 'qqq vs bitcoin', 'btc vs nasdaq 100'],
  },
};

function dedupeAliases(groups: Array<readonly string[] | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const group of groups) {
    if (!group) continue;
    for (const alias of group) {
      const cleaned = String(alias || '').trim();
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(cleaned);
    }
  }

  return out;
}

export function getSubjectAliases(subject: SubjectDefinition, locale?: string): string[] {
  const normalizedLocale = locale?.toLowerCase().startsWith('zh')
    ? 'zh'
    : locale?.toLowerCase().startsWith('es')
      ? 'es'
      : locale?.toLowerCase().startsWith('en')
        ? 'en'
        : null;
  const localized =
    SUBJECT_LOCALIZED_ALIASES[subject.key as keyof typeof SUBJECT_LOCALIZED_ALIASES];
  return dedupeAliases([
    subject.aliases,
    localized?.zh,
    localized?.es,
    normalizedLocale ? localized?.[normalizedLocale] : undefined,
  ]);
}

export function getComparisonAliases(comparison: ComparisonDefinition, locale?: string): string[] {
  const normalizedLocale = locale?.toLowerCase().startsWith('zh')
    ? 'zh'
    : locale?.toLowerCase().startsWith('es')
      ? 'es'
      : locale?.toLowerCase().startsWith('en')
        ? 'en'
        : null;
  const localized =
    COMPARISON_LOCALIZED_ALIASES[comparison.key as keyof typeof COMPARISON_LOCALIZED_ALIASES];
  return dedupeAliases([
    comparison.aliases,
    comparison.aliasesZh,
    localized?.zh,
    localized?.es,
    normalizedLocale ? localized?.[normalizedLocale] : undefined,
  ]);
}

export const COMPARISON_BY_SUBJECT_SET = new Map<string, (typeof COMPARISON_DEFINITIONS)[number]>(
  COMPARISON_DEFINITIONS.map((item) => [
    [item.primarySubjectKey, item.secondarySubjectKey].sort().join('::'),
    item,
  ] as const),
);

export const COMPARISON_BY_KEY = new Map<string, (typeof COMPARISON_DEFINITIONS)[number]>(
  COMPARISON_DEFINITIONS.map((item) => [item.key, item] as const),
);

export const LINKABLE_ASSET_KEYS = new Set<string>(
  Array.from(
    new Set(
      SUBJECT_DEFINITIONS.map((item) => item.assetKey).filter(Boolean),
    ),
  ),
);

export const CANONICAL_HEAD_DEFINITIONS: readonly CanonicalHeadDefinition[] = [
  ...SUBJECT_DEFINITIONS.map((item) => ({
    key: item.key,
    label: item.label,
    assetKey: item.assetKey,
    headType: 'subject' as const,
    publicSurface: item.publicSurface,
    priorityTier: item.priorityTier,
    seedEnabled: item.seedEnabled,
    defaultRunMode: item.defaultRunMode,
    defaultCadenceMinutes: item.defaultCadenceMinutes,
    priceContextSupport: item.priceContextSupport,
    defaultSeedQuery: item.defaultSeedQuery,
  })),
  ...COMPARISON_DEFINITIONS.map((item) => ({
    key: item.key,
    label: item.label,
    assetKey: item.primaryAssetKey,
    headType: 'comparison' as const,
    publicSurface: item.publicSurface,
    priorityTier: item.priorityTier,
    seedEnabled: item.seedEnabled,
    defaultRunMode: item.defaultRunMode,
    defaultCadenceMinutes: item.defaultCadenceMinutes,
    priceContextSupport: item.priceContextSupport,
    defaultSeedQuery: item.defaultSeedQuery,
  })),
];

export const CANONICAL_HEAD_BY_KEY = new Map<string, CanonicalHeadDefinition>(
  CANONICAL_HEAD_DEFINITIONS.map((item) => [item.key, item] as const),
);

export const CANONICAL_SUBJECT_BY_ASSET_KEY = new Map<string, CanonicalHeadDefinition>(
  SUBJECT_DEFINITIONS.map((item) => [
    item.assetKey,
    {
      key: item.key,
      label: item.label,
      assetKey: item.assetKey,
      headType: 'subject' as const,
      publicSurface: item.publicSurface,
      priorityTier: item.priorityTier,
      seedEnabled: item.seedEnabled,
      defaultRunMode: item.defaultRunMode,
      defaultCadenceMinutes: item.defaultCadenceMinutes,
      priceContextSupport: item.priceContextSupport,
      defaultSeedQuery: item.defaultSeedQuery,
    },
  ]),
);

function comparisonSubjectSetKey(subjectKeys: string[]) {
  return [...new Set(subjectKeys.filter(Boolean))].sort().join('::');
}

export function getComparisonByKey(key: string): ComparisonDefinition | null {
  const comparison = COMPARISON_BY_KEY.get(key);
  return comparison ? { ...comparison } : null;
}

export function getComparisonBySubjectSet(subjectKeys: string[]): ComparisonDefinition | null {
  const comparison = COMPARISON_BY_SUBJECT_SET.get(comparisonSubjectSetKey(subjectKeys));
  return comparison ? { ...comparison } : null;
}

export function getComparisonAssetKeys(comparison: ComparisonDefinition): string[] {
  const primary = comparison.primaryAssetKey;
  const secondary = SUBJECT_BY_KEY.get(comparison.secondarySubjectKey)?.assetKey || null;
  return Array.from(new Set([primary, secondary].filter(Boolean))) as string[];
}

export function listComparisonsForAssetKey(assetKey: string): ComparisonDefinition[] {
  return COMPARISON_DEFINITIONS
    .filter((comparison) => getComparisonAssetKeys(comparison).includes(assetKey))
    .map((comparison) => ({ ...comparison }));
}

export function listRelatedComparisons(comparisonKey: string): ComparisonDefinition[] {
  const comparison = getComparisonByKey(comparisonKey);
  if (!comparison) return [];
  const related: ComparisonDefinition[] = [];
  for (const key of comparison.relatedComparisonKeys) {
    const item = getComparisonByKey(key);
    if (item) related.push(item);
  }
  return related;
}

export function getCanonicalHeadByKey(key: string): CanonicalHeadDefinition | null {
  return CANONICAL_HEAD_BY_KEY.get(key) ?? null;
}

export function getCanonicalHeadByAssetKey(assetKey: string): CanonicalHeadDefinition | null {
  return CANONICAL_SUBJECT_BY_ASSET_KEY.get(assetKey) ?? null;
}

export function isPriorityCanonicalHeadKey(key: string): boolean {
  return CANONICAL_HEAD_BY_KEY.get(key)?.priorityTier === 'v1';
}

export function isSeededCanonicalHeadKey(key: string): boolean {
  return Boolean(CANONICAL_HEAD_BY_KEY.get(key)?.seedEnabled);
}

export function isPriorityAssetKey(assetKey: string): boolean {
  return CANONICAL_SUBJECT_BY_ASSET_KEY.get(assetKey)?.priorityTier === 'v1';
}

export function isSeededAssetKey(assetKey: string): boolean {
  return Boolean(CANONICAL_SUBJECT_BY_ASSET_KEY.get(assetKey)?.seedEnabled);
}

export function listSeededCanonicalHeads(): CanonicalHeadDefinition[] {
  return CANONICAL_HEAD_DEFINITIONS.filter((item) => item.seedEnabled).map((item) => ({ ...item }));
}
