-- Market Signal Terminal — PostgreSQL schema
-- Run on Supabase DB: docker exec supabase-db psql -U postgres -f /tmp/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS market_signal;

CREATE TABLE IF NOT EXISTS market_signal.sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    TEXT UNIQUE NOT NULL,
  topic         TEXT NOT NULL,
  report_key    TEXT,
  status        TEXT NOT NULL DEFAULT 'running',
  step          TEXT NOT NULL DEFAULT 'plan',
  progress      REAL NOT NULL DEFAULT 0,
  meta          JSONB DEFAULT '{}',
  published     BOOLEAN DEFAULT FALSE,
  slug          TEXT UNIQUE,
  asset_key     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE market_signal.sessions ADD COLUMN IF NOT EXISTS report_key TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_slug ON market_signal.sessions(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_asset ON market_signal.sessions(asset_key, status);
CREATE INDEX IF NOT EXISTS idx_sessions_report_key ON market_signal.sessions(report_key);
CREATE INDEX IF NOT EXISTS idx_sessions_created_session ON market_signal.sessions(created_at DESC, session_id DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status_created_session ON market_signal.sessions(status, created_at DESC, session_id DESC);

CREATE TABLE IF NOT EXISTS market_signal.session_events (
  id          BIGSERIAL PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES market_signal.sessions(session_id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  payload     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_session ON market_signal.session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON market_signal.session_events(session_id, id ASC);

CREATE TABLE IF NOT EXISTS market_signal.monitors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  topic               TEXT NOT NULL,
  mode                TEXT NOT NULL DEFAULT 'deep',
  run_intent          TEXT NOT NULL DEFAULT 'monitor',
  cadence_minutes     INT NOT NULL,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  notify_webhook_url  TEXT,
  last_run_at         TIMESTAMPTZ,
  last_ready_session_id TEXT,
  last_change_score   INT,
  last_alert_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_monitors_mode CHECK (mode IN ('fast', 'deep')),
  CONSTRAINT chk_monitors_run_intent CHECK (run_intent IN ('monitor', 'general')),
  CONSTRAINT chk_monitors_cadence CHECK (cadence_minutes IN (15, 60, 360, 1440))
);

CREATE INDEX IF NOT EXISTS idx_monitors_active_last_run ON market_signal.monitors(active, last_run_at);

CREATE TABLE IF NOT EXISTS market_signal.monitor_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id        UUID NOT NULL REFERENCES market_signal.monitors(id) ON DELETE CASCADE,
  session_id        TEXT UNIQUE,
  baseline_session_id TEXT,
  status            TEXT NOT NULL,
  change_score      INT,
  significant       BOOLEAN,
  summary           JSONB NOT NULL DEFAULT '{}',
  error             TEXT,
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_monitor_runs_status CHECK (status IN ('queued', 'running', 'ready', 'error', 'noop'))
);

CREATE INDEX IF NOT EXISTS idx_monitor_runs_monitor_created ON market_signal.monitor_runs(monitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitor_runs_status_created ON market_signal.monitor_runs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS market_signal.report_heads (
  report_key        TEXT PRIMARY KEY,
  canonical_label   TEXT NOT NULL,
  subject_key       TEXT NOT NULL,
  current_session_id TEXT NOT NULL,
  current_slug      TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_heads_subject_updated ON market_signal.report_heads(subject_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_heads_current_slug ON market_signal.report_heads(current_slug);

CREATE TABLE IF NOT EXISTS market_signal.query_aliases (
  alias_key         TEXT PRIMARY KEY,
  alias_label       TEXT NOT NULL,
  target_type       TEXT NOT NULL,
  report_key        TEXT,
  asset_key         TEXT,
  source            TEXT NOT NULL DEFAULT 'catalog',
  confidence        REAL NOT NULL DEFAULT 0.5,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_query_aliases_target_type CHECK (target_type IN ('report', 'asset')),
  CONSTRAINT chk_query_aliases_source CHECK (source IN ('catalog', 'report', 'manual')),
  CONSTRAINT chk_query_aliases_target_presence CHECK (
    (target_type = 'report' AND report_key IS NOT NULL) OR
    (target_type = 'asset' AND asset_key IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_query_aliases_target_type ON market_signal.query_aliases(target_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_aliases_report_key ON market_signal.query_aliases(report_key);
CREATE INDEX IF NOT EXISTS idx_query_aliases_asset_key ON market_signal.query_aliases(asset_key);

CREATE TABLE IF NOT EXISTS market_signal.provider_usage_daily (
  usage_date    DATE NOT NULL,
  provider      TEXT NOT NULL,
  calls         BIGINT NOT NULL DEFAULT 0,
  failures      BIGINT NOT NULL DEFAULT 0,
  tokens        BIGINT NOT NULL DEFAULT 0,
  meta          JSONB DEFAULT '{}',
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (usage_date, provider)
);

CREATE INDEX IF NOT EXISTS idx_provider_usage_daily_provider ON market_signal.provider_usage_daily(provider, usage_date DESC);

CREATE TABLE IF NOT EXISTS market_signal.raw_documents (
  url           TEXT PRIMARY KEY,
  url_hash      TEXT NOT NULL,
  domain        TEXT,
  markdown      TEXT NOT NULL,
  captured_at   TIMESTAMPTZ DEFAULT NOW(),
  meta          JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_raw_documents_url_captured ON market_signal.raw_documents(url_hash, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_documents_domain ON market_signal.raw_documents(domain);

CREATE TABLE IF NOT EXISTS market_signal.serp_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  query_hash    TEXT NOT NULL,
  query_text    TEXT NOT NULL,
  provider      TEXT NOT NULL DEFAULT 'brightdata',
  results       JSONB NOT NULL DEFAULT '[]',
  captured_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serp_snapshots_query ON market_signal.serp_snapshots(query_hash, captured_at DESC);

CREATE TABLE IF NOT EXISTS market_signal.evidence_documents (
  id            BIGSERIAL PRIMARY KEY,
  url           TEXT NOT NULL,
  url_hash      TEXT NOT NULL,
  title         TEXT,
  source        TEXT,
  published_at  TIMESTAMPTZ,
  observed_at   TIMESTAMPTZ DEFAULT NOW(),
  excerpt       TEXT,
  meta          JSONB DEFAULT '{}',
  UNIQUE (url_hash)
);

CREATE INDEX IF NOT EXISTS idx_evidence_documents_url ON market_signal.evidence_documents(url_hash);

CREATE TABLE IF NOT EXISTS market_signal.session_evidence (
  session_id    TEXT NOT NULL REFERENCES market_signal.sessions(session_id) ON DELETE CASCADE,
  evidence_id   BIGINT NOT NULL REFERENCES market_signal.evidence_documents(id) ON DELETE CASCADE,
  rank          INT NOT NULL DEFAULT 0,
  meta          JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, evidence_id)
);

CREATE INDEX IF NOT EXISTS idx_session_evidence_session ON market_signal.session_evidence(session_id, rank);

CREATE TABLE IF NOT EXISTS market_signal.asset_daily_metrics (
  asset_key     TEXT NOT NULL,
  metric_date   DATE NOT NULL,
  summary       JSONB NOT NULL DEFAULT '{}',
  metrics       JSONB NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (asset_key, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_asset_daily_metrics_asset_date ON market_signal.asset_daily_metrics(asset_key, metric_date DESC);

CREATE TABLE IF NOT EXISTS market_signal.query_log (
  id            BIGSERIAL PRIMARY KEY,
  input         TEXT NOT NULL,
  normalized    TEXT,
  locale        TEXT,
  surface       TEXT,
  decision      TEXT,
  result        JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_log_created ON market_signal.query_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_log_decision_created ON market_signal.query_log(decision, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_log_normalized_created ON market_signal.query_log(normalized, created_at DESC);

CREATE TABLE IF NOT EXISTS market_signal.catalog_heads_dynamic (
  key           TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  asset_key     TEXT,
  report_key    TEXT,
  public_surface TEXT NOT NULL DEFAULT 'asset_hub',
  priority_tier TEXT NOT NULL DEFAULT 'secondary',
  aliases       JSONB NOT NULL DEFAULT '[]',
  status        TEXT NOT NULL DEFAULT 'candidate',
  score         REAL NOT NULL DEFAULT 0,
  meta          JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE market_signal.catalog_heads_dynamic ADD COLUMN IF NOT EXISTS asset_key TEXT;
ALTER TABLE market_signal.catalog_heads_dynamic ADD COLUMN IF NOT EXISTS report_key TEXT;
ALTER TABLE market_signal.catalog_heads_dynamic ADD COLUMN IF NOT EXISTS public_surface TEXT NOT NULL DEFAULT 'asset_hub';
ALTER TABLE market_signal.catalog_heads_dynamic ADD COLUMN IF NOT EXISTS priority_tier TEXT NOT NULL DEFAULT 'secondary';
ALTER TABLE market_signal.catalog_heads_dynamic ADD COLUMN IF NOT EXISTS aliases JSONB NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS idx_catalog_heads_dynamic_status ON market_signal.catalog_heads_dynamic(status, score DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_heads_dynamic_asset ON market_signal.catalog_heads_dynamic(asset_key, status);
CREATE INDEX IF NOT EXISTS idx_catalog_heads_dynamic_report ON market_signal.catalog_heads_dynamic(report_key, status);

CREATE TABLE IF NOT EXISTS market_signal.subscribers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  asset_key     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  token_hash    TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at  TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  UNIQUE (email, asset_key)
);

CREATE INDEX IF NOT EXISTS idx_subscribers_asset ON market_signal.subscribers(asset_key, status);

CREATE TABLE IF NOT EXISTS market_signal.rate_limit_counters (
  bucket        TEXT PRIMARY KEY,
  hits          INT NOT NULL DEFAULT 0,
  reset_at      TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_expires ON market_signal.rate_limit_counters(reset_at);
