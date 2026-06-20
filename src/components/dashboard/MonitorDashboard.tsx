'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bell, Clock3, KeyRound, Pencil, Plus, RefreshCw, Save, Siren, Zap } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { apiPath, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { OPERATOR_TOKEN_STORAGE_KEY, buildOperatorHeaders } from '@/components/dashboard/operator-auth-client';

type MonitorSummary = {
  id: string;
  name: string;
  topic: string;
  mode: 'fast' | 'deep';
  runIntent: 'general' | 'monitor';
  cadenceMinutes: 15 | 60 | 360 | 1440;
  active: boolean;
  notifyWebhookUrl: string | null;
  hasNotifyWebhook: boolean;
  lastRunAt: string | null;
  lastReadySessionId: string | null;
  lastChangeScore: number | null;
  lastAlertAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type MonitorRun = {
  id: string;
  monitorId: string;
  sessionId: string | null;
  baselineSessionId: string | null;
  status: 'queued' | 'running' | 'ready' | 'error' | 'noop';
  changeScore: number | null;
  significant: boolean | null;
  summary: {
    headline?: string;
    summary?: string;
    sentimentShift?: string;
    newEvidence?: Array<{ title: string; url: string; source: string }>;
    newCatalysts?: string[];
    deliveryError?: string;
  };
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

const CADENCE_OPTIONS = [
  { value: '15', label: '15m' },
  { value: '60', label: '1h' },
  { value: '360', label: '6h' },
  { value: '1440', label: '24h' },
] as const;
function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}

function scoreTone(value: number | null) {
  if (value == null) return 'neutral';
  if (value >= 70) return 'orange';
  if (value >= 35) return 'blue';
  return 'teal';
}

export function MonitorDashboard() {
  const [operatorToken, setOperatorToken] = useState('');
  const [operatorInput, setOperatorInput] = useState('');
  const [monitors, setMonitors] = useState<MonitorSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<MonitorRun[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<'fast' | 'deep'>('deep');
  const [cadenceMinutes, setCadenceMinutes] = useState<'15' | '60' | '360' | '1440'>('60');
  const [notifyWebhookUrl, setNotifyWebhookUrl] = useState('');
  const operatorAuthorized = operatorToken.trim().length > 0;

  const selectedMonitor = useMemo(
    () => monitors.find((monitor) => monitor.id === selectedId) || null,
    [monitors, selectedId],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.sessionStorage.getItem(OPERATOR_TOKEN_STORAGE_KEY) || '';
    if (!saved) return;
    setOperatorToken(saved);
    setOperatorInput(saved);
  }, []);

  const persistOperatorToken = useCallback((nextToken: string) => {
    setOperatorToken(nextToken);
    setOperatorInput(nextToken);
    if (typeof window === 'undefined') return;
    if (nextToken) {
      window.sessionStorage.setItem(OPERATOR_TOKEN_STORAGE_KEY, nextToken);
      return;
    }
    window.sessionStorage.removeItem(OPERATOR_TOKEN_STORAGE_KEY);
  }, []);

  const resetForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    setName('');
    setTopic('');
    setMode('deep');
    setCadenceMinutes('60');
    setNotifyWebhookUrl('');
  }, []);

  const openCreateForm = useCallback(() => {
    resetForm();
    setFormOpen(true);
  }, [resetForm]);

  const populateForm = useCallback((monitor: MonitorSummary | null) => {
    if (!monitor) return;
    setFormOpen(true);
    setEditingId(monitor.id);
    setName(monitor.name);
    setTopic(monitor.topic);
    setMode(monitor.mode);
    setCadenceMinutes(String(monitor.cadenceMinutes) as '15' | '60' | '360' | '1440');
    setNotifyWebhookUrl('');
  }, []);

  const fetchMonitors = useCallback(async () => {
    if (!operatorAuthorized) {
      setMonitors([]);
      setRuns([]);
      setSelectedId(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiPath('/api/monitors'), {
        cache: 'no-store',
        headers: buildOperatorHeaders(operatorToken),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Failed to load monitors');
      const items = (json?.monitors || []) as MonitorSummary[];
      setMonitors(items);
      setSelectedId((current) => current || items[0]?.id || null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load monitors');
    } finally {
      setLoading(false);
    }
  }, [operatorAuthorized, operatorToken]);

  const fetchRuns = useCallback(async (monitorId: string) => {
    if (!operatorAuthorized) {
      setRuns([]);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetch(apiPath(`/api/monitors/${monitorId}/runs?limit=12`), {
        cache: 'no-store',
        headers: buildOperatorHeaders(operatorToken),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Failed to load monitor runs');
      setRuns((json?.runs || []) as MonitorRun[]);
    } catch (fetchError) {
      setDetailError(fetchError instanceof Error ? fetchError.message : 'Failed to load monitor runs');
      setRuns([]);
    } finally {
      setDetailLoading(false);
    }
  }, [operatorAuthorized, operatorToken]);

  useEffect(() => {
    if (!operatorAuthorized) return;
    void fetchMonitors();
  }, [fetchMonitors, operatorAuthorized]);

  useEffect(() => {
    if (!operatorAuthorized) return;
    if (!selectedId) return;
    void fetchRuns(selectedId);
  }, [fetchRuns, operatorAuthorized, selectedId]);

  const saveMonitor = useCallback(async () => {
    if (!operatorAuthorized) {
      setError('Operator token required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const trimmedWebhookUrl = notifyWebhookUrl.trim();
      const payload: {
        name: string;
        topic: string;
        mode: 'fast' | 'deep';
        cadenceMinutes: number;
        notifyWebhookUrl?: string | null;
      } = {
        name: name.trim(),
        topic: topic.trim(),
        mode,
        cadenceMinutes: Number(cadenceMinutes),
      };
      if (editingId) {
        if (trimmedWebhookUrl) payload.notifyWebhookUrl = trimmedWebhookUrl;
      } else {
        payload.notifyWebhookUrl = trimmedWebhookUrl || null;
      }
      const url = editingId ? apiPath(`/api/monitors/${editingId}`) : apiPath('/api/monitors');
      const response = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: buildOperatorHeaders(operatorToken, 'application/json'),
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Failed to save monitor');
      await fetchMonitors();
      const nextId = (json?.monitor?.id as string | undefined) || editingId;
      if (nextId) setSelectedId(nextId);
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save monitor');
    } finally {
      setSubmitting(false);
    }
  }, [cadenceMinutes, editingId, fetchMonitors, mode, name, notifyWebhookUrl, operatorAuthorized, operatorToken, resetForm, topic]);

  const toggleActive = useCallback(async () => {
    if (!selectedMonitor) return;
    if (!operatorAuthorized) {
      setError('Operator token required');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(apiPath(`/api/monitors/${selectedMonitor.id}`), {
        method: 'PATCH',
        headers: buildOperatorHeaders(operatorToken, 'application/json'),
        body: JSON.stringify({ active: !selectedMonitor.active }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Failed to update monitor');
      await fetchMonitors();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Failed to update monitor');
    } finally {
      setSubmitting(false);
    }
  }, [fetchMonitors, operatorAuthorized, operatorToken, selectedMonitor]);

  const runMonitor = useCallback(async () => {
    if (!selectedMonitor) return;
    if (!operatorAuthorized) {
      setError('Operator token required');
      return;
    }
    setRunningNow(true);
    setError(null);
    try {
      const response = await fetch(apiPath(`/api/monitors/${selectedMonitor.id}/run`), {
        method: 'POST',
        headers: buildOperatorHeaders(operatorToken),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Failed to queue monitor run');
      await fetchRuns(selectedMonitor.id);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Failed to queue monitor run');
    } finally {
      setRunningNow(false);
    }
  }, [fetchRuns, operatorAuthorized, operatorToken, selectedMonitor]);

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-white/50" />
              <CardTitle>Monitors</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void fetchMonitors()} disabled={loading || !operatorAuthorized}>
                <RefreshCw className={cn('h-4 w-4', loading ? 'animate-spin' : '')} />
                Refresh
              </Button>
              <Button size="sm" onClick={openCreateForm} disabled={!operatorAuthorized}>
                <Plus className="h-4 w-4" />
                New monitor
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Card className="mb-3 border-white/[0.08] bg-white/[0.03] p-3">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-4 w-4 text-white/55" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white/84">Operator token required</div>
                  <p className="mt-1 text-xs leading-relaxed text-white/50">
                    Monitor creation, scheduling, run dispatch, and history are operator-only control-plane actions.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={operatorInput}
                  onChange={(event) => setOperatorInput(event.target.value)}
                  type="password"
                  placeholder="Paste operator token"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    persistOperatorToken(operatorInput.trim());
                    setError(null);
                    setDetailError(null);
                  }}
                  disabled={!operatorInput.trim()}
                >
                  Save token
                </Button>
                {operatorAuthorized ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      persistOperatorToken('');
                      setMonitors([]);
                      setRuns([]);
                      setSelectedId(null);
                      setError(null);
                      setDetailError(null);
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </Card>
            {error && (
              <Card className="mb-3 border-orange/25 bg-orange/[0.06] p-3 text-sm text-white/70">{error}</Card>
            )}
            {!operatorAuthorized ? (
              <EmptyState
                icon={<KeyRound className="h-8 w-8" />}
                title="Monitor control plane locked"
                description="Add a valid operator token to load monitor inventory, run history, and scheduling controls."
              />
            ) : !monitors.length && !loading ? (
              <EmptyState
                icon={<Bell className="h-8 w-8" />}
                title="No monitors yet"
                description="Create a monitor to rerun topics on a schedule and compare against the last successful run."
              />
            ) : (
              <ScrollArea className="max-h-[72vh]">
                <div className="space-y-2 pr-2">
                  {loading && !monitors.length ? (
                    <>
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </>
                  ) : null}
                  {monitors.map((monitor) => (
                    <button
                      key={monitor.id}
                      type="button"
                      onClick={() => setSelectedId(monitor.id)}
                      className={cn(
                        'w-full rounded-xl border p-3 text-left transition',
                        monitor.id === selectedId
                          ? 'border-white/20 bg-white/[0.07]'
                          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-white/88">{monitor.name}</div>
                          <div className="mt-0.5 truncate text-[11px] text-white/40">{monitor.topic}</div>
                        </div>
                        <Badge tone={monitor.active ? 'teal' : 'neutral'} className="mono shrink-0">
                          {monitor.active ? 'active' : 'paused'}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge className="mono">{monitor.mode}</Badge>
                        <Badge className="mono">{monitor.cadenceMinutes}m</Badge>
                        <Badge tone={scoreTone(monitor.lastChangeScore)} className="mono">
                          score {monitor.lastChangeScore ?? 0}
                        </Badge>
                      </div>
                      <div className="mt-2 text-[11px] text-white/42">
                        Last run: {formatDate(monitor.lastRunAt)}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-8">
        <div className="space-y-5">
          {formOpen ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle>{editingId ? 'Edit monitor' : 'Create monitor'}</CardTitle>
                <Button variant="ghost" size="sm" onClick={resetForm}>Cancel</Button>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                    Name
                  </label>
                  <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="BTC Macro Watch" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                    Topic
                  </label>
                  <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Bitcoin macro drivers today" />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                    Mode
                  </label>
                  <Select value={mode} onValueChange={(value) => setMode(value as 'fast' | 'deep')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">Fast</SelectItem>
                      <SelectItem value="deep">Deep</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                    Cadence
                  </label>
                  <Select value={cadenceMinutes} onValueChange={(value) => setCadenceMinutes(value as '15' | '60' | '360' | '1440')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CADENCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                    Webhook URL
                  </label>
                  <Input
                    value={notifyWebhookUrl}
                    onChange={(event) => setNotifyWebhookUrl(event.target.value)}
                    placeholder={editingId && selectedMonitor?.hasNotifyWebhook ? 'Enter a new webhook URL to replace the current one' : 'https://example.com/hook'}
                  />
                  {editingId && selectedMonitor?.hasNotifyWebhook ? (
                    <p className="mt-2 text-xs text-white/45">
                      A webhook is already configured and hidden. Leave this blank to keep it unchanged.
                    </p>
                  ) : null}
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button onClick={() => void saveMonitor()} disabled={submitting || !name.trim() || !topic.trim()}>
                    <Save className="h-4 w-4" />
                    {editingId ? 'Update monitor' : 'Create monitor'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-white/50" />
                <CardTitle>{selectedMonitor?.name || 'Monitor detail'}</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => (selectedId ? void fetchRuns(selectedId) : null)} disabled={!selectedId || detailLoading || !operatorAuthorized}>
                  <RefreshCw className={cn('h-4 w-4', detailLoading ? 'animate-spin' : '')} />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={() => populateForm(selectedMonitor)} disabled={!selectedMonitor || !operatorAuthorized}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => void toggleActive()} disabled={!selectedMonitor || submitting || !operatorAuthorized}>
                  {selectedMonitor?.active ? 'Pause' : 'Resume'}
                </Button>
                <Button size="sm" onClick={() => void runMonitor()} disabled={!selectedMonitor || runningNow || !operatorAuthorized}>
                  <Zap className="h-4 w-4" />
                  Run now
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!operatorAuthorized ? (
                <EmptyState
                  icon={<KeyRound className="h-8 w-8" />}
                  title="Operator token required"
                  description="Provide a valid token on the left to inspect monitor state, latest alerts, and run history."
                />
              ) : !selectedMonitor ? (
                <EmptyState
                  icon={<Bell className="h-8 w-8" />}
                  title="Select a monitor"
                  description="Choose a monitor to view its cadence, latest change score, and recent runs."
                />
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge className="mono">{selectedMonitor.mode}</Badge>
                    <Badge className="mono">{selectedMonitor.cadenceMinutes}m</Badge>
                    <Badge tone={selectedMonitor.active ? 'teal' : 'neutral'} className="mono">
                      {selectedMonitor.active ? 'active' : 'paused'}
                    </Badge>
                    <Badge tone={scoreTone(selectedMonitor.lastChangeScore)} className="mono">
                      score {selectedMonitor.lastChangeScore ?? 0}
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Card className="p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                        <Clock3 className="h-3.5 w-3.5" />
                        Last Run
                      </div>
                      <div className="mt-2 text-sm text-white/84">{formatDate(selectedMonitor.lastRunAt)}</div>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                        <Siren className="h-3.5 w-3.5" />
                        Last Alert
                      </div>
                      <div className="mt-2 text-sm text-white/84">{formatDate(selectedMonitor.lastAlertAt)}</div>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                        <Bell className="h-3.5 w-3.5" />
                        Webhook
                      </div>
                      <div className="mt-2 truncate text-sm text-white/84">
                        {selectedMonitor.hasNotifyWebhook ? 'Configured (hidden)' : 'Not configured'}
                      </div>
                    </Card>
                  </div>

                  <div>
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">Recent runs</div>
                    {detailError ? (
                      <Card className="border-orange/25 bg-orange/[0.06] p-3 text-sm text-white/70">{detailError}</Card>
                    ) : detailLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                      </div>
                    ) : !runs.length ? (
                      <EmptyState
                        icon={<Activity className="h-8 w-8" />}
                        title="No runs yet"
                        description="Run this monitor once to establish a baseline."
                      />
                    ) : (
                      <div className="space-y-2">
                        {runs.map((run) => (
                          <Card key={run.id} className="p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className="mono">{run.status}</Badge>
                                  <Badge tone={scoreTone(run.changeScore)} className="mono">
                                    score {run.changeScore ?? 0}
                                  </Badge>
                                  {run.significant ? <Badge tone="orange">alert</Badge> : null}
                                </div>
                                <div className="mt-2 text-sm font-semibold text-white/84">
                                  {run.summary?.headline || run.error || 'Run captured'}
                                </div>
                                {run.summary?.summary ? (
                                  <p className="mt-1 text-sm text-white/58">{run.summary.summary}</p>
                                ) : null}
                                <div className="mt-2 text-[11px] text-white/40">
                                  Started {formatDate(run.startedAt || run.createdAt)}
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                {run.sessionId ? (
                                  <Link href={`/terminal?sessionId=${encodeURIComponent(run.sessionId)}`}>
                                    <Button variant="outline" size="sm">Open snapshot</Button>
                                  </Link>
                                ) : null}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
