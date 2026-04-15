import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Terminal } from '@/components/terminal/Terminal';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const path = `${locale === 'en' ? '' : `/${locale}`}/terminal`;

  return {
    title: t('terminalTitle'),
    description: t('terminalDesc'),
    alternates: {
      canonical: `${baseUrl}${path}`,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function TerminalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return (
    <>
      <h1 className="sr-only">{t('terminalTitle')}</h1>
      <Suspense fallback={<div className="min-h-screen bg-terminal" />}>
        <Terminal />
      </Suspense>
    </>
  );
}
