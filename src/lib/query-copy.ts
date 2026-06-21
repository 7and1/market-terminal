import type { Locale } from '@/i18n/routing';

const LANDING_EXAMPLES_BY_LOCALE: Record<Locale, readonly string[]> = {
  en: [
    'Why is NVDA moving after earnings today?',
    'BTC vs gold: which macro drivers matter more this week?',
    'How are yields and the dollar affecting tech right now?',
    'What policy catalysts are moving oil and energy equities?',
  ],
  es: [
    '¿Por qué se mueve NVDA después de resultados hoy?',
    'BTC vs oro: ¿qué drivers macro importan más esta semana?',
    '¿Cómo están afectando los rendimientos y el dólar a la tecnología ahora mismo?',
    '¿Qué catalizadores de política están moviendo el petróleo y las acciones de energía?',
  ],
  zh: [
    '为什么 NVDA 财报后在波动？',
    'BTC 对黄金：这周更关键的宏观驱动是什么？',
    '收益率和美元现在如何影响科技股？',
    '哪些政策催化剂正在推动原油和能源股？',
  ],
};

const TERMINAL_TYPED_EXAMPLES_BY_LOCALE: Record<Locale, readonly string[]> = {
  en: [
    'Why is BTC down today? Map catalysts in the last 6 hours.',
    'NVDA move after earnings: what are the strongest evidence links?',
    'Oil, DXY, and rates: what changed since market open?',
    'Gold vs Bitcoin today: which macro drivers explain the divergence?',
    'Which Fed, tariff, or policy headlines are moving semis right now?',
  ],
  es: [
    '¿Por qué cae BTC hoy? Mapea los catalizadores de las últimas 6 horas.',
    'Movimiento de NVDA tras resultados: ¿cuáles son los vínculos de evidencia más fuertes?',
    'Petróleo, DXY y rendimientos: ¿qué cambió desde la apertura?',
    'Oro vs Bitcoin hoy: ¿qué drivers macro explican la divergencia?',
    '¿Qué titulares de la Fed, aranceles o política están moviendo a los semis ahora mismo?',
  ],
  zh: [
    '为什么 BTC 今天下跌？把过去 6 小时的催化剂串起来。',
    'NVDA 财报后波动：最强的证据链接是什么？',
    '原油、DXY 和收益率：开盘后发生了什么变化？',
    '黄金对比比特币：哪些宏观驱动解释了今天的分化？',
    '哪些美联储、关税或政策新闻正在推动半导体？',
  ],
};

const TERMINAL_QUICK_STARTS_BY_LOCALE: Record<Locale, readonly string[]> = {
  en: ['NVDA after earnings', 'BTC drawdown today', 'Yields vs growth stocks', 'Fed spillover to gold'],
  es: ['NVDA tras resultados', 'Caída de BTC hoy', 'Rendimientos vs growth', 'Efecto Fed sobre el oro'],
  zh: ['NVDA 财报后', 'BTC 今日回撤', '收益率 vs 成长股', '美联储外溢到黄金'],
};

const MARKET_ONLY_EXAMPLES_BY_LOCALE: Record<Locale, readonly string[]> = {
  en: [
    'Why is BTC down today?',
    'What moved NVDA after earnings?',
    'How are yields affecting gold right now?',
    'Will tomorrow weather affect natural gas prices?',
  ],
  es: [
    '¿Por qué cae BTC hoy?',
    '¿Qué movió a NVDA después de resultados?',
    '¿Cómo están afectando los rendimientos al oro ahora mismo?',
    '¿El tiempo de mañana afectará al precio del gas natural?',
  ],
  zh: [
    '为什么 BTC 今天下跌？',
    '是什么推动了 NVDA 财报后的走势？',
    '收益率现在如何影响黄金？',
    '明天的天气会影响天然气价格吗？',
  ],
};

export function normalizeQueryLocale(locale?: string | null): Locale {
  const value = String(locale || '').toLowerCase();
  if (value.startsWith('zh')) return 'zh';
  if (value.startsWith('es')) return 'es';
  return 'en';
}

export function getLandingExamples(locale?: string | null): readonly string[] {
  return LANDING_EXAMPLES_BY_LOCALE[normalizeQueryLocale(locale)];
}

export function getTerminalTypedExamples(locale?: string | null): readonly string[] {
  return TERMINAL_TYPED_EXAMPLES_BY_LOCALE[normalizeQueryLocale(locale)];
}

export function getTerminalQuickStarts(locale?: string | null): readonly string[] {
  return TERMINAL_QUICK_STARTS_BY_LOCALE[normalizeQueryLocale(locale)];
}

export function getMarketOnlyExamples(locale?: string | null): readonly string[] {
  return MARKET_ONLY_EXAMPLES_BY_LOCALE[normalizeQueryLocale(locale)];
}
