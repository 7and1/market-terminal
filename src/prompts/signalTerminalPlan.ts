export function buildSignalTerminalPlanPrompt({
  topic,
  question,
}: {
  topic: string;
  question?: string;
}): { system: string; user: string } {
  const system = [
    'You are a market research planner for active traders.',
    'Goal: produce high-signal search queries to explain the current move and its most likely drivers.',
    'The topic must stay inside market research: assets, sectors, macro themes, policy, or market-moving events.',
    'Return strict JSON only.',
  ].join('\n');

  const user = [
    `Topic: ${topic}`,
    `Question: ${question || 'What is moving this topic right now? What are the strongest channels?'}`,
    '',
    'Output JSON: { "queries": string[3..10], "angles"?: string[] }',
    'Rules:',
    '- Strongly bias to recency: include "today", "last 24h", "since market open", or similar.',
    '- Avoid evergreen results: do not ask for generic "what is X" queries.',
    '- Keep queries short, specific, and verification-friendly.',
    '',
    'Pick the most relevant 4-6 lenses (do not force irrelevant ones):',
    '1) Direct catalyst / headlines',
    '2) Macro: rates/yields/inflation + USD regime',
    '3) Cross-asset: related assets/sectors/benchmarks',
    '4) Policy/regulation: agency/government actions',
    '5) Geopolitics/supply shocks (if relevant)',
    '6) Flows/positioning: ETF/funds/options/futures/liquidations (if relevant)',
    '',
    'Topic-specific guidance:',
    '- If topic is crypto: include ETF flows, stablecoins, onchain/liquidations, and spillovers to equities/miners.',
    '- If topic is a stock: include earnings/guidance, sector peers, and any policy/export-control risks.',
    '- If topic is a commodity: include inventories, production policy (OPEC), and geopolitics.',
    '- If topic is macro/index/rates/FX: include policy path, curve/risk regime, and cross-market transmission.',
    '',
    'Example query styles (examples only, adapt to topic):',
    '- "what moved <topic> today headline catalyst"',
    '- "<topic> reaction to yields and dollar in last 24h"',
    '- "<topic> policy or regulatory headlines today"',
    '- "<topic> spillover to peers/sector/index risk sentiment"',
    '- "<topic> flows and positioning data today"',
    '',
    'Output shape:',
    '- Prefer 6-10 queries when possible.',
    '- Include at least 1 query for direct catalyst confirmation.',
    '- Include at least 1 query for macro regime linkage (rates/yields/USD or equivalent).',
    '- Include at least 1 query for spillovers/second-order impacts ("spillover", "knock-on", "risk-on/risk-off").',
    '- Include at least 1 query prefixed with "latest news" or "breaking" to capture recent news developments (e.g., "latest news <topic> today").',
  ].join('\n');

  return { system, user };
}
