'use client';

import { useMemo, useState } from 'react';
import { Bell, CheckCircle2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { apiPath } from '@/lib/utils';

function normalizeTopic(topic: string) {
  return topic.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function CreateMonitorButton({
  topic,
  className,
}: {
  topic: string;
  className?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'created' | 'exists' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const monitorName = useMemo(() => `${topic.trim()} watch`, [topic]);

  const createMonitor = async () => {
    const cleaned = topic.trim();
    if (!cleaned || status === 'saving') return;

    setStatus('saving');
    setMessage('');

    try {
      const existingResponse = await fetch(apiPath('/api/monitors'), { cache: 'no-store' });
      const existingJson = (await existingResponse.json().catch(() => ({}))) as { monitors?: Array<{ topic?: string }> };
      const alreadyExists = (existingJson.monitors || []).some((monitor) => normalizeTopic(String(monitor.topic || '')) === normalizeTopic(cleaned));

      if (alreadyExists) {
        setStatus('exists');
        setMessage('Monitor already exists. Manage cadence and reruns in the dashboard.');
        return;
      }

      const response = await fetch(apiPath('/api/monitors'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: monitorName,
          topic: cleaned,
          mode: 'deep',
          cadenceMinutes: 360,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Could not create monitor');
      }

      setStatus('created');
      setMessage('Monitor created. Future runs will compare against this baseline.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Could not create monitor');
    }
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={status === 'saving'}
        className="border-white/12 bg-white/[0.03]"
        onClick={createMonitor}
      >
        {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : status === 'created' ? <CheckCircle2 className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        Monitor this topic
      </Button>
      {message ? (
        <div className="mt-2 text-[11px] leading-relaxed text-white/52">
          {message}
        </div>
      ) : null}
    </div>
  );
}
