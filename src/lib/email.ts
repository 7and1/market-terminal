import { env } from '@/lib/env';

export function isSubscriptionEmailConfigured() {
  return Boolean(env.email.resendApiKey && env.email.from);
}

export async function sendSubscriptionConfirmation({
  to,
  assetKey,
  confirmUrl,
  unsubscribeUrl,
}: {
  to: string;
  assetKey: string;
  confirmUrl: string;
  unsubscribeUrl: string;
}): Promise<void> {
  if (!isSubscriptionEmailConfigured()) {
    throw new Error('Email provider not configured');
  }

  const text = [
    `Confirm your TrendAnalysis.ai alerts for ${assetKey}.`,
    '',
    `Confirm: ${confirmUrl}`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.email.resendApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.email.from,
      to,
      subject: `Confirm TrendAnalysis.ai alerts for ${assetKey}`,
      text,
      ...(env.email.replyTo ? { reply_to: env.email.replyTo } : null),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend email failed (${response.status}): ${body.slice(0, 240)}`);
  }
}

export async function sendMonitorAlertEmail({
  to,
  assetKey,
  headline,
  summary,
  reportUrl,
  unsubscribeUrl,
}: {
  to: string;
  assetKey: string;
  headline: string;
  summary: string;
  reportUrl: string | null;
  unsubscribeUrl: string;
}): Promise<void> {
  if (!isSubscriptionEmailConfigured()) {
    throw new Error('Email provider not configured');
  }

  const text = [
    `TrendAnalysis.ai detected a major ${assetKey} monitor change.`,
    '',
    headline,
    '',
    summary,
    '',
    reportUrl ? `Report: ${reportUrl}` : null,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].filter(Boolean).join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.email.resendApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.email.from,
      to,
      subject: `TrendAnalysis.ai ${assetKey} monitor change`,
      text,
      ...(env.email.replyTo ? { reply_to: env.email.replyTo } : null),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend email failed (${response.status}): ${body.slice(0, 240)}`);
  }
}
