'use client';

import { RefreshCw, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getTerminalQuickStarts } from '@/lib/query-copy';

export function TerminalSearchBar({
  topic,
  typedTopicHint,
  mode,
  running,
  onTopicChange,
  onModeChange,
  onSubmit,
}: {
  topic: string;
  typedTopicHint: string;
  mode: 'fast' | 'deep';
  running: boolean;
  onTopicChange: (v: string) => void;
  onModeChange: (v: 'fast' | 'deep') => void;
  onSubmit: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations('terminal');
  const quickStarts = getTerminalQuickStarts(locale);

  return (
    <div className="w-full space-y-2 lg:w-[min(900px,62vw)]">
      <form
        className="flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.035] px-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (running || !topic.trim()) return;
          onSubmit();
        }}
      >
        <Input
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          className="h-10 flex-1 border-0 bg-transparent text-sm focus-visible:ring-2 focus-visible:ring-[rgba(0,102,255,0.35)] focus-visible:ring-offset-0"
          placeholder={typedTopicHint || t('searchPlaceholder')}
          aria-label={t('promptAriaLabel')}
        />
        <Button
          type="submit"
          variant="outline"
          size="icon"
          disabled={running || !topic.trim()}
          className="h-9 w-9 border-white/12 bg-[rgba(0,102,255,0.12)] hover:bg-[rgba(0,102,255,0.18)]"
          title={running ? t('running') : t('generate')}
          aria-label={running ? t('running') : t('generate')}
        >
          {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        </Button>
      </form>

      <div className="text-[11px] leading-relaxed text-white/45">
        {t('marketOnlyHint')}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {quickStarts.map((example) => (
            <button
              key={example}
              type="button"
              className="inline-flex h-7 items-center rounded-full border border-white/12 bg-white/[0.03] px-3 text-[11px] text-white/62 transition hover:bg-white/[0.07] hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,102,255,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(4,10,24,0.92)]"
              onClick={() => onTopicChange(example)}
              disabled={running}
            >
              {example}
            </button>
          ))}
        </div>

        <div className="hidden items-center rounded-full border border-white/10 bg-white/[0.03] p-1 text-[11px] text-white/60 sm:flex">
          <button
            type="button"
            className={cn(
              'rounded-full px-3 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,102,255,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(4,10,24,0.92)]',
              mode === 'fast' ? 'bg-white/10 text-white/80' : 'text-white/55 hover:text-white/75',
            )}
            onClick={() => onModeChange('fast')}
            disabled={running}
          >
            {t('fast')}
          </button>
          <button
            type="button"
            className={cn(
              'rounded-full px-3 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,102,255,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(4,10,24,0.92)]',
              mode === 'deep' ? 'bg-white/10 text-white/80' : 'text-white/55 hover:text-white/75',
            )}
            onClick={() => onModeChange('deep')}
            disabled={running}
          >
            {t('deep')}
          </button>
        </div>
      </div>
    </div>
  );
}
