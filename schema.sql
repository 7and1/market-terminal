-- Market Signal Terminal — PostgreSQL schema
-- Run on Supabase DB: docker exec supabase-db psql -U postgres -f /tmp/schema.sql

CREATE SCHEMA IF NOT EXISTS market_signal;

CREATE TABLE IF NOT EXISTS market_signal.sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    TEXT UNIQUE NOT NULL,
  topic         TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_sessions_slug ON market_signal.sessions(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_asset ON market_signal.sessions(asset_key, status);
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
