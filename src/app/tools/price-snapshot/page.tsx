import LocalePage, { generateMetadata as generateLocaleMetadata } from '../../[locale]/tools/price-snapshot/page';

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: 'en' }) });
}

export default async function PriceSnapshotPage() {
  return LocalePage({ params: Promise.resolve({ locale: 'en' }) });
}
