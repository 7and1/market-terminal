import LocalePage, { generateMetadata as generateLocaleMetadata } from '../../[locale]/tools/serp-explorer/page';

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: 'en' }) });
}

export default async function SerpExplorerPage() {
  return LocalePage({ params: Promise.resolve({ locale: 'en' }) });
}
