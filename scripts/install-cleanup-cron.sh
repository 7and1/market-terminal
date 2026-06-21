#!/usr/bin/env sh
set -eu

APP_DIR="${1:?app dir required}"
CONTAINER_NAME="${2:?container name required}"
LOG_FILE="${3:-/var/log/market-terminal-cleanup.log}"
MONITOR_LOG_FILE="${4:-/var/log/market-terminal-monitors.log}"

shell_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

alert_wrapper() {
  job="$1"
  printf '%s' "{ status=\$?; if [ -n \"\${ALERT_WEBHOOK:-}\" ]; then curl -fsS -X POST -H 'Content-Type: application/json' --data '{\"text\":\"TrendAnalysis cron failed\",\"job\":\"${job}\",\"container\":\"${CONTAINER_NAME}\"}' \"\$ALERT_WEBHOOK\" >/dev/null 2>&1 || true; fi; exit \$status; }"
}

cron_command() {
  job="$1"
  script="$2"
  log_file="$3"
  app_dir_q="$(shell_quote "$APP_DIR")"
  container_q="$(shell_quote "$CONTAINER_NAME")"
  script_q="$(shell_quote "$script")"
  log_file_q="$(shell_quote "$log_file")"
  log_dir_q="$(shell_quote "$(dirname "$log_file")")"

  printf '%s' "cd ${app_dir_q} && mkdir -p ${log_dir_q} && { state=\$(docker inspect -f '{{.State.Running}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' ${container_q} 2>/dev/null || true); case \"\$state\" in 'true healthy'|'true none') docker exec ${container_q} node ${script_q} ;; *) echo \"container_not_ready state=\$state\"; exit 1 ;; esac; } >> ${log_file_q} 2>&1 || $(alert_wrapper "$job")"
}

CRON_CMD="$(cron_command cleanup:sessions scripts/cleanup-expired-sessions.mjs "$LOG_FILE")"
CRON_LINE="*/30 * * * * ${CRON_CMD}"
MONITOR_CRON_CMD="$(cron_command monitors:dispatch scripts/dispatch-monitors.mjs "$MONITOR_LOG_FILE")"
MONITOR_CRON_LINE="*/15 * * * * ${MONITOR_CRON_CMD}"

TMP_CRON="$(mktemp)"
crontab -l 2>/dev/null | grep -v "cleanup-expired-sessions\\.mjs" | grep -v "dispatch-monitors\\.mjs" | grep -v "npm run monitors:dispatch" > "${TMP_CRON}" || true
printf '%s\n' "${CRON_LINE}" >> "${TMP_CRON}"
printf '%s\n' "${MONITOR_CRON_LINE}" >> "${TMP_CRON}"
crontab "${TMP_CRON}"
rm -f "${TMP_CRON}"

printf 'Installed cron: %s\n' "${CRON_LINE}"
printf 'Installed cron: %s\n' "${MONITOR_CRON_LINE}"
