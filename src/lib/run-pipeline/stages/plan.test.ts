import { beforeEach, describe, expect, it, vi } from 'vitest';

const aiMocks = vi.hoisted(() => ({
  chatJson: vi.fn(),
  getAIConfig: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({
  chatJson: aiMocks.chatJson,
  getAIConfig: aiMocks.getAIConfig,
}));

vi.mock('@/lib/env', () => ({
  env: {
    ai: {
      allowClientApiKeys: false,
      openrouter: {
        modelPlan: 'openrouter/test-plan',
      },
    },
  },
}));

describe('planQueries fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiMocks.getAIConfig.mockReturnValue(null);
  });

  it('does not add asset price catalyst queries for generic non-catalog topics', async () => {
    const { planQueries } = await import('@/lib/run-pipeline/stages/plan');

    const plan = await planQueries({ topic: 'AI healthcare regulation' });

    expect(plan.usedAI).toBe(false);
    expect(plan.queries.join('\n')).not.toMatch(/\b(price move|bitcoin|gold)\b/i);
    expect(plan.queries).toEqual([
      'What is the latest market impact for AI healthcare regulation today?',
      'AI healthcare regulation news today',
      'AI healthcare regulation latest developments',
      'AI healthcare regulation market impact analysis',
      'AI healthcare regulation policy regulation news',
      'AI healthcare regulation analyst investor reaction',
    ]);
  });

  it('keeps asset price catalyst coverage for catalog-recognized asset topics', async () => {
    const { planQueries } = await import('@/lib/run-pipeline/stages/plan');

    const plan = await planQueries({ topic: 'Tesla' });

    expect(plan.usedAI).toBe(false);
    expect(plan.queries).toContain('Tesla price move catalyst');
    expect(plan.queries.join('\n')).not.toMatch(/\b(bitcoin|gold)\b/i);
  });

  it('sets an explicit max token cap for AI planning', async () => {
    aiMocks.getAIConfig.mockReturnValue({
      apiKey: 'test-key',
      baseURL: 'https://openrouter.ai/api/v1',
      model: 'openrouter/test-plan',
    });
    aiMocks.chatJson.mockResolvedValue({
      queries: ['AI infrastructure stocks news'],
    });
    const { planQueries } = await import('@/lib/run-pipeline/stages/plan');

    const plan = await planQueries({ topic: 'AI infrastructure stocks' });

    expect(plan.usedAI).toBe(true);
    expect(aiMocks.chatJson).toHaveBeenCalledWith(expect.objectContaining({
      maxTokens: 1200,
      telemetry: expect.objectContaining({ tag: 'plan' }),
    }));
  });
});
