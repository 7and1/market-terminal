import { getMarketOnlyExamples, normalizeQueryLocale } from '@/lib/query-copy';

const MARKET_TERMS = [
  'market',
  'markets',
  'stock',
  'stocks',
  'equity',
  'equities',
  'share',
  'shares',
  'price',
  'prices',
  'trading',
  'trade',
  'trader',
  'investor',
  'investing',
  'earnings',
  'guidance',
  'revenue',
  'valuation',
  'etf',
  'etfs',
  'futures',
  'options',
  'bond',
  'bonds',
  'yield',
  'yields',
  'treasury',
  'treasuries',
  'rates',
  'inflation',
  'cpi',
  'ppi',
  'payrolls',
  'fed',
  'fomc',
  'ecb',
  'boj',
  'macro',
  'dollar',
  'usd',
  'dxy',
  'nasdaq',
  's&p',
  'spy',
  'qqq',
  'dow',
  'gold',
  'silver',
  'oil',
  'crude',
  'gas',
  'natural gas',
  'copper',
  'commodity',
  'commodities',
  'bitcoin',
  'btc',
  'ethereum',
  'eth',
  'solana',
  'sol',
  'crypto',
  'cryptocurrency',
  'altcoin',
  'nvda',
  'aapl',
  'msft',
  'tsla',
  'meta',
  'amzn',
  'goog',
  'google',
  'apple',
  'nvidia',
  'tesla',
  'microsoft',
  'amazon',
  'sector',
  'sectors',
  'risk-on',
  'risk off',
  'risk-off',
  'liquidation',
  'liquidations',
  'flow',
  'flows',
  'catalyst',
  'catalysts',
  'policy',
  'regulation',
  'tariff',
  'export control',
  'guidance',
] as const;

const OFF_DOMAIN_PATTERNS: Array<{ reason: OffDomainReason; test: RegExp }> = [
  {
    reason: 'weather',
    test: /\b(weather|forecast|temperature|rain|snow|umbrella|humidity|storm|typhoon|sunny|cloudy)\b|天气|气温|下雨|下雪|台风|暴雨|晴天|阴天/i,
  },
  {
    reason: 'travel',
    test: /\b(hotel|flight|airfare|airport|visa|itinerary|vacation|trip|travel guide)\b|酒店|航班|机票|机场|签证|行程|旅游|旅行/i,
  },
  {
    reason: 'food',
    test: /\b(recipe|cook|cooking|restaurant|menu|dinner|lunch|breakfast|calories)\b|菜谱|做饭|餐厅|菜单|晚饭|午饭|早餐|热量/i,
  },
  {
    reason: 'translation',
    test: /\b(translate|translation|grammar|spell check|rewrite this|proofread)\b|翻译|语法|润色|改写|校对/i,
  },
  {
    reason: 'general_knowledge',
    test: /\b(capital of|population of|who is|where is|when did|define|meaning of|history of)\b|首都|人口|谁是|哪里|什么时候|定义|意思|历史/i,
  },
  {
    reason: 'personal_assistant',
    test: /\b(remind me|set a reminder|write an email|draft an email|tell me a joke|bedtime story|homework)\b|提醒我|写邮件|草拟邮件|讲个笑话|睡前故事|作业/i,
  },
] as const;

export type OffDomainReason =
  | 'weather'
  | 'travel'
  | 'food'
  | 'translation'
  | 'general_knowledge'
  | 'personal_assistant';

export type QueryScopeAssessment =
  | {
      ok: true;
      scope: 'market';
    }
  | {
      ok: false;
      scope: 'off_domain';
      reason: OffDomainReason;
      message: string;
      supportedExamples: readonly string[];
    };

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s&+-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text: string, terms: readonly string[]) {
  return terms.some((term) => text.includes(term));
}

function offDomainMessage(reason: OffDomainReason, locale?: string) {
  const normalizedLocale = normalizeQueryLocale(locale);

  if (normalizedLocale === 'zh') {
    switch (reason) {
      case 'weather':
        return '这个工作区用于市场研究，不提供独立天气预报。请改成询问天气对某个资产、商品或板块的影响。';
      case 'travel':
        return '这个工作区用于市场研究，不提供旅行规划。请把问题改成围绕某个资产、公司、板块或宏观主题。';
      case 'food':
        return '这个工作区用于市场研究，不提供餐饮或菜谱问答。请改问会影响市场的话题。';
      case 'translation':
        return '这个工作区用于市场研究，不提供翻译或写作润色。请改问聚焦市场的研究问题。';
      case 'personal_assistant':
        return '这个工作区用于市场研究，不处理个人助理类任务。请改问资产、板块、宏观主题或会影响市场的事件。';
      case 'general_knowledge':
      default:
        return '这个工作区用于市场研究，不提供通用知识查询。请改问资产、板块、宏观主题、政策变化或会影响市场的事件。';
    }
  }

  if (normalizedLocale === 'es') {
    switch (reason) {
      case 'weather':
        return 'Este espacio es para investigación de mercado, no para pronósticos meteorológicos aislados. Pregunta por el impacto del clima sobre un activo, commodity o sector.';
      case 'travel':
        return 'Este espacio es para investigación de mercado, no para planificar viajes. Reformula la consulta alrededor de un activo, empresa, sector o tema macro.';
      case 'food':
        return 'Este espacio es para investigación de mercado, no para preguntas de comida o restaurantes. Pregunta por un tema que mueva el mercado.';
      case 'translation':
        return 'Este espacio es para investigación de mercado, no para traducción o ayuda de redacción. Haz una pregunta enfocada en mercado.';
      case 'personal_assistant':
        return 'Este espacio es para investigación de mercado, no para tareas de asistente personal. Pregunta por un activo, sector, tema macro o evento que mueva el mercado.';
      case 'general_knowledge':
      default:
        return 'Este espacio es para investigación de mercado, no para consultas generales. Pregunta por un activo, sector, tema macro, cambio de política o evento que mueva el mercado.';
    }
  }

  switch (reason) {
    case 'weather':
      return 'This workspace is for market research, not standalone weather forecasts. Ask about a weather impact on an asset, commodity, or sector instead.';
    case 'travel':
      return 'This workspace is for market research, not travel planning. Reframe the query around an asset, company, sector, or macro theme.';
    case 'food':
      return 'This workspace is for market research, not food or restaurant questions. Ask about a market-moving topic instead.';
    case 'translation':
      return 'This workspace is for market research, not translation or writing assistance. Ask a market-focused research question instead.';
    case 'personal_assistant':
      return 'This workspace is for market research, not personal-assistant tasks. Ask about an asset, sector, macro theme, or market-moving event instead.';
    case 'general_knowledge':
    default:
      return 'This workspace is for market research, not general knowledge lookup. Ask about an asset, sector, macro theme, policy shift, or market-moving event instead.';
  }
}

export function assessMarketQueryScope({
  topic,
  question,
  locale,
}: {
  topic: string;
  question?: string;
  locale?: string;
}): QueryScopeAssessment {
  const haystack = normalize(`${topic} ${question || ''}`);
  const supportedExamples = getMarketOnlyExamples(locale);
  if (!haystack) {
    return {
      ok: false,
      scope: 'off_domain',
      reason: 'general_knowledge',
      message: offDomainMessage('general_knowledge', locale),
      supportedExamples,
    };
  }

  const hasMarketSignals = includesAny(haystack, MARKET_TERMS);
  if (hasMarketSignals) {
    return { ok: true, scope: 'market' };
  }

  for (const pattern of OFF_DOMAIN_PATTERNS) {
    if (pattern.test.test(haystack)) {
      return {
        ok: false,
        scope: 'off_domain',
        reason: pattern.reason,
        message: offDomainMessage(pattern.reason, locale),
        supportedExamples,
      };
    }
  }

  return { ok: true, scope: 'market' };
}
