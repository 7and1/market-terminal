import { beforeEach, describe, expect, it, vi } from 'vitest';

const completeMonitorRunError = vi.fn();
const touchMonitorLastRun = vi.fn();
const updateMonitorCheckpoint = vi.fn();
const markMonitorRunRunning = vi.fn();
const executeRun = vi.fn();

vi.mock('@/lib/db', () => ({
  claimDueMonitorRuns: vi.fn(),
  completeMonitorRunError,
  completeMonitorRunReady: vi.fn(),
  createManualMonitorRun: vi.fn(),
  getLatestReadyMonitorRun: vi.fn(),
  getMonitor: vi.fn(),
  getSession: vi.fn(),
  markMonitorAlertSent: vi.fn(),
  markMonitorRunRunning,
  patchMeta: vi.fn(),
  touchMonitorLastRun,
  updateMonitorCheckpoint,
}));

vi.mock('@/lib/run-pipeline/execute', () => ({
  executeRun,
}));

vi.mock('@/lib/log', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('executeClaimedMonitorRun', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    markMonitorRunRunning.mockResolvedValue(undefined);
    completeMonitorRunError.mockResolvedValue(undefined);
    touchMonitorLastRun.mockResolvedValue(undefined);
    updateMonitorCheckpoint.mockResolvedValue(undefined);
    executeRun.mockResolvedValue({
      ok: false,
      sessionId: 'sess-1',
      perfSummary: {
        status: 'error',
        generatedAt: Date.now(),
        totalMs: 10,
        stepDurationsMs: {},
        api: [],
        marksStored: 0,
      },
      error: 'provider down',
    });
  });

  it('advances monitor cadence when a claimed run ends in error', async () => {
    const { executeClaimedMonitorRun } = await import('@/lib/monitoring');

    await executeClaimedMonitorRun({
      claim: {
        monitor: {
          id: 'monitor-1',
          name: 'BTC monitor',
          topic: 'BTC',
          mode: 'deep',
          runIntent: 'monitor',
          cadenceMinutes: 60,
          active: true,
          notifyWebhookUrl: null,
          lastRunAt: null,
          lastReadySessionId: null,
          lastChangeScore: null,
          lastAlertAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        run: {
          id: 'run-1',
          monitorId: 'monitor-1',
          sessionId: null,
          baselineSessionId: null,
          status: 'queued',
          changeScore: null,
          significant: null,
          summary: {},
          error: null,
          startedAt: null,
          finishedAt: null,
          createdAt: new Date().toISOString(),
        },
      },
    });

    expect(markMonitorRunRunning).toHaveBeenCalledTimes(1);
    expect(completeMonitorRunError).toHaveBeenCalledWith('run-1', 'provider down');
    expect(touchMonitorLastRun).toHaveBeenCalledWith('monitor-1');
    expect(updateMonitorCheckpoint).not.toHaveBeenCalled();
  });
});
