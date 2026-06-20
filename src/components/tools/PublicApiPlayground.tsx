'use client';

import { useState } from 'react';
import { ExternalLink, LoaderCircle, RotateCcw, Send } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { publicApiEntries } from '@/lib/tool-catalog';
import { apiPath, cn } from '@/lib/utils';

export type EndpointId = 'health' | 'serp' | 'price' | 'videos';

type FieldOption = {
  label: string;
  value: string;
};

type EndpointField = {
  name: string;
  label: string;
  kind: 'text' | 'select';
  placeholder?: string;
  helper?: string;
  options?: FieldOption[];
};

type EndpointDefinition = {
  id: EndpointId;
  path: string;
  title: string;
  description: string;
  defaults: Record<string, string>;
  fields: EndpointField[];
};

type PlaygroundResult = {
  ok: boolean;
  status: number;
  durationMs: number;
  requestUrl: string;
  body: unknown;
};

const NONE_VALUE = '__none__';

const endpointDefinitions: EndpointDefinition[] = [
  {
    id: 'health',
    path: '/api/health',
    title: 'Health Probe',
    description: 'Readiness and probe checks for Bright Data, AI, and database connectivity.',
    defaults: {
      probe: '1',
    },
    fields: [
      {
        name: 'probe',
        label: 'Probe mode',
        kind: 'select',
        helper: 'When enabled, the endpoint runs live dependency checks instead of config-only status.',
        options: [
          { label: 'Disabled', value: '' },
          { label: 'Enabled', value: '1' },
        ],
      },
    ],
  },
  {
    id: 'serp',
    path: '/api/serp',
    title: 'SERP Search',
    description: 'Normalized Bright Data-backed web or news search results.',
    defaults: {
      q: 'NVDA earnings',
      vertical: 'news',
      recency: 'd',
      format: 'light',
    },
    fields: [
      {
        name: 'q',
        label: 'Query',
        kind: 'text',
        placeholder: 'NVDA earnings, Fed meeting, oil market',
      },
      {
        name: 'vertical',
        label: 'Vertical',
        kind: 'select',
        options: [
          { label: 'Web', value: 'web' },
          { label: 'News', value: 'news' },
        ],
      },
      {
        name: 'recency',
        label: 'Recency',
        kind: 'select',
        options: [
          { label: 'Any time', value: '' },
          { label: 'Past hour', value: 'h' },
          { label: 'Past day', value: 'd' },
          { label: 'Past week', value: 'w' },
          { label: 'Past month', value: 'm' },
          { label: 'Past year', value: 'y' },
        ],
      },
      {
        name: 'format',
        label: 'Format',
        kind: 'select',
        options: [
          { label: 'Light JSON', value: 'light' },
          { label: 'Full JSON', value: 'full' },
          { label: 'Markdown', value: 'markdown' },
        ],
      },
    ],
  },
  {
    id: 'price',
    path: '/api/price',
    title: 'Price Snapshot',
    description: 'Lightweight topic-to-price lookup for supported mapped assets.',
    defaults: {
      topic: 'BTC',
    },
    fields: [
      {
        name: 'topic',
        label: 'Topic',
        kind: 'text',
        placeholder: 'BTC, ETH, SOL, gold',
      },
    ],
  },
  {
    id: 'videos',
    path: '/api/videos',
    title: 'Video Discovery',
    description: 'Topic-led YouTube discovery backed by SERP collection and metadata enrichment.',
    defaults: {
      topic: 'NVDA',
      limit: '4',
    },
    fields: [
      {
        name: 'topic',
        label: 'Topic',
        kind: 'text',
        placeholder: 'NVDA, Fed meeting, oil market',
      },
      {
        name: 'limit',
        label: 'Limit',
        kind: 'select',
        options: [
          { label: '2', value: '2' },
          { label: '4', value: '4' },
          { label: '6', value: '6' },
          { label: '8', value: '8' },
        ],
      },
    ],
  },
];

function buildInitialState() {
  return Object.fromEntries(
    endpointDefinitions.map((endpoint) => [endpoint.id, { ...endpoint.defaults }]),
  ) as Record<EndpointId, Record<string, string>>;
}

function buildRequestPath(path: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    searchParams.set(key, trimmed);
  }

  const queryString = searchParams.toString();
  return queryString ? `${apiPath(path)}?${queryString}` : apiPath(path);
}

function formatBody(body: unknown) {
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

export function PublicApiPlayground({
  initialEndpointId = 'health',
  lockedEndpointId,
  title = 'Try the public API',
  description = 'Requests run from the browser against the same read-only routes documented below. This keeps the public surface inspectable while private runtime endpoints stay out of reach.',
}: {
  initialEndpointId?: EndpointId;
  lockedEndpointId?: EndpointId;
  title?: string;
  description?: string;
}) {
  const [selectedEndpointId, setSelectedEndpointId] = useState<EndpointId>(lockedEndpointId ?? initialEndpointId);
  const [paramsByEndpoint, setParamsByEndpoint] = useState<Record<EndpointId, Record<string, string>>>(() =>
    buildInitialState(),
  );
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const activeEndpointId = lockedEndpointId ?? selectedEndpointId;
  const selectedEndpoint = endpointDefinitions.find((endpoint) => endpoint.id === activeEndpointId) || endpointDefinitions[0];
  const selectedParams = paramsByEndpoint[activeEndpointId];

  const requestPath = buildRequestPath(selectedEndpoint.path, selectedParams);

  const publicEndpointMeta = publicApiEntries.find((entry) => entry.path === selectedEndpoint.path) || null;

  const endpointLabel = lockedEndpointId ? selectedEndpoint.title : 'Endpoint';

  const setFieldValue = (fieldName: string, value: string) => {
    setParamsByEndpoint((current) => ({
      ...current,
      [activeEndpointId]: {
        ...current[activeEndpointId],
        [fieldName]: value,
      },
    }));
  };

  const resetEndpoint = () => {
    setParamsByEndpoint((current) => ({
      ...current,
      [activeEndpointId]: { ...selectedEndpoint.defaults },
    }));
    setResult(null);
  };

  const runRequest = async () => {
    setIsRunning(true);
    const startedAt = performance.now();

    try {
      const response = await fetch(requestPath, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
        },
      });

      const contentType = response.headers.get('content-type') || '';
      const body = contentType.includes('application/json')
        ? await response.json().catch(() => ({ error: 'Invalid JSON response' }))
        : await response.text().catch(() => 'Could not read response body');

      setResult({
        ok: response.ok,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
        requestUrl: requestPath,
        body,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed';
      setResult({
        ok: false,
        status: 0,
        durationMs: Math.round(performance.now() - startedAt),
        requestUrl: requestPath,
        body: { error: message },
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="overflow-hidden p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="teal">Live GET</Badge>
            <span className="text-xs uppercase tracking-[0.14em] text-white/38">Browser playground</span>
          </div>
            <h3 className="mt-3 text-xl font-semibold text-white/90 sm:text-2xl">{title}</h3>
            <p className="mt-2 max-w-[720px] text-sm leading-relaxed text-white/56">
              {description}
            </p>
          </div>
        <Button type="button" variant="outline" size="sm" onClick={resetEndpoint}>
          <RotateCcw className="h-4 w-4" />
          Reset example
        </Button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
              {endpointLabel}
            </label>
            {lockedEndpointId ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/82">
                {selectedEndpoint.title}
              </div>
            ) : (
              <Select value={selectedEndpointId} onValueChange={(value) => setSelectedEndpointId(value as EndpointId)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an endpoint" />
                </SelectTrigger>
                <SelectContent>
                  {endpointDefinitions.map((endpoint) => (
                    <SelectItem key={endpoint.id} value={endpoint.id}>
                      {endpoint.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="mt-2 text-sm text-white/52">{selectedEndpoint.description}</p>
          </div>

          <div className="grid gap-4">
            {selectedEndpoint.fields.map((field) => (
              <div key={field.name}>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
                  {field.label}
                </label>
                {field.kind === 'text' ? (
                  <Input
                    value={selectedParams[field.name] || ''}
                    onChange={(event) => setFieldValue(field.name, event.target.value)}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <Select
                    value={(selectedParams[field.name] || '') || NONE_VALUE}
                    onValueChange={(value) => setFieldValue(field.name, value === NONE_VALUE ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Choose ${field.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options || []).map((option) => (
                        <SelectItem
                          key={`${field.name}:${option.value || NONE_VALUE}`}
                          value={option.value || NONE_VALUE}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {field.helper ? <p className="mt-2 text-xs text-white/42">{field.helper}</p> : null}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/38">Request URL</div>
            <code className="mt-3 block overflow-x-auto text-sm text-white/80">{requestPath}</code>
            {publicEndpointMeta?.exampleQuery ? (
              <div className="mt-3 text-xs text-white/42">
                Reference example: <code>{publicEndpointMeta.exampleQuery}</code>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={runRequest} disabled={isRunning}>
              {isRunning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isRunning ? 'Running...' : 'Run request'}
            </Button>
            <a
              href={requestPath}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/14 px-4 text-sm text-white/80 transition',
                'hover:bg-white/6 hover:text-white',
              )}
            >
              Open raw
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-black/25">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/38">Response</div>
              <div className="mt-1 text-sm text-white/52">Formatted JSON or text body from the selected public route.</div>
            </div>
            {result ? (
              <div className="flex items-center gap-2">
                <Badge variant={result.ok ? 'success' : 'destructive'}>
                  {result.status || 'ERR'}
                </Badge>
                <span className="text-xs text-white/42">{result.durationMs} ms</span>
              </div>
            ) : null}
          </div>

          <pre className="max-h-[540px] overflow-auto p-4 text-xs leading-relaxed text-white/72">
            <code>{result ? formatBody(result.body) : 'Run a request to inspect the live response payload.'}</code>
          </pre>
        </div>
      </div>
    </Card>
  );
}
