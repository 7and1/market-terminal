import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function LegacyAnalysisRedirectPage({ params }: Props) {
  const { locale, slug } = await params;
  const prefix = locale === 'en' ? '' : `/${locale}`;
  redirect(`${prefix}/report/${slug}`);
}

