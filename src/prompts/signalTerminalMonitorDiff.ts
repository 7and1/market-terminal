export function buildSignalTerminalMonitorDiffPrompt({
  topic,
  current,
  baseline,
}: {
  topic: string;
  current: unknown;
  baseline: unknown;
}): { system: string; user: string } {
  const system = [
    'You compare two evidence-grounded market monitor runs.',
    'Use only the provided JSON.',
    'Focus on what changed since the previous run, not on generic market commentary.',
    'Return strict JSON only.',
    'Keep the headline concrete and specific.',
    'Treat unchanged or weakly changed runs as low changeScore.',
  ].join('\n');

  const user = [
    `Topic: ${topic}`,
    '',
    'Current run (JSON):',
    JSON.stringify(current),
    '',
    'Previous run (JSON):',
    JSON.stringify(baseline),
    '',
    'Return JSON with this exact shape:',
    '{',
    '  "changeScore": number,',
    '  "headline": string,',
    '  "summary": string,',
    '  "sentimentShift": "improved" | "worsened" | "mixed" | "flat",',
    '  "newEvidence": [{ "title": string, "url": string, "source": string }],',
    '  "newCatalysts": string[]',
    '}',
    '',
    'Rules:',
    '- changeScore must be an integer from 0 to 100.',
    '- summary must be 2-4 sentences and mention only evidence-backed changes.',
    '- newEvidence must contain only evidence that is present in current but not previous, max 5.',
    '- newCatalysts must contain only catalysts newly present in current, max 5.',
    '- If little changed, use sentimentShift="flat" and a low changeScore.',
  ].join('\n');

  return { system, user };
}
