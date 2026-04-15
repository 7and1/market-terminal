#!/usr/bin/env bash
set -euo pipefail

: "${OPENCLAW_PREVIEW_URL:?OPENCLAW_PREVIEW_URL is required}"

artifact_dir="${OPENCLAW_ARTIFACT_DIR:-./.codex-results/openclaw-validate}"
sample_query="${OPENCLAW_SAMPLE_QUERY:-Why is BTC moving today?}"
mkdir -p "$artifact_dir"

base_url="${OPENCLAW_PREVIEW_URL%/}"

curl -fsS -D "$artifact_dir/home.headers.txt" "${base_url}/" >"$artifact_dir/home.html"
curl -fsS -D "$artifact_dir/home.en.headers.txt" "${base_url}/en" >"$artifact_dir/home.en.html"
curl -fsS -D "$artifact_dir/asset.headers.txt" "${base_url}/asset" >"$artifact_dir/asset.html"
curl -fsS -D "$artifact_dir/trending.headers.txt" "${base_url}/trending" >"$artifact_dir/trending.html"
curl -fsS "${base_url}/api/health" >"$artifact_dir/health.json"

cat >"$artifact_dir/query.resolve.request.json" <<EOF
{"input":"${sample_query//\"/\\\"}","surface":"landing","locale":"en"}
EOF

curl -fsS \
  -X POST \
  -H 'content-type: application/json' \
  --data @"$artifact_dir/query.resolve.request.json" \
  "${base_url}/api/query/resolve" >"$artifact_dir/query.resolve.json"

curl -fsS "${base_url}/api/health?probe=1" >"$artifact_dir/health.probe.json"

if [[ "${OPENCLAW_RUN_PUBLISH:-0}" != "1" ]]; then
  exit 0
fi

cat >"$artifact_dir/run.request.json" <<EOF
{"topic":"${sample_query//\"/\\\"}","locale":"en","mode":"fast","runReason":"direct"}
EOF

curl -fsS -N \
  -D "$artifact_dir/run.headers.txt" \
  -o "$artifact_dir/run.sse" \
  -X POST \
  -H 'accept: text/event-stream' \
  -H 'content-type: application/json' \
  --data @"$artifact_dir/run.request.json" \
  "${base_url}/api/run"

snapshot_cookie="$(
  awk 'BEGIN{IGNORECASE=1}
    /^set-cookie:/ && /mt_snapshot_/ {
      line=$0
      sub(/^[Ss]et-[Cc]ookie:[[:space:]]*/, "", line)
      sub(/;.*/, "", line)
      print line
      exit
    }' "$artifact_dir/run.headers.txt"
)"

session_id="$(
  node -e '
    const fs = require("node:fs");
    const text = fs.readFileSync(process.argv[1], "utf8");
    const chunks = text.split(/\n\n+/);
    for (const chunk of chunks) {
      const lines = chunk.split(/\n/);
      let event = "";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        const parsed = JSON.parse(data);
        if (event === "session" && parsed.sessionId) {
          process.stdout.write(String(parsed.sessionId));
          process.exit(0);
        }
        if (event === "done" && parsed.sessionId) {
          process.stdout.write(String(parsed.sessionId));
          process.exit(0);
        }
      } catch {}
    }
  ' "$artifact_dir/run.sse"
)"

if [[ -z "$snapshot_cookie" || -z "$session_id" ]]; then
  echo "openclaw-validate: missing snapshot cookie or session id after /api/run" >&2
  exit 1
fi

cat >"$artifact_dir/publish.request.json" <<EOF
{"sessionId":"${session_id}","locale":"en"}
EOF

curl -fsS \
  -D "$artifact_dir/publish.headers.txt" \
  -o "$artifact_dir/publish.json" \
  -X POST \
  -H 'content-type: application/json' \
  -H "cookie: ${snapshot_cookie}" \
  --data @"$artifact_dir/publish.request.json" \
  "${base_url}/api/sessions/publish"

published_slug="$(
  node -e '
    const fs = require("node:fs");
    const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (payload && typeof payload.slug === "string") process.stdout.write(payload.slug);
  ' "$artifact_dir/publish.json"
)"

if [[ -z "$published_slug" ]]; then
  echo "openclaw-validate: publish response did not return slug" >&2
  exit 1
fi

curl -fsS -D "$artifact_dir/report.headers.txt" "${base_url}/report/${published_slug}" >"$artifact_dir/report.html"
