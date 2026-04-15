import LocalePage, { generateMetadata as generateLocaleMetadata } from '../[locale]/asset/page';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: 'en' }) });
}

export default async function AssetIndexPage() {
  return LocalePage({ params: Promise.resolve({ locale: 'en' }) });
}
