import { dispatchDueMonitors } from '@/lib/monitoring';

async function main() {
  const result = await dispatchDueMonitors(2);
  console.log(JSON.stringify({ ok: true, claimed: result.claimed, dispatchedAt: new Date().toISOString() }));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
});
