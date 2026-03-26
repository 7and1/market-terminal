import { z } from 'zod';

import { chatJson, getAIConfig } from '@/lib/ai';
import {
  claimDueMonitorRuns,
  completeMonitorRunError,
  completeMonitorRunReady,
  createManualMonitorRun,
  getLatestReadyMonitorRun,
  getMonitor,
  getSession,
  markMonitorAlertSent,
  markMonitorRunRunning,
  patchMeta,
  touchMonitorLastRun,
  updateMonitorCheckpoint,
  type ClaimedMonitorRun,
  type MonitorRow,
  type MonitorRunRow,
} from '@/lib/db';
import { createLogger } from '@/lib/log';
import { selectStageModel } from '@/lib/modelRouting';
import { type SessionArtifacts, type SessionMeta, asSessionMeta, evidenceItems, getArtifacts } from '@/lib/session-data';
import type { EvidenceItem } from '@/lib/types';
import { type RunRequest } from '@/lib/run-pipeline/contracts';
import { executeRun } from '@/lib/run-pipeline/execute';
import { buildSignalTerminalMonitorDiffPrompt } from '@/prompts/signalTerminalMonitorDiff';

type Logger = ReturnType<typeof createLogger>;

export type MonitorDiffSummary = {
  changeScore: number;
  headline: string;
  summary: string;
  sentimentShift: 'improved' | 'worsened' | 'mixed' | 'flat';
  newEvidence: Array<{ title: string; url: string; source: string }>;
  newCatalysts: string[];
  deliveryError?: string;
};

const MonitorDiffSchema = z.object({
  changeScore: z.number().int().min(0).max(100),
  headline: z.string().min(8).max(120),
  summary: z.string().min(20).max(420),
  sentimentShift: z.enum(['improved', 'worsened', 'mixed', 'flat']),
  newEvidence: z
    .array(
      z.object({
        title: z.string().min(3).max(240),
        url: z.string().url(),
        source: z.string().min(2).max(120),
      }),
    )
    .max(5),
  newCatalysts: z.array(z.string().min(2).max(80)).max(5),
});

function uniqueStrings(values: string[], limit: number) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

function collectCatalysts(items: EvidenceItem[]) {
  const catalysts = items.flatMap((item) => item.aiSummary?.catalysts || []);
  return uniqueStrings(catalysts, 24);
}

function aggregateSentiments(items: EvidenceItem[]) {
  let bullish = 0;
  let bearish = 0;
  let mixed = 0;
  let neutral = 0;
  for (const item of items) {
    const sentiment = item.aiSummary?.sentiment;
    if (sentiment === 'bullish') bullish += 1;
    else if (sentiment === 'bearish') bearish += 1;
    else if (sentiment === 'mixed') mixed += 1;
    else if (sentiment === 'neutral') neutral += 1;
  }
  return { bullish, bearish, mixed, neutral };
}

function summarizeArtifacts(meta: SessionMeta) {
  const artifacts: SessionArtifacts = getArtifacts(meta);
  const evidence = evidenceItems(artifacts.evidence);
  const evidenceByUrl = new Map(
    evidence
      .filter((item) => item.url)
      .map((item) => [item.url, { title: item.title, url: item.url, source: item.source }]),
  );

  return {
    counts: {
      evidence: evidence.length,
      tape: Array.isArray(artifacts.tape) ? artifacts.tape.length : 0,
      nodes: Array.isArray(artifacts.nodes) ? artifacts.nodes.length : 0,
      edges: Array.isArray(artifacts.edges) ? artifacts.edges.length : 0,
      clusters: Array.isArray(artifacts.clusters) ? artifacts.clusters.length : 0,
    },
    sentiments: aggregateSentiments(evidence),
    catalysts: collectCatalysts(evidence),
    evidence: Array.from(evidenceByUrl.values()).slice(0, 16),
  };
}

function fallbackMonitorDiff(topic: string, currentMeta: SessionMeta, baselineMeta: SessionMeta | null): MonitorDiffSummary {
  if (!baselineMeta) {
    return {
      changeScore: 0,
      headline: `Baseline established for ${topic}`,
      summary: 'This is the first successful monitor run. Future runs will be compared against this baseline.',
      sentimentShift: 'flat',
      newEvidence: [],
      newCatalysts: [],
    };
  }

  const current = summarizeArtifacts(currentMeta);
  const baseline = summarizeArtifacts(baselineMeta);
  const baselineUrls = new Set(baseline.evidence.map((item) => item.url));
  const newEvidence = current.evidence.filter((item) => !baselineUrls.has(item.url)).slice(0, 5);
  const baselineCatalysts = new Set(baseline.catalysts);
  const newCatalysts = current.catalysts.filter((item) => !baselineCatalysts.has(item)).slice(0, 5);

  const sentimentDelta =
    Math.abs(current.sentiments.bullish - baseline.sentiments.bullish) +
    Math.abs(current.sentiments.bearish - baseline.sentiments.bearish) +
    Math.abs(current.sentiments.mixed - baseline.sentiments.mixed);

  const countDelta =
    Math.abs(current.counts.evidence - baseline.counts.evidence) +
    Math.abs(current.counts.clusters - baseline.counts.clusters) +
    Math.abs(current.counts.edges - baseline.counts.edges);

  const changeScore = Math.min(100, newEvidence.length * 18 + newCatalysts.length * 12 + sentimentDelta * 8 + countDelta * 2);
  const currentBias = current.sentiments.bullish - current.sentiments.bearish;
  const baselineBias = baseline.sentiments.bullish - baseline.sentiments.bearish;
  const sentimentShift =
    Math.abs(currentBias - baselineBias) <= 1
      ? 'flat'
      : currentBias > baselineBias
        ? 'improved'
        : baselineBias > currentBias
          ? 'worsened'
          : 'mixed';

  const headline =
    changeScore >= 70
      ? `${topic} monitor shows a material evidence shift`
      : changeScore >= 35
        ? `${topic} monitor shows moderate change`
        : `${topic} monitor remains broadly stable`;

  const summary =
    changeScore >= 70
      ? `Several new evidence items or catalysts appeared since the previous run. The monitor should be treated as materially changed until the new narrative settles.`
      : changeScore >= 35
        ? `Some fresh evidence appeared since the previous run, but the overall picture is still partly consistent with the baseline. Watch the newest items for confirmation.`
        : `The latest run is close to the previous baseline. Changes are limited and do not materially alter the current evidence map.`;

  return {
    changeScore,
    headline,
    summary,
    sentimentShift,
    newEvidence,
    newCatalysts,
  };
}

async function buildMonitorDiffSummary({
  topic,
  currentMeta,
  baselineMeta,
}: {
  topic: string;
  currentMeta: SessionMeta;
  baselineMeta: SessionMeta | null;
}): Promise<MonitorDiffSummary> {
  if (!baselineMeta) return fallbackMonitorDiff(topic, currentMeta, null);

  const model = selectStageModel({ stage: 'chat', mode: currentMeta.mode === 'fast' ? 'fast' : 'deep' });
  const config = getAIConfig({ modelOverride: model });
  if (!config) return fallbackMonitorDiff(topic, currentMeta, baselineMeta);

  const prompt = buildSignalTerminalMonitorDiffPrompt({
    topic,
    current: summarizeArtifacts(currentMeta),
    baseline: summarizeArtifacts(baselineMeta),
  });

  try {
    return await chatJson({
      config,
      schema: MonitorDiffSchema,
      system: prompt.system,
      user: prompt.user,
      temperature: 0.1,
    });
  } catch {
    return fallbackMonitorDiff(topic, currentMeta, baselineMeta);
  }
}

async function deliverMonitorWebhook({
  monitor,
  sessionId,
  reportUrl,
  summary,
}: {
  monitor: MonitorRow;
  sessionId: string;
  reportUrl: string | null;
  summary: MonitorDiffSummary;
}): Promise<string | null> {
  if (!monitor.notifyWebhookUrl || !summary.changeScore || summary.changeScore < 70) return null;

  const payload = {
    monitorId: monitor.id,
    monitorName: monitor.name,
    topic: monitor.topic,
    runIntent: monitor.runIntent,
    sessionId,
    reportUrl,
    changeScore: summary.changeScore,
    significant: true,
    headline: summary.headline,
    summary: summary.summary,
    newEvidence: summary.newEvidence,
    newCatalysts: summary.newCatalysts,
    sentAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(monitor.notifyWebhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return `Webhook failed (${response.status})${text ? `: ${text.slice(0, 160)}` : ''}`;
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function buildRunRequest(monitor: MonitorRow, monitorRunId: string): RunRequest {
  return {
    topic: monitor.topic,
    mode: monitor.mode,
    runIntent: 'monitor',
    monitorId: monitor.id,
    monitorRunId,
  };
}

export async function executeClaimedMonitorRun({
  claim,
  log,
}: {
  claim: ClaimedMonitorRun;
  log?: Logger;
}): Promise<void> {
  const logger = log || createLogger({ reqId: crypto.randomUUID(), route: '/monitor-runner' });
  const sessionId = crypto.randomUUID();
  const signal = new AbortController().signal;

  await markMonitorRunRunning(claim.run.id, sessionId);

  const result = await executeRun({
    body: buildRunRequest(claim.monitor, claim.run.id),
    signal,
    log: logger,
    sessionId,
    initialMeta: {
      runIntent: 'monitor',
      monitorId: claim.monitor.id,
      monitorRunId: claim.run.id,
    },
  });

  if (!result.ok) {
    await completeMonitorRunError(claim.run.id, result.error || 'Monitor run failed');
    await touchMonitorLastRun(claim.monitor.id);
    return;
  }

  const currentSession = await getSession(result.sessionId);
  const previousReadyRun = await getLatestReadyMonitorRun(claim.monitor.id, claim.run.id);
  const baselineSessionId = previousReadyRun?.sessionId || null;
  const baselineSession = baselineSessionId ? await getSession(baselineSessionId) : null;

  const currentMeta = asSessionMeta(currentSession?.meta);
  const baselineMeta = baselineSession ? asSessionMeta(baselineSession.meta) : null;
  const summary = await buildMonitorDiffSummary({
    topic: claim.monitor.topic,
    currentMeta,
    baselineMeta,
  });

  const finalSummary: MonitorDiffSummary = {
    ...summary,
    changeScore: baselineSessionId ? summary.changeScore : 0,
  };
  const significant = baselineSessionId ? finalSummary.changeScore >= 70 : false;

  const reportUrl = currentSession?.slug ? `/report/${currentSession.slug}` : null;
  const deliveryError = significant
    ? await deliverMonitorWebhook({
        monitor: claim.monitor,
        sessionId: result.sessionId,
        reportUrl,
        summary: finalSummary,
      })
    : null;
  if (deliveryError) {
    finalSummary.deliveryError = deliveryError;
  }

  await patchMeta(result.sessionId, {
    baselineSessionId,
    monitorDiff: {
      changeScore: finalSummary.changeScore,
      significant,
      headline: finalSummary.headline,
      summary: finalSummary.summary,
      sentimentShift: finalSummary.sentimentShift,
      newEvidence: finalSummary.newEvidence,
      newCatalysts: finalSummary.newCatalysts,
      ...(deliveryError ? { deliveryError } : {}),
    },
  });

  await completeMonitorRunReady({
    runId: claim.run.id,
    baselineSessionId,
    changeScore: finalSummary.changeScore,
    significant,
    summary: {
      headline: finalSummary.headline,
      summary: finalSummary.summary,
      sentimentShift: finalSummary.sentimentShift,
      newEvidence: finalSummary.newEvidence,
      newCatalysts: finalSummary.newCatalysts,
      ...(deliveryError ? { deliveryError } : {}),
    },
  });
  await updateMonitorCheckpoint({
    monitorId: claim.monitor.id,
    lastReadySessionId: result.sessionId,
    lastChangeScore: finalSummary.changeScore,
  });
  if (significant && !deliveryError) {
    await markMonitorAlertSent(claim.monitor.id);
  }
}

export async function dispatchDueMonitors(limit = 2): Promise<{ claimed: number }> {
  const logger = createLogger({ reqId: crypto.randomUUID(), route: '/monitor-dispatch' });
  const claims = await claimDueMonitorRuns(limit);
  await Promise.all(
    claims.map((claim) =>
      executeClaimedMonitorRun({ claim, log: logger }).catch((error) => {
        logger.error('monitor.dispatch.failed', {
          monitorId: claim.monitor.id,
          runId: claim.run.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }),
    ),
  );
  return { claimed: claims.length };
}

export async function triggerMonitorRun(monitorId: string): Promise<{ status: 'queued' | 'conflict' | 'not_found'; run: MonitorRunRow | null; monitor: MonitorRow | null }> {
  const monitor = await getMonitor(monitorId);
  if (!monitor) {
    return { status: 'not_found', run: null, monitor: null };
  }

  const run = await createManualMonitorRun(monitorId);
  if (!run) {
    return { status: 'conflict', run: null, monitor };
  }

  const logger = createLogger({ reqId: crypto.randomUUID(), route: '/api/monitors/:id/run' });
  void executeClaimedMonitorRun({ claim: { monitor, run }, log: logger }).catch((error) => {
    logger.error('monitor.manual.failed', {
      monitorId,
      runId: run.id,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return { status: 'queued', run, monitor };
}
