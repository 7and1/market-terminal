import LocalePage, { generateMetadata as generateLocaleMetadata } from '../[locale]/trending/page';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: 'en' }) });
}

export default async function TrendingPage() {
  return LocalePage({ params: Promise.resolve({ locale: 'en' }) });
}
