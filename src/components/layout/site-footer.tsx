'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export function SiteFooter({ className }: { className?: string }) {
  const t = useTranslations('nav');
  const tFooter = useTranslations('footer');
  const common = useTranslations('common');

  return (
    <footer className={cn('border-t border-white/[0.06] py-8', className)}>
      <div className="mx-auto max-w-[1280px] px-4 text-center">
        <div className="text-xs text-white/40">
          <span className="font-semibold text-white/60">trendanalysis.ai</span>
          <span className="mx-2">&middot;</span>
          {tFooter('tagline')}
        </div>
        <nav className="mt-3 flex items-center justify-center gap-5 text-xs text-white/30">
          <Link href="/terminal" className="transition hover:text-white/60">
            {t('terminal')}
          </Link>
          <Link href="/trending" className="transition hover:text-white/60">
            {t('reports')}
          </Link>
          <Link href="/asset" className="transition hover:text-white/60">
            {common('assets')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
