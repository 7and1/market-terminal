#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${OPENCLAW_LOCAL_WORKSPACE:-$PWD}"
PROJECT_SLUG="${OPENCLAW_PROJECT:-trendanalysis-ai}"
REMOTE_WORKSPACE="${OPENCLAW_REMOTE_WORKSPACE:-/Users/openclaw/test-workspace/${PROJECT_SLUG}}"
PROD_HOST="${OPENCLAW_PREVIEW_SOURCE_HOST:-root@107.174.42.198}"
PROD_ENV_PATH="${OPENCLAW_PREVIEW_SOURCE_ENV_PATH:-/opt/docker-projects/standalone-apps/brightdata/market-signal-terminal/.env.production}"
LOCAL_TUNNEL_PORT="${OPENCLAW_DB_TUNNEL_PORT:-55432}"
REMOTE_DB_HOST="${OPENCLAW_DB_SOURCE_HOST:-127.0.0.1}"
REMOTE_DB_PORT="${OPENCLAW_DB_SOURCE_PORT:-5432}"
MODEL_OVERRIDE="${OPENCLAW_PREVIEW_MODEL:-}"

cd "$PROJECT_ROOT"

rsync -a \
  --exclude .git \
  --exclude node_modules \
  --exclude .next \
  --exclude .open-next \
  --exclude .codex-results \
  ./ "openclaw:${REMOTE_WORKSPACE}/"

ssh "$PROD_HOST" "cat '$PROD_ENV_PATH'" | \
  ssh openclaw "cat > '${REMOTE_WORKSPACE}/.env.preview-runtime' && chmod 600 '${REMOTE_WORKSPACE}/.env.preview-runtime'"

if ! lsof -nP -iTCP:"$LOCAL_TUNNEL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  ssh -fN -o ExitOnForwardFailure=yes -L "${LOCAL_TUNNEL_PORT}:${REMOTE_DB_HOST}:${REMOTE_DB_PORT}" "$PROD_HOST"
fi

python3 - <<PY
import socket, sys
s = socket.socket()
s.settimeout(2)
try:
    s.connect(('127.0.0.1', ${LOCAL_TUNNEL_PORT}))
except Exception:
    sys.exit(1)
finally:
    s.close()
PY

if ! ssh openclaw "python3 - <<'PY'
import socket, sys
s = socket.socket()
s.settimeout(2)
try:
    s.connect(('127.0.0.1', ${LOCAL_TUNNEL_PORT}))
except Exception:
    sys.exit(1)
finally:
    s.close()
PY"; then
  ssh openclaw -fN -o ExitOnForwardFailure=yes -R "${LOCAL_TUNNEL_PORT}:127.0.0.1:${LOCAL_TUNNEL_PORT}"
  sleep 1
  ssh openclaw "python3 - <<'PY'
import socket, sys
s = socket.socket()
s.settimeout(2)
try:
    s.connect(('127.0.0.1', ${LOCAL_TUNNEL_PORT}))
except Exception:
    sys.exit(1)
finally:
    s.close()
PY"
fi

cat <<'PY' | ssh openclaw "cat > /tmp/codex-fix-preview-env.py && chmod 700 /tmp/codex-fix-preview-env.py"
import pathlib
import sys
import urllib.parse

port = sys.argv[1]
model_override = sys.argv[2]
workspace = pathlib.Path(sys.argv[3])

values = {}
for line in (workspace / '.env.preview-runtime').read_text().splitlines():
    s = line.strip()
    if not s or s.startswith('#') or '=' not in s:
        continue
    key, value = s.split('=', 1)
    values[key.strip()] = value.strip()

url = urllib.parse.urlparse(values['DATABASE_URL'])
netloc = f'127.0.0.1:{port}'
if url.username or url.password:
    auth = url.username or ''
    if url.password:
        auth += ':' + url.password
    netloc = auth + '@' + netloc

fixed_db = urllib.parse.urlunparse((
    url.scheme,
    netloc,
    url.path,
    url.params,
    url.query,
    url.fragment,
))

lines = [
    f'DATABASE_URL={fixed_db}',
    f'BRIGHTDATA_API_TOKEN={values.get("BRIGHTDATA_API_TOKEN", "")}',
    f'BRIGHTDATA_WEB_UNLOCKER_ZONE={values.get("BRIGHTDATA_WEB_UNLOCKER_ZONE", "")}',
    f'BRIGHTDATA_SERP_ZONE={values.get("BRIGHTDATA_SERP_ZONE", "")}',
    f'OPENROUTER_API_KEY={values.get("OPENROUTER_API_KEY", "")}',
    f'OPENROUTER_MODEL={model_override or values.get("OPENROUTER_MODEL", "")}',
    f'ALLOW_CLIENT_API_KEYS={values.get("ALLOW_CLIENT_API_KEYS", "false")}',
]

if 'NEXT_PUBLIC_SITE_URL' in values:
    lines.append(f'NEXT_PUBLIC_SITE_URL={values["NEXT_PUBLIC_SITE_URL"]}')

out = workspace / '.env.preview-runtime.fixed'
out.write_text('\n'.join(lines) + '\n')
out.chmod(0o600)
print('preview-runtime-ready')
PY

ssh openclaw "python3 /tmp/codex-fix-preview-env.py '${LOCAL_TUNNEL_PORT}' '${MODEL_OVERRIDE}' '${REMOTE_WORKSPACE}'"

echo "Prepared OpenClaw preview runtime for ${PROJECT_SLUG}"
