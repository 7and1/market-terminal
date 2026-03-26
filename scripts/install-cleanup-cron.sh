#!/usr/bin/env sh
set -eu

APP_DIR="${1:?app dir required}"
CONTAINER_NAME="${2:?container name required}"
LOG_FILE="${3:-/var/log/market-terminal-cleanup.log}"
MONITOR_LOG_FILE="${4:-/var/log/market-terminal-monitors.log}"

CRON_CMD="cd ${APP_DIR} && docker exec ${CONTAINER_NAME} node scripts/cleanup-expired-sessions.mjs >> ${LOG_FILE} 2>&1"
CRON_LINE="*/30 * * * * ${CRON_CMD}"
MONITOR_CRON_CMD="cd ${APP_DIR} && docker exec ${CONTAINER_NAME} node scripts/dispatch-monitors.mjs >> ${MONITOR_LOG_FILE} 2>&1"
MONITOR_CRON_LINE="*/15 * * * * ${MONITOR_CRON_CMD}"

TMP_CRON="$(mktemp)"
crontab -l 2>/dev/null | grep -v "cleanup-expired-sessions\\.mjs" | grep -v "dispatch-monitors\\.mjs" | grep -v "npm run monitors:dispatch" > "${TMP_CRON}" || true
printf '%s\n' "${CRON_LINE}" >> "${TMP_CRON}"
printf '%s\n' "${MONITOR_CRON_LINE}" >> "${TMP_CRON}"
crontab "${TMP_CRON}"
rm -f "${TMP_CRON}"

printf 'Installed cron: %s\n' "${CRON_LINE}"
printf 'Installed cron: %s\n' "${MONITOR_CRON_LINE}"
