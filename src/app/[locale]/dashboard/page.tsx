import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SessionDashboard } from '@/components/dashboard/SessionDashboard';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';
  const path = `${locale === 'en' ? '' : `/${locale}`}/dashboard`;

  return {
    title: t('dashboardTitle'),
    description: t('dashboardDesc'),
    alternates: {
      canonical: `${baseUrl}${path}`,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <SessionDashboard />;
}
