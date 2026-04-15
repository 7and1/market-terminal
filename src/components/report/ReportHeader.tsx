import { getLocale, getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/Badge';

const LOCALE_MAP: Record<string, string> = { en: 'en-US', es: 'es-MX', zh: 'zh-CN' };

export async function ReportHeader({
  topic,
  date,
  mode,
  stats,
}: {
  topic: string;
  date: string;
  mode: 'fast' | 'deep';
  stats: {
    evidence: number;
    domains: number;
    latestEvidenceAt: number | null;
    officialCount: number;
    primaryCount: number;
    secondaryCount: number;
  };
}) {
  const locale = await getLocale();
  const t = await getTranslations('report');
  const fmtDate = new Date(date).toLocaleDateString(LOCALE_MAP[locale] ?? 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const fmtLatest = stats.latestEvidenceAt
    ? new Date(stats.latestEvidenceAt).toLocaleString(LOCALE_MAP[locale] ?? 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'No source timestamps';

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-white/90 sm:text-3xl">{topic}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/50">
              <span>{fmtDate}</span>
              <span className="text-white/20">&middot;</span>
              <span>Latest evidence {fmtLatest}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant={mode === 'deep' ? 'teal' : 'blue'}>
              {mode.toUpperCase()} {t('mode')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { label: t('evidence'), value: stats.evidence },
            { label: 'Domains', value: stats.domains },
            { label: 'Official', value: stats.officialCount },
            { label: 'Primary', value: stats.primaryCount },
            { label: 'Secondary', value: stats.secondaryCount },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-center"
            >
              <div className="text-lg font-bold text-white/85">{s.value}</div>
              <div className="text-[11px] font-semibold tracking-wider text-white/45">{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
