#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
cd "$repo_root"

resolve_env_file() {
  if [[ -n "${OPENCLAW_RUNTIME_ENV_FILE:-}" ]]; then
    if [[ ! -f "${OPENCLAW_RUNTIME_ENV_FILE}" ]]; then
      echo "openclaw-preview: OPENCLAW_RUNTIME_ENV_FILE does not exist: ${OPENCLAW_RUNTIME_ENV_FILE}" >&2
      exit 1
    fi
    printf '%s\n' "${OPENCLAW_RUNTIME_ENV_FILE}"
    return 0
  fi

  local candidates=(".env.preview-runtime.fixed" ".env.preview-runtime" ".env.production")
  if [[ "${OPENCLAW_ALLOW_LOCAL_ENV:-0}" == "1" ]]; then
    candidates+=(".env.local")
  fi

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

load_env_file() {
  local env_file="$1"
  local parsed
  parsed="$(mktemp)"

  python3 - "$env_file" >"$parsed" <<'PY'
import re
import shlex
import sys

env_file = sys.argv[1]
key_pattern = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')

with open(env_file, 'r', encoding='utf-8') as fh:
    for idx, raw_line in enumerate(fh, start=1):
        line = raw_line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('export '):
            line = line[7:].lstrip()
        try:
            parts = shlex.split(line, posix=True)
        except ValueError:
            print(f'openclaw-preview: skipping invalid env line {idx} in {env_file}', file=sys.stderr)
            continue
        if len(parts) != 1 or '=' not in parts[0]:
            print(f'openclaw-preview: skipping invalid env line {idx} in {env_file}', file=sys.stderr)
            continue
        key, value = parts[0].split('=', 1)
        if not key_pattern.match(key):
            print(f'openclaw-preview: skipping invalid env key {key!r} in {env_file}', file=sys.stderr)
            continue
        sys.stdout.buffer.write(f'{key}={value}'.encode('utf-8') + b'\0')
PY

  local assignment
  while IFS= read -r -d '' assignment; do
    export "$assignment"
  done <"$parsed"

  rm -f "$parsed"
}

if env_file="$(resolve_env_file)"; then
  echo "openclaw-preview: loading env from ${env_file}" >&2
  load_env_file "$env_file"
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

standalone_root=".next/standalone"
mkdir -p "${standalone_root}/.next"

# Mirror the Docker runner layout so CSS/JS chunks and public assets resolve
# when the standalone server is launched from the repo workspace.
ln -sfn "${repo_root}/.next/static" "${standalone_root}/.next/static"
if [[ -d "${repo_root}/public" ]]; then
  ln -sfn "${repo_root}/public" "${standalone_root}/public"
fi

printf 'OPENCLAW_PREVIEW_TARGET=http://%s:%s\n' "$HOSTNAME" "$PORT"
printf 'OPENCLAW_PREVIEW_HEALTH=http://%s:%s/api/health\n' "$HOSTNAME" "$PORT"

cd "${standalone_root}"
exec node server.js
