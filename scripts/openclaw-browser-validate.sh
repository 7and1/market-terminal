#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
cd "$repo_root"

artifact_dir="${OPENCLAW_BROWSER_ARTIFACT_DIR:-./.codex-results/openclaw-browser}"
mkdir -p "$artifact_dir"
rm -rf \
  "${artifact_dir}/html-report" \
  "${artifact_dir}/publish" \
  "${artifact_dir}/test-results" \
  "${artifact_dir}/results.json"

find_free_port() {
  local candidate="$1"

  if ! command -v lsof >/dev/null 2>&1; then
    printf '%s\n' "$candidate"
    return 0
  fi

  while lsof -iTCP:"$candidate" -sTCP:LISTEN >/dev/null 2>&1; do
    candidate=$((candidate + 1))
  done

  printf '%s\n' "$candidate"
}

cleanup() {
  if [[ -n "${preview_pid:-}" ]]; then
    kill "$preview_pid" >/dev/null 2>&1 || true
    wait "$preview_pid" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

base_url="${OPENCLAW_PREVIEW_URL:-}"
if [[ -z "$base_url" ]]; then
  host="${OPENCLAW_HOSTNAME:-127.0.0.1}"
  requested_port="${OPENCLAW_PORT:-3218}"
  port="$(find_free_port "$requested_port")"
  if [[ "$port" != "$requested_port" ]]; then
    echo "openclaw-browser-validate: port ${requested_port} busy, using ${port} instead" >&2
  fi
  base_url="http://${host}:${port}"
  echo "openclaw-browser-validate: starting repo-owned preview on ${base_url}" >&2
  OPENCLAW_HOSTNAME="$host" OPENCLAW_PORT="$port" bash scripts/openclaw-preview.sh \
    >"$artifact_dir/preview.stdout.log" \
    2>"$artifact_dir/preview.stderr.log" &
  preview_pid=$!

  ready=0
  for _ in $(seq 1 90); do
    if curl -fsS "${base_url}/api/health" >"$artifact_dir/health.json"; then
      ready=1
      break
    fi
    sleep 2
  done

  if [[ "$ready" != "1" ]]; then
    echo "openclaw-browser-validate: preview did not become healthy at ${base_url}" >&2
    exit 1
  fi
fi

base_url="${base_url%/}"
sample_query="${OPENCLAW_SAMPLE_QUERY:-Why is BTC moving today?}"
report_slug="${OPENCLAW_REPORT_SLUG:-}"

if [[ -z "$report_slug" && "${OPENCLAW_RUN_PUBLISH:-0}" == "1" ]]; then
  publish_artifact_dir="${artifact_dir}/publish"
  OPENCLAW_PREVIEW_URL="$base_url" \
    OPENCLAW_ARTIFACT_DIR="$publish_artifact_dir" \
    OPENCLAW_SAMPLE_QUERY="$sample_query" \
    OPENCLAW_RUN_PUBLISH=1 \
    bash scripts/openclaw-validate.sh

  report_slug="$(
    node -e '
      const fs = require("node:fs");
      const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      if (payload && typeof payload.slug === "string") {
        process.stdout.write(payload.slug);
      }
    ' "${publish_artifact_dir}/publish.json"
  )"
fi

if [[ -z "$report_slug" ]]; then
  echo "openclaw-browser-validate: set OPENCLAW_REPORT_SLUG or OPENCLAW_RUN_PUBLISH=1 for report coverage" >&2
  exit 1
fi

PLAYWRIGHT_BASE_URL="$base_url" \
PLAYWRIGHT_REPORT_SLUG="$report_slug" \
PLAYWRIGHT_OUTPUT_DIR="${artifact_dir}/test-results" \
PLAYWRIGHT_JSON_REPORT="${artifact_dir}/results.json" \
PLAYWRIGHT_HTML_REPORT="${artifact_dir}/html-report" \
npx playwright test --config playwright.config.ts
