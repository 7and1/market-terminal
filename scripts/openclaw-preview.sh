#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
cd "$repo_root"

resolve_env_file() {
  if [[ -n "${OPENCLAW_RUNTIME_ENV_FILE:-}" ]]; then
    printf '%s\n' "${OPENCLAW_RUNTIME_ENV_FILE}"
    return 0
  fi

  local candidate
  for candidate in \
    ".env.preview-runtime.fixed" \
    ".env.preview-runtime" \
    ".env.local" \
    ".env.production"
  do
    if [[ -f "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

if env_file="$(resolve_env_file)"; then
  echo "openclaw-preview: loading env from ${env_file}" >&2
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
else
  echo "openclaw-preview: no preview env file found; using current process env only" >&2
fi

host="${OPENCLAW_HOSTNAME:-${HOSTNAME:-127.0.0.1}}"
port="${OPENCLAW_PORT:-${PORT:-3000}}"

export HOSTNAME="$host"
export PORT="$port"
export NODE_ENV="${NODE_ENV:-production}"
export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"

if [[ "${OPENCLAW_FORCE_BUILD:-0}" == "1" || ! -f ".next/standalone/server.js" ]]; then
  echo "openclaw-preview: building standalone output" >&2
  npm run build
fi

if [[ ! -f ".next/standalone/server.js" ]]; then
  echo "openclaw-preview: missing .next/standalone/server.js after build" >&2
  exit 1
fi

printf 'OPENCLAW_PREVIEW_TARGET=http://%s:%s\n' "$HOSTNAME" "$PORT"
printf 'OPENCLAW_PREVIEW_HEALTH=http://%s:%s/api/health\n' "$HOSTNAME" "$PORT"

exec node .next/standalone/server.js
