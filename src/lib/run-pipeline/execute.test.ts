import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EvidenceItem, RunRequest } from '@/lib/run-pipeline/contracts';
import { executeRun, type RunEvent } from '@/lib/run-pipeline/execute';

const mocks = vi.hoisted(() => ({
  hasBrightData: vi.fn(),
  hasDb: vi.fn(),
  createSession: vi.fn(),
  insertEvent: vi.fn(),
  materializeSessionEvidence: vi.fn(),
  updateStatus: vi.fn(),
  updateStep: vi.fn(),
  selectStageModel: vi.fn(),
  planQueries: vi.fn(),
  runSearchStage: vi.fn(),
  buildEvidenceHybrid: vi.fn(),
  summarizeEvidence: vi.fn(),
  buildArtifacts: vi.fn(),
  expandGraphImpact: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    pipeline: {
      minEvidenceForReady: 3,
      deepScrapeCount: 8,
      rawDocReuseHours: 6,
    },
  },
  hasBrightData: mocks.hasBrightData,
  hasDb: mocks.hasDb,
}));

vi.mock('@/lib/db', () => ({
  createSession: mocks.createSession,
  insertEvent: mocks.insertEvent,
  materializeSessionEvidence: mocks.materializeSessionEvidence,
  updateStatus: mocks.updateStatus,
  updateStep: mocks.updateStep,
}));

vi.mock('@/lib/modelRouting', () => ({
  selectStageModel: mocks.selectStageModel,
}));

vi.mock('@/lib/run-pipeline/stages/plan', () => ({
  planQueries: mocks.planQueries,
}));

vi.mock('@/lib/run-pipeline/stages/search', () => ({
  runSearchStage: mocks.runSearchStage,
}));

vi.mock('@/lib/run-pipeline/stages/evidence', () => ({
  buildEvidenceHybrid: mocks.buildEvidenceHybrid,
  summarizeEvidence: mocks.summarizeEvidence,
}));

vi.mock('@/lib/run-pipeline/stages/artifacts', () => ({
  buildArtifacts: mocks.buildArtifacts,
}));

vi.mock('@/lib/run-pipeline/stages/impact', () => ({
  expandGraphImpact: mocks.expandGraphImpact,
}));

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function makeEvidence(count = 3): EvidenceItem[] {
  const baseTime = Date.parse('2026-06-12T10:00:00.000Z');
  return Array.from({ length: count }, (_, idx) => ({
    id: `ev${idx + 1}`,
    title: `Evidence ${idx + 1}`,
    url: `https://source${idx + 1}.example.test/story`,
    source: `Source ${idx + 1}`,
    publishedAt: baseTime - idx * 60_000,
    observedAt: baseTime,
    timeKind: 'published',
    excerpt: `Evidence excerpt ${idx + 1}`,
    excerptSource: 'serp',
  }));
}

function eventNames(events: RunEvent[]) {
  return events.map((item) => item.event);
}

function stepProgress(events: RunEvent[]) {
  return events
    .filter((item) => item.event === 'step')
    .map((item) => (item.data as { progress: number }).progress);
}

function stepNames(events: RunEvent[]) {
  return events
    .filter((item) => item.event === 'step')
    .map((item) => (item.data as { step: string }).step);
}

async function runWithEvents(body: Partial<RunRequest> = {}) {
  const events: RunEvent[] = [];
  const result = await executeRun({
    body: {
      topic: 'AI infrastructure stocks',
      mode: 'fast',
      runReason: 'direct',
      runIntent: 'general',
      ...body,
    },
    signal: new AbortController().signal,
    log: logger,
    sessionId: `execute-test-${body.mode || 'fast'}`,
    startedAt: Date.parse('2026-06-12T10:00:00.000Z'),
    onEvent: (event) => {
      events.push(event);
    },
  });
  return { result, events };
}

describe('executeRun contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasBrightData.mockReturnValue(true);
    mocks.hasDb.mockReturnValue(false);
    mocks.selectStageModel.mockReturnValue(undefined);
    mocks.createSession.mockResolvedValue(undefined);
    mocks.insertEvent.mockResolvedValue(undefined);
    mocks.materializeSessionEvidence.mockResolvedValue(undefined);
    mocks.updateStatus.mockResolvedValue(undefined);
    mocks.updateStep.mockResolvedValue(undefined);
    mocks.planQueries.mockResolvedValue({
      queries: ['AI infrastructure stocks news', 'AI capex market impact'],
      usedAI: true,
    });
    mocks.runSearchStage.mockResolvedValue([
      { title: 'Result 1', url: 'https://source1.example.test/story', snippet: 'One' },
      { title: 'Result 2', url: 'https://source2.example.test/story', snippet: 'Two' },
      { title: 'Result 3', url: 'https://source3.example.test/story', snippet: 'Three' },
      { title: 'Result 4', url: 'https://source4.example.test/story', snippet: 'Four' },
    ]);
    mocks.buildEvidenceHybrid.mockResolvedValue(makeEvidence(3));
    mocks.summarizeEvidence.mockImplementation(async ({ evidence }: { evidence: EvidenceItem[] }) =>
      evidence.map((item) => ({
        ...item,
        aiSummary: {
          bullets: [`Summary for ${item.id}`],
          entities: ['AI infrastructure'],
          catalysts: ['capex'],
          sentiment: 'mixed',
          confidence: 0.7,
        },
      })),
    );
    mocks.buildArtifacts.mockResolvedValue({
      usedAI: true,
      tape: [
        {
          id: 't1',
          title: 'AI capex cycle',
          source: 'Source 1',
          publishedAt: Date.parse('2026-06-12T10:00:00.000Z'),
          tags: ['capex'],
          evidenceId: 'ev1',
        },
      ],
      nodes: [
        { id: 'asset', type: 'asset', label: 'AI infrastructure' },
        { id: 'event', type: 'event', label: 'Capex cycle' },
      ],
      edges: [
        {
          id: 'edge1',
          from: 'event',
          to: 'asset',
          type: 'mentions',
          confidence: 0.8,
          evidenceIds: ['ev1'],
          origin: 'ai',
        },
      ],
      clusters: [
        {
          id: 'cluster1',
          title: 'Capex cycle',
          summary: 'Evidence-backed capex narrative.',
          momentum: 'rising',
          evidenceIds: ['ev1', 'ev2'],
          related: ['AI infrastructure'],
        },
      ],
      assistantMessage: 'AI infrastructure reports show an evidence-backed capex cycle forming.',
    });
    mocks.expandGraphImpact.mockResolvedValue(null);
  });

  it('emits a stable fast-mode happy-path event contract', async () => {
    const { result, events } = await runWithEvents({ mode: 'fast' });
    const names = eventNames(events);

    expect(result.ok).toBe(true);
    expect(names).toEqual(expect.arrayContaining([
      'session',
      'diag',
      'step',
      'plan',
      'search',
      'evidence',
      'tape',
      'graph',
      'clusters',
      'message',
      'perf.summary',
      'done',
    ]));
    expect(names.indexOf('plan')).toBeLessThan(names.indexOf('search'));
    expect(names.indexOf('evidence')).toBeLessThan(names.indexOf('graph'));
    expect(names.indexOf('perf.summary')).toBeLessThan(names.indexOf('done'));
    expect(stepProgress(events)).toEqual([...stepProgress(events)].sort((a, b) => a - b));
    expect(stepNames(events)).toContain('ready');
    expect(result.readyMeta).toMatchObject({
      persisted: false,
      artifacts: {
        evidence: expect.any(Array),
        tape: expect.any(Array),
        nodes: expect.any(Array),
        edges: expect.any(Array),
        clusters: expect.any(Array),
        price: null,
        videos: null,
      },
      perf: {
        status: 'ready',
      },
    });
  });

  it('emits deep-mode scrape and summary events without changing ready shape', async () => {
    const { result, events } = await runWithEvents({ mode: 'deep' });
    const names = eventNames(events);

    expect(result.ok).toBe(true);
    expect(names).toContain('summaries');
    expect(names).toContain('clusters');
    expect(stepNames(events)).toContain('scrape');
    expect(stepNames(events)).toContain('ready');
    expect(stepProgress(events)).toEqual([...stepProgress(events)].sort((a, b) => a - b));
    expect(mocks.summarizeEvidence).toHaveBeenCalledTimes(1);
    expect(mocks.expandGraphImpact).toHaveBeenCalledTimes(1);
    expect(result.readyMeta).toMatchObject({
      persisted: false,
      artifacts: {
        evidence: expect.any(Array),
        tape: expect.any(Array),
        nodes: expect.any(Array),
        edges: expect.any(Array),
        clusters: expect.any(Array),
        price: null,
        videos: null,
      },
    });
  });

  it('terminates with error and no ready event when SERP returns no results', async () => {
    mocks.runSearchStage.mockResolvedValueOnce([]);

    const { result, events } = await runWithEvents({ mode: 'fast' });
    const names = eventNames(events);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/No SERP results collected/);
    expect(names).toContain('perf.summary');
    expect(names).toContain('error');
    expect(stepNames(events)).not.toContain('ready');
    expect(names).not.toContain('done');
    expect(names.indexOf('perf.summary')).toBeLessThan(names.indexOf('error'));
  });
});
