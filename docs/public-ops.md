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

Tools are intentionally `noindex,follow` rather than blocked in `robots.txt`.
That lets crawlers read the noindex directive and follow supporting links back
to indexed asset hubs and reports.

### Canonical Rules

- English default locale remains unprefixed.
- Locale alternates are emitted for indexed public pages.
- Historical report pages canonicalize to the current slug for that semantic head.
- Non-current or below-threshold reports are `noindex,follow`.

### Sitemap Rules

- Include landing, public collections, current publishable report heads, and seeded asset hubs.
- Exclude terminal, dashboard, API routes, and tools.

### Robots Rules

- Disallow `/api/`, `/terminal`, `/dashboard`, and locale-prefixed equivalents.
- Do not disallow `/tools` because the tool pages carry page-level
  `noindex,follow` metadata.

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
| Real run | `DATABASE_URL`, `BRIGHTDATA_API_TOKEN`, `BRIGHTDATA_WEB_UNLOCKER_ZONE`, `BRIGHTDATA_SERP_ZONE`, `OPENROUTER_API_KEY`; optional `OPENROUTER_MODEL` and `OPENROUTER_MODEL_FALLBACKS` |
| Publish | Same as run, plus session snapshot auth cookie from `/api/run` |
| Monitor control plane | `OPERATOR_TOKEN` plus full run env |
| Health probe | Same external provider env plus DB schema applied |

## Preview Acceptance Flow

Use openclaw for install/build/preview rather than the local Mac runtime.

### Repo-owned preview entrypoint

Managed preview should call the repo script rather than a hand-written server command:

```bash
OPENCLAW_RUNTIME_ENV_FILE=".env.preview-runtime.fixed" \
OPENCLAW_PORT=3218 \
bash scripts/openclaw-preview.sh
```

Behavior:

- loads env from `OPENCLAW_RUNTIME_ENV_FILE` when provided
- otherwise falls back to the first existing file among `.env.preview-runtime.fixed`, `.env.preview-runtime`, and `.env.production`
- parses env files as data instead of shell-sourcing them, so malformed local comments or special characters do not execute as shell commands
- only considers `.env.local` when `OPENCLAW_ALLOW_LOCAL_ENV=1` is explicitly set
- builds standalone output when `.next/standalone/server.js` is missing or `OPENCLAW_FORCE_BUILD=1`
- starts the standalone server on `OPENCLAW_HOSTNAME` / `OPENCLAW_PORT` (defaults `127.0.0.1:3000`)
- keeps model fallbacks in application code when preview env does not define `OPENROUTER_MODEL_FALLBACKS`, so region-specific OpenRouter model blocks do not make health checks permanently red

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
OPENCLAW_SAMPLE_QUERY="What changed in NVDA earnings expectations today?" \
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
2. `/api/health?probe=1` is green when called with `x-operator-token`
3. `/api/run` returns SSE and snapshot auth cookie
4. `/api/sessions/publish` succeeds for a canonical public head
5. resulting `/report/[slug]` renders

## Browser Acceptance

The repo now owns a minimal Playwright harness for route-level QA. It checks:

- `/` stays unprefixed and indexable
- `/asset` stays indexable
- `/trending` stays indexable
- `/tools` stays reachable and `noindex,follow`
- `/terminal` stays reachable and `noindex,nofollow`
- current `/report/[slug]` stays indexable

Run it against an existing preview:

```bash
OPENCLAW_PREVIEW_URL="http://127.0.0.1:3218" \
OPENCLAW_REPORT_SLUG="bitcoin-price-move-2026-04-14-1e3c" \
bash scripts/openclaw-browser-validate.sh
```

Or let the harness derive the report slug from a fresh run/publish:

```bash
OPENCLAW_PREVIEW_URL="http://127.0.0.1:3218" \
OPENCLAW_SAMPLE_QUERY="What changed in NVDA earnings expectations today?" \
OPENCLAW_RUN_PUBLISH=1 \
bash scripts/openclaw-browser-validate.sh
```

If `OPENCLAW_PREVIEW_URL` is omitted, the browser harness starts the repo-owned preview script itself on `http://127.0.0.1:${OPENCLAW_PORT:-3218}` and writes artifacts under `.codex-results/openclaw-browser/`.

Bootstrap Playwright Chromium once per remote workspace if needed:

```bash
npm run test:browser:install
```

## Operator Auth

Operator routes and active health probes (`/api/health?probe=1`) require `OPERATOR_TOKEN` through `x-operator-token` or `Authorization: Bearer ...`.

Protected routes:

- `/api/monitors`
- `/api/monitors/[id]`
- `/api/monitors/[id]/run`
- `/api/monitors/[id]/runs`
- `/api/health?probe=1`

Supporting scripts now forward `OPERATOR_TOKEN` automatically:

- [`scripts/dispatch-monitors.mjs`](../scripts/dispatch-monitors.mjs)
- [`scripts/seed-canonical-heads.ts`](../scripts/seed-canonical-heads.ts)
