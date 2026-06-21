'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, RefreshCw, Search, ShieldCheck, UploadCloud } from 'lucide-react';

import { apiPath, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/skeleton';
import { OPERATOR_TOKEN_STORAGE_KEY, buildOperatorHeaders } from '@/components/dashboard/operator-auth-client';

type DemandRow = {
  normalized: string;
  sampleInput: string;
  count: number;
  rejectCount: number;
  privateCount: number;
  ambiguousCount: number;
  surfaces: string[];
  locales: string[];
  firstSeenAt: string;
  latestSeenAt: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}

function rowTone(row: DemandRow) {
  if (row.privateCount >= row.rejectCount) return 'blue';
  if (row.rejectCount > 0) return 'orange';
  return 'neutral';
}

export function DemandDashboard() {
  const [operatorToken, setOperatorToken] = useState('');
  const [operatorInput, setOperatorInput] = useState('');
  const [items, setItems] = useState<DemandRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [promotingKey, setPromotingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const operatorAuthorized = operatorToken.trim().length > 0;

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

  const fetchDemand = useCallback(async () => {
    if (!operatorAuthorized) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiPath('/api/query/demand?days=30&limit=50'), {
        cache: 'no-store',
        headers: buildOperatorHeaders(operatorToken),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Failed to load demand');
      setItems((json?.items || []) as DemandRow[]);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load demand');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [operatorAuthorized, operatorToken]);

  const promoteDemand = useCallback(async (item: DemandRow) => {
    if (!operatorAuthorized) return;
    setPromotingKey(item.normalized);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(apiPath('/api/query/demand/promote'), {
        method: 'POST',
        cache: 'no-store',
        headers: buildOperatorHeaders(operatorToken, 'application/json'),
        body: JSON.stringify({
          label: item.sampleInput || item.normalized,
          key: item.normalized,
          aliases: [item.normalized, item.sampleInput].filter(Boolean),
          publicSurface: 'asset_hub',
          priorityTier: 'secondary',
          score: Math.min(100, Math.max(1, item.count)),
          meta: {
            demand: {
              count: item.count,
              rejectCount: item.rejectCount,
              privateCount: item.privateCount,
              ambiguousCount: item.ambiguousCount,
              latestSeenAt: item.latestSeenAt,
            },
          },
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Failed to promote demand');
      setNotice(`${json?.item?.label || item.normalized} promoted to catalog`);
      await fetchDemand();
    } catch (promoteError) {
      setError(promoteError instanceof Error ? promoteError.message : 'Failed to promote demand');
    } finally {
      setPromotingKey(null);
    }
  }, [fetchDemand, operatorAuthorized, operatorToken]);

  useEffect(() => {
    if (!operatorAuthorized) return;
    void fetchDemand();
  }, [fetchDemand, operatorAuthorized]);

  const totals = useMemo(
    () => items.reduce(
      (acc, item) => ({
        queries: acc.queries + item.count,
        reject: acc.reject + item.rejectCount,
        private: acc.private + item.privateCount,
        ambiguous: acc.ambiguous + item.ambiguousCount,
      }),
      { queries: 0, reject: 0, private: 0, ambiguous: 0 },
    ),
    [items],
  );

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-white/50" />
              <CardTitle>Demand</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => void fetchDemand()} disabled={loading || !operatorAuthorized}>
              <RefreshCw className={cn('h-4 w-4', loading ? 'animate-spin' : '')} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-4 w-4 text-white/55" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white/84">Operator token required</div>
                  <p className="mt-1 text-xs leading-relaxed text-white/50">
                    Demand rows come from query logs and are available only to operators.
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
                      setItems([]);
                      setError(null);
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ['Queries', totals.queries],
                ['Private', totals.private],
                ['Rejected', totals.reject],
                ['Ambiguous', totals.ambiguous],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                  <div className="text-lg font-semibold text-white/86">{value}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/42">{label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-8">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-white/50" />
              <CardTitle>Publishable Queue Signals</CardTitle>
            </div>
            <Badge className="mono">30d</Badge>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="mb-3 rounded-xl border border-orange/25 bg-orange/[0.06] p-3 text-sm text-white/70">{error}</div>
            ) : null}
            {notice ? (
              <div className="mb-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] p-3 text-sm text-white/70">{notice}</div>
            ) : null}
            {!operatorAuthorized ? (
              <EmptyState
                icon={<KeyRound className="h-8 w-8" />}
                title="Demand queue locked"
                description="Add a valid operator token to inspect rejected, private, and ambiguous query demand."
              />
            ) : loading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : !items.length ? (
              <EmptyState
                icon={<Search className="h-8 w-8" />}
                title="No queued demand yet"
                description="Rejected, private, and ambiguous query resolutions will appear here once users search outside the public catalog."
              />
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.normalized} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-white/86">{item.normalized}</h3>
                          <Badge tone={rowTone(item)} className="mono">{item.count} hits</Badge>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-white/58">{item.sampleInput}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {item.surfaces.map((surface) => <Badge key={surface}>{surface}</Badge>)}
                          {item.locales.map((locale) => <Badge key={locale}>{locale}</Badge>)}
                        </div>
                      </div>
                      <div className="min-w-[210px] space-y-2">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
                            <div className="text-sm font-semibold text-white/84">{item.privateCount}</div>
                            <div className="text-[10px] text-white/42">private</div>
                          </div>
                          <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
                            <div className="text-sm font-semibold text-white/84">{item.rejectCount}</div>
                            <div className="text-[10px] text-white/42">reject</div>
                          </div>
                          <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
                            <div className="text-sm font-semibold text-white/84">{item.ambiguousCount}</div>
                            <div className="text-[10px] text-white/42">ambig</div>
                          </div>
                        </div>
                        <Button
                          className="w-full"
                          variant="outline"
                          size="sm"
                          onClick={() => void promoteDemand(item)}
                          disabled={promotingKey === item.normalized}
                        >
                          <UploadCloud className="h-4 w-4" />
                          {promotingKey === item.normalized ? 'Promoting' : 'Promote'}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 text-[11px] text-white/38">
                      First seen {formatDate(item.firstSeenAt)} · latest {formatDate(item.latestSeenAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
