import { listSeededCanonicalHeads } from '../src/lib/topic-catalog';

type ExistingMonitor = {
  id: string;
  topic: string;
};

function operatorHeaders() {
  const token =
    process.env.OPERATOR_TOKEN ||
    process.env.TRENDANALYSIS_OPERATOR_TOKEN ||
    process.env.MONITOR_OPERATOR_TOKEN ||
    '';
  const headers: Record<string, string> = {};
  if (token) headers['x-operator-token'] = token;
  return headers;
}

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((value) => value.startsWith('--')));
  const baseUrlArg = argv.find((value) => value.startsWith('--base-url='));
  return {
    listOnly: flags.has('--list') || (!flags.has('--create-monitors') && !flags.has('--run-now')),
    createMonitors: flags.has('--create-monitors') || flags.has('--run-now'),
    runNow: flags.has('--run-now'),
    baseUrl: (baseUrlArg ? baseUrlArg.slice('--base-url='.length) : process.env.BASE_URL || process.env.MONITOR_DISPATCH_BASE_URL || '').replace(/\/+$/, ''),
  };
}

function normalizeTopic(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`);
  }
  return payload;
}

async function listExistingMonitors(baseUrl: string): Promise<ExistingMonitor[]> {
  const payload = await fetchJson(`${baseUrl}/api/monitors`, {
    cache: 'no-store',
    headers: operatorHeaders(),
  });
  const raw = Array.isArray(payload.monitors) ? payload.monitors : [];
  return raw
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : '',
      topic: typeof item.topic === 'string' ? item.topic : '',
    }))
    .filter((item) => item.id && item.topic);
}

async function createMonitor(baseUrl: string, head: ReturnType<typeof listSeededCanonicalHeads>[number]) {
  const payload = await fetchJson(`${baseUrl}/api/monitors`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...operatorHeaders() },
    body: JSON.stringify({
      name: `${head.label} watch`,
      topic: head.label,
      mode: head.defaultRunMode,
      cadenceMinutes: head.defaultCadenceMinutes,
      runIntent: 'monitor',
    }),
  });

  const monitor = (payload.monitor || {}) as Record<string, unknown>;
  const id = typeof monitor.id === 'string' ? monitor.id : '';
  if (!id) throw new Error(`Missing monitor id for ${head.label}`);
  return id;
}

async function triggerMonitor(baseUrl: string, monitorId: string) {
  await fetchJson(`${baseUrl}/api/monitors/${encodeURIComponent(monitorId)}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...operatorHeaders() },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const heads = listSeededCanonicalHeads()
    .filter((head) => head.priorityTier === 'v1')
    .sort((left, right) => left.headType.localeCompare(right.headType) || left.label.localeCompare(right.label));

  if (args.listOnly) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          count: heads.length,
          heads: heads.map((head) => ({
            key: head.key,
            label: head.label,
            headType: head.headType,
            publicSurface: head.publicSurface,
            cadenceMinutes: head.defaultCadenceMinutes,
            defaultRunMode: head.defaultRunMode,
            defaultSeedQuery: head.defaultSeedQuery,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!args.baseUrl) {
    throw new Error('BASE_URL or --base-url is required when creating monitors or triggering runs');
  }

  const existing = await listExistingMonitors(args.baseUrl);
  const existingByTopic = new Map(existing.map((monitor) => [normalizeTopic(monitor.topic), monitor.id] as const));
  const created: Array<{ key: string; label: string; monitorId: string }> = [];
  const reused: Array<{ key: string; label: string; monitorId: string }> = [];
  const triggered: Array<{ key: string; label: string; monitorId: string }> = [];

  for (const head of heads) {
    const topic = head.label;
    let monitorId = existingByTopic.get(normalizeTopic(topic)) || '';
    if (!monitorId && args.createMonitors) {
      monitorId = await createMonitor(args.baseUrl, head);
      existingByTopic.set(normalizeTopic(topic), monitorId);
      created.push({ key: head.key, label: head.label, monitorId });
    } else if (monitorId) {
      reused.push({ key: head.key, label: head.label, monitorId });
    }

    if (args.runNow && monitorId) {
      await triggerMonitor(args.baseUrl, monitorId);
      triggered.push({ key: head.key, label: head.label, monitorId });
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl: args.baseUrl,
        created,
        reused,
        triggered,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
});
