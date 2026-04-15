# Public Read Model, SEO, and Acceptance

## Public Projection Layer

Public surfaces now read through [`src/lib/public-read-model.ts`](../src/lib/public-read-model.ts).

Projection responsibilities:

- `getLandingProjection()`
  - returns seeded trending asset topics for landing
- `getAssetIndexProjection()`
  - returns public asset cards for `/asset`
- `getTrendingProjection()`
  - returns fresh report cards plus seeded asset hubs for `/trending`
- `getAssetHubProjection(key, locale)`
  - returns current baseline, recurring catalysts, archive, comparison cards, and structured data for `/asset/[key]`
- `getReportProjection(slug, locale)`
  - returns report summary, evidence ordering, comparison context, sibling history, and JSON-LD for `/report/[slug]`

Backing sources:

| Source | Purpose |
| --- | --- |
| `market_signal.sessions` | Raw session storage and private run artifacts |
| `market_signal.report_heads` | Current public head pointer and canonical label |
| `market_signal.query_aliases` | Query-to-public-head reuse model |
| Projection layer | Stable read model consumed by public pages |

This keeps public pages from each re-implementing their own session shaping logic.

## SEO Policy

### Indexed

- `/`
- `/asset`
- `/asset/[key]`
- `/trending`
- Current publishable `/report/[slug]`

### Reachable but excluded from index

- `/terminal`
- `/dashboard`
- `/tools`
- `/tools/*`
- Historical or below-threshold `/report/[slug]`

### Canonical Rules

- English default locale remains unprefixed.
- Locale alternates are emitted for indexed public pages.
- Historical report pages canonicalize to the current slug for that semantic head.
- Non-current or below-threshold reports are `noindex,follow`.

### Sitemap Rules

- Include landing, public collections, current publishable report heads, and seeded asset hubs.
- Exclude terminal, dashboard, API routes, and tools.

### Internal Linking

- Landing points down into asset hubs, fresh reports, and the private terminal.
- Trending points from fresh reports into asset hubs.
- Report points sideways into sibling analyses and related comparison heads.
- Asset hub points into current report, archive, and comparison heads.

## Environment Matrix

| Capability | Required env |
| --- | --- |
| Public page render | `DATABASE_URL` for live public content, `NEXT_PUBLIC_SITE_URL` for canonical output |
| Query resolution | `DATABASE_URL` for reuse catalog, optional `ENABLE_QUERY_RESOLUTION_TIEBREAKER` for AI tie-breaks |
| Real run | `DATABASE_URL`, `BRIGHTDATA_API_TOKEN`, `BRIGHTDATA_WEB_UNLOCKER_ZONE`, `BRIGHTDATA_SERP_ZONE`, `OPENROUTER_API_KEY` |
| Publish | Same as run, plus session snapshot auth cookie from `/api/run` |
| Monitor control plane | `OPERATOR_TOKEN` plus full run env |
| Health probe | Same external provider env plus DB schema applied |

## Preview Acceptance Flow

Use openclaw for install/build/preview rather than the local Mac runtime.

### Static public acceptance

```bash
OPENCLAW_PREVIEW_URL="https://preview.example.com" \
bash scripts/openclaw-validate.sh
```

Artifacts written:

- `home.html`
- `asset.html`
- `trending.html`
- `health.json`
- `health.probe.json`
- `query.resolve.json`

### Full chain acceptance

```bash
OPENCLAW_PREVIEW_URL="https://preview.example.com" \
OPENCLAW_SAMPLE_QUERY="Why is BTC moving today?" \
OPENCLAW_RUN_PUBLISH=1 \
bash scripts/openclaw-validate.sh
```

Additional artifacts written:

- `run.sse`
- `run.headers.txt`
- `publish.json`
- `report.html`

This path proves:

1. query resolve succeeds
2. `/api/health?probe=1` is green
3. `/api/run` returns SSE and snapshot auth cookie
4. `/api/sessions/publish` succeeds for a canonical public head
5. resulting `/report/[slug]` renders

## Operator Auth

Operator routes require `OPERATOR_TOKEN` through `x-operator-token` or `Authorization: Bearer ...`.

Protected routes:

- `/api/monitors`
- `/api/monitors/[id]`
- `/api/monitors/[id]/run`
- `/api/monitors/[id]/runs`

Supporting scripts now forward `OPERATOR_TOKEN` automatically:

- [`scripts/dispatch-monitors.mjs`](../scripts/dispatch-monitors.mjs)
- [`scripts/seed-canonical-heads.ts`](../scripts/seed-canonical-heads.ts)
