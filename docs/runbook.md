# TrendAnalysis.ai Runbook

## Production Monitors

Configure these Uptime Kuma monitors for the production host:

- Home page: `GET https://trendanalysis.ai/`, interval 30s, expect HTTP 200.
- Health endpoint: `GET https://trendanalysis.ai/api/health`, interval 30s, expect HTTP 200.

Route both monitors to the operator notification channel used for VPS alerts.
The active probe endpoint `/api/health?probe=1` requires `OPERATOR_TOKEN` and
should be used for deploy validation, not public uptime polling.

## Cron Alerts

`scripts/install-cleanup-cron.sh` installs two cron jobs:

- `cleanup-expired-sessions.mjs` every 30 minutes.
- `dispatch-monitors.mjs` every 15 minutes.

If either command exits non-zero and the host cron environment defines
`ALERT_WEBHOOK`, the cron wrapper posts a JSON alert:

```sh
ALERT_WEBHOOK=https://example.com/ops-alert
```

Without `ALERT_WEBHOOK`, cron jobs still run and log failures to their configured
log files.

The generated cron commands preflight the Docker container before `docker exec`.
They run only when the container is running and either `healthy` or has no
Docker healthcheck. Missing, stopped, restarting, or unhealthy containers log
`container_not_ready` and use the same `ALERT_WEBHOOK` failure path.

## Log Rotation

Install a host logrotate rule for the cron logs:

```text
/var/log/market-terminal-cleanup.log
/var/log/market-terminal-monitors.log {
  daily
  rotate 14
  compress
  missingok
  notifempty
  copytruncate
}
```

After installing, verify with:

```sh
logrotate -d /etc/logrotate.d/trendanalysis-ai
```

## Deploy Smoke

After deploy, run:

```sh
curl -fsS https://trendanalysis.ai/api/health
curl -fsS -H "x-operator-token: $OPERATOR_TOKEN" "https://trendanalysis.ai/api/health?probe=1"
```

The shallow `/api/health` check is the rollback gate. The authenticated probe is
diagnostic evidence for provider and database readiness.
