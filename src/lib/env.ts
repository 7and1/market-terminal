function envString(name: string, fallback = ''): string {
  const v = process.env[name];
  return typeof v === 'string' ? v : fallback;
}

// Round-robin key rotation for comma-separated key lists
let _keyIndex = 0;
function rotateKey(envName: string): string {
  const raw = envString(envName);
  if (!raw) return '';
  const keys = raw.split(',').map((k) => k.trim()).filter(Boolean);
  if (keys.length <= 1) return raw;
  const key = keys[_keyIndex % keys.length];
  _keyIndex++;
  return key;
}

function envBool(name: string, fallback = false): boolean {
  const v = envString(name);
  if (!v) return fallback;
  return v.toLowerCase() === 'true' || v === '1' || v.toLowerCase() === 'yes';
}

function envInt(name: string, fallback: number): number {
  const raw = envString(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envList(name: string, fallback = ''): string[] {
  const raw = envString(name, fallback);
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  features: {
    queryResolution: envBool('ENABLE_QUERY_RESOLUTION', true),
    queryResolutionTieBreaker: envBool('ENABLE_QUERY_RESOLUTION_TIEBREAKER', false),
  },
  pipeline: {
    minEvidenceForReady: envInt('MIN_EVIDENCE_FOR_READY', 3),
    rawDocReuseHours: envInt('RAW_DOC_REUSE_HOURS', 6),
    deepScrapeCount: envInt('DEEP_SCRAPE_COUNT', 8),
  },
  budget: {
    dailyBrightDataCallLimit: envInt('DAILY_BRIGHTDATA_CALL_LIMIT', 2000),
    dailyOpenRouterCallLimit: envInt('DAILY_OPENROUTER_CALL_LIMIT', 1500),
  },
  rateLimit: {
    backend: envString('RATE_LIMIT_BACKEND', 'pg'),
  },
  email: {
    resendApiKey: envString('RESEND_API_KEY'),
    from: envString('EMAIL_FROM', 'TrendAnalysis.ai <alerts@trendanalysis.ai>'),
    replyTo: envString('EMAIL_REPLY_TO'),
  },
  brightdata: {
    token: envString('BRIGHTDATA_API_TOKEN') || envString('API_TOKEN'),
    zone:
      envString('BRIGHTDATA_WEB_UNLOCKER_ZONE') ||
      envString('BRIGHTDATA_UNLOCKER_ZONE') ||
      envString('WEB_UNLOCKER_ZONE') ||
      'mcp_unlocker',
    serpZone:
      envString('BRIGHTDATA_SERP_ZONE') ||
      envString('BRIGHTDATA_SERP_ZONE_NAME') ||
      '',
    browserAuth: envString('BRIGHTDATA_BROWSER_AUTH') || envString('BROWSER_AUTH'),
  },
  ai: {
    allowClientApiKeys: envBool('ALLOW_CLIENT_API_KEYS', false),
    openrouter: {
      get apiKey() { return rotateKey('OPENROUTER_API_KEY'); },
      baseURL: envString('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
      model: envString('OPENROUTER_MODEL', 'deepseek/deepseek-chat-v3.1'),
      modelFallbacks: envList(
        'OPENROUTER_MODEL_FALLBACKS',
        'deepseek/deepseek-chat-v3.1,mistralai/mistral-small-3.2-24b-instruct',
      ),
      modelFast: envString('OPENROUTER_MODEL_FAST', ''),
      modelDeep: envString('OPENROUTER_MODEL_DEEP', ''),
      modelPlan: envString('OPENROUTER_MODEL_PLAN', ''),
      modelPlanFast: envString('OPENROUTER_MODEL_PLAN_FAST', ''),
      modelPlanDeep: envString('OPENROUTER_MODEL_PLAN_DEEP', ''),
      modelArtifacts: envString('OPENROUTER_MODEL_ARTIFACTS', ''),
      modelArtifactsFast: envString('OPENROUTER_MODEL_ARTIFACTS_FAST', ''),
      modelArtifactsDeep: envString('OPENROUTER_MODEL_ARTIFACTS_DEEP', ''),
      modelChat: envString('OPENROUTER_MODEL_CHAT', ''),
      modelChatFast: envString('OPENROUTER_MODEL_CHAT_FAST', ''),
      modelChatDeep: envString('OPENROUTER_MODEL_CHAT_DEEP', ''),
      modelSummaries: envString('OPENROUTER_MODEL_SUMMARIES', ''),
      modelSummariesFast: envString('OPENROUTER_MODEL_SUMMARIES_FAST', ''),
      modelSummariesDeep: envString('OPENROUTER_MODEL_SUMMARIES_DEEP', ''),
    },
  },
};

export function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

export function hasBrightData() {
  return Boolean(env.brightdata.token && env.brightdata.zone);
}

export function brightDataSerpZone() {
  return env.brightdata.serpZone || env.brightdata.zone;
}
