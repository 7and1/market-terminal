'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { apiPath } from '@/lib/utils';

type SubscribeBoxProps = {
  assetKey: string;
  assetLabel: string;
};

export function SubscribeBox({ assetKey, assetLabel }: SubscribeBoxProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = email.trim();
    if (!cleaned) return;

    setStatus('submitting');
    setMessage(null);
    try {
      const response = await fetch(apiPath('/api/subscribe'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: cleaned, assetKey }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Subscription failed');
      }
      setStatus('success');
      setMessage('Check your inbox to confirm alerts.');
      setEmail('');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Subscription failed');
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="text-sm font-semibold text-white/84">Watch {assetLabel}</div>
      <p className="mt-1 text-xs leading-relaxed text-white/48">
        Get an email when a confirmed monitor run finds a major change. Your address is only used for these alerts.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          className="min-h-10 min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-black/20 px-3 text-sm text-white/84 outline-none transition placeholder:text-white/30 focus:border-white/25"
        />
        <Button type="submit" size="sm" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Sending...' : 'Subscribe'}
        </Button>
      </div>
      {message ? (
        <div className={status === 'error' ? 'mt-2 text-xs text-red-300' : 'mt-2 text-xs text-emerald-300'}>
          {message}
        </div>
      ) : null}
      <div className="mt-2 text-[11px] leading-relaxed text-white/35">
        Every email includes an unsubscribe link.
      </div>
    </form>
  );
}
