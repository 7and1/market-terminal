# TrendAnalysis.ai

Evidence-first market research built with Next.js 16, React 19, Bright Data, OpenRouter, and PostgreSQL.

The app takes a market topic or question, runs a multi-stage retrieval pipeline, and streams results into a terminal-style workspace with evidence, graph, timeline, media, and chat panels. Public report and asset pages now read through a shared public projection layer backed by stored session data.

Product contract and operating docs:

- `docs/product-contract.md`
- `docs/public-ops.md`

## Current Architecture

- Framework: Next.js App Router with `next-intl`
- Data store: PostgreSQL via `pg` and `schema.sql`
- External providers: Bright Data for SERP and page extraction, OpenRouter for LLM stages
- Deployment target: standalone Node build in Docker on a VPS

Core directories:

- `src/app`: pages and route handlers
- `src/components`: terminal, dashboard, report, landing, and shared UI
- `src/lib`: provider clients, env parsing, database access, logging, typed helpers
- `src/lib/run-pipeline`: pipeline contracts, utilities, graph heuristics, and stage modules
- `src/prompts`: prompt builders for plan, summaries, artifacts, impact, and chat
- `messages`: locale dictionaries for `en`, `es`, and `zh`
- `scripts`: one-off tooling such as keyword research

## Local Development

```bash
npm install
npm run dev
```

Create local configuration from `.env.local.example`:

```bash
cp .env.local.example .env.local
```

Required variables:

- `BRIGHTDATA_API_TOKEN`
- `BRIGHTDATA_WEB_UNLOCKER_ZONE`
- `BRIGHTDATA_SERP_ZONE`
- `OPENROUTER_API_KEY`
- `DATABASE_URL`
- `OPERATOR_TOKEN` for monitor/control-plane APIs

Optional public API rate-limit identity and budget controls:

- `TRUST_PROXY_HEADERS=true` makes public route rate limiting use `x-real-ip`, then the last `x-forwarded-for` hop, instead of one shared bucket. Only enable it behind a trusted reverse proxy that strips or rewrites those headers.
- `DAILY_BRIGHTDATA_CALL_LIMIT` and `DAILY_OPENROUTER_CALL_LIMIT` cap provider calls through `market_signal.provider_usage_daily`.
- `ALERT_WEBHOOK` lets monitor dispatch and cron wrappers post operational warnings when provider usage crosses 80% of the daily limit or scheduled jobs fail.

## Validation

Use the same validation chain locally that CI should enforce:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

The test suite runs on Vitest and now covers core backend libraries plus route behavior for `run`, `chat`, `health`, session pagination, and public API endpoints such as `price`, `serp`, and `videos`.

## Pipeline Layout

`POST /api/run` is an SSE endpoint. The route is an orchestrator; stage logic lives under `src/lib/run-pipeline/`.

- `contracts.ts`: core pipeline types and request schema
- `utils.ts`: generic helpers used across stages
- `graph-heuristics.ts`: graph normalization and fallback graph enrichment
- `stages/plan.ts`: query planning
- `stages/search.ts`: SERP execution and fallback search behavior
- `stages/evidence.ts`: markdown scrape and evidence summarization
- `stages/artifacts.ts`: artifact generation, repair, and fallback map output
- `stages/impact.ts`: graph expansion logic for deep runs

## API Surface

Important routes:

- `POST /api/run`: starts the research pipeline and returns an SSE stream
- `POST /api/chat`: grounded follow-up questions for a stored session
- `GET /api/health`: config status; add `?probe=1` with `x-operator-token` to actively test DB, DB schema/indexes, AI, and Bright Data connectivity
- `GET /api/sessions`, `/api/sessions/events`, `/api/sessions/snapshot`: dashboard and replay data
- `GET/POST/PATCH /api/monitors*`: operator-only monitor control plane protected by `OPERATOR_TOKEN`

## Deployment

The default production path is Docker on a VPS:

```bash
npm run build
docker compose build
docker compose up -d
```

`Dockerfile` builds a standalone Next.js server. `docker-compose.yml` expects `.env.production` and exposes the app on port `3100 -> 3000`.

Operational commands:

```bash
npm run schema:apply
npm run cleanup:sessions
npm run monitors:dispatch
```

The VPS deploy workflow now applies `schema.sql` inside the running container and installs cron entries for session TTL cleanup and monitor dispatch. Cleanup removes stale unpublished non-ready runs after 24 hours, unpublished ready sessions after 30 days, and expired PG rate-limit counters, while preserving recent monitor-linked runs for continuity.

See `docs/runbook.md` for uptime monitor setup, cron alerting, and logrotate guidance.

Recommended production verification after deploy:

```bash
docker exec market-terminal node scripts/apply-schema.mjs
docker exec market-terminal node scripts/cleanup-expired-sessions.mjs
crontab -l | grep cleanup-expired-sessions.mjs
curl -H "x-operator-token: $OPERATOR_TOKEN" "https://your-host/api/health?probe=1"
```

OpenClaw preview validation:

```bash
OPENCLAW_PREVIEW_URL="https://preview.example.com" \
bash scripts/openclaw-validate.sh
```

Optional end-to-end publish validation:

```bash
OPENCLAW_PREVIEW_URL="https://preview.example.com" \
OPENCLAW_SAMPLE_QUERY="What changed in NVDA earnings expectations today?" \
OPENCLAW_RUN_PUBLISH=1 \
bash scripts/openclaw-validate.sh
```

Repo-owned preview entrypoint for OpenClaw:

```bash
OPENCLAW_RUNTIME_ENV_FILE=".env.preview-runtime.fixed" \
OPENCLAW_PORT=3218 \
bash scripts/openclaw-preview.sh
```

Minimal browser harness against a running preview:

```bash
OPENCLAW_PREVIEW_URL="http://127.0.0.1:3218" \
OPENCLAW_REPORT_SLUG="bitcoin-price-move-2026-04-14-1e3c" \
bash scripts/openclaw-browser-validate.sh
```

Minimal browser harness with full-chain report derivation:

```bash
OPENCLAW_PREVIEW_URL="http://127.0.0.1:3218" \
OPENCLAW_SAMPLE_QUERY="What changed in NVDA earnings expectations today?" \
OPENCLAW_RUN_PUBLISH=1 \
bash scripts/openclaw-browser-validate.sh
```

If Playwright Chromium is not installed yet on OpenClaw, bootstrap it once:

```bash
npm run test:browser:install
```
