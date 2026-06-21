'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowUpRight,
  BarChart3,
  Globe,
  Menu,
  TrendingUp,
} from 'lucide-react';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LOCALE_LABELS: Record<string, string> = {
  en: 'EN',
  es: 'ES',
  zh: '中文',
};

export function SiteHeader({ className }: { className?: string }) {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('nav');
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathnameWithSearch = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`;

  const NAV_ITEMS = [
    {
      href: '/trending' as const,
      label: t('reports'),
      icon: TrendingUp,
      matches: ['/trending', '/report'],
    },
    {
      href: '/asset' as const,
      label: t('assetHubs'),
      icon: BarChart3,
      matches: ['/asset'],
    },
  ];

  return (
    <header className={cn('sticky top-0 z-40', className)}>
      <div className="mx-auto max-w-[1280px] px-4 py-3">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgba(0,102,255,0.12)] via-transparent to-[rgba(120,196,255,0.08)] opacity-60" />
          <div className="relative flex items-center justify-between gap-3">
            {/* Logo */}
            <Link href="/" className="flex shrink-0 items-center">
              <span className="flex flex-col leading-none">
                <span className="text-lg font-bold tracking-tight text-white/92">
                  TrendAnalysis
                  <span className="text-primary">.ai</span>
                </span>
                <span className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-white/42 md:block">
                  {t('tagline')}
                </span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV_ITEMS.map(({ href, label, icon: Icon, matches }) => {
                const active = matches.some((prefix) => pathname === prefix || pathname?.startsWith(prefix + '/'));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-white/[0.08] text-white/90'
                        : 'text-white/50 hover:bg-white/[0.04] hover:text-white/70',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Link>
                );
              })}

              {/* Language Switcher */}
              <LanguageSwitcher locale={locale} pathname={pathnameWithSearch} languageLabel={t('language')} />

              <Button
                asChild
                size="sm"
                className="ml-2 border-[rgba(0,102,255,0.42)] bg-[rgba(0,102,255,0.18)] text-[rgba(199,228,255,0.98)] hover:bg-[rgba(0,102,255,0.26)]"
              >
                <Link href="/terminal">
                  {t('askQuestion')}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </nav>

            {/* Mobile Menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">{t('menu')}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <SheetHeader>
                  <SheetTitle>{t('navigation')}</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  <Button
                    asChild
                    size="sm"
                    className="mb-3 w-full justify-center border-[rgba(0,102,255,0.42)] bg-[rgba(0,102,255,0.18)] text-[rgba(199,228,255,0.98)] hover:bg-[rgba(0,102,255,0.26)]"
                  >
                    <Link href="/terminal" onClick={() => setMobileOpen(false)}>
                      {t('askQuestion')}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>

                  {NAV_ITEMS.map(({ href, label, icon: Icon, matches }) => {
                    const active = matches.some((prefix) => pathname === prefix || pathname?.startsWith(prefix + '/'));
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          active
                            ? 'bg-white/[0.08] text-white/90'
                            : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </Link>
                    );
                  })}

                  {/* Mobile Language Switcher */}
                  <div className="mt-4 border-t border-white/[0.08] pt-4">
                    <LanguageSwitcher locale={locale} pathname={pathnameWithSearch} languageLabel={t('language')} />
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

function LanguageSwitcher({
  locale,
  pathname,
  languageLabel,
}: {
  locale: string;
  pathname: string;
  languageLabel: string;
}) {
  const locales = ['en', 'es', 'zh'] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="locale-switcher-trigger"
          className="h-8 w-8 text-white/50 hover:text-white/80"
        >
          <Globe className="h-3.5 w-3.5" />
          <span className="sr-only">{languageLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[80px]">
        {locales.map((l) => {
          return (
            <DropdownMenuItem key={l} asChild>
              <Link
                href={pathname}
                locale={l}
                data-testid={`locale-link-${l}`}
                className={cn(
                  'cursor-pointer',
                  l === locale && 'font-bold',
                )}
              >
                {LOCALE_LABELS[l]}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
