import LocalePage, { generateMetadata as generateLocaleMetadata } from '../../[locale]/tools/market-analyzer/page';

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: 'en' }) });
}

export default async function MarketAnalyzerPage() {
  return LocalePage({ params: Promise.resolve({ locale: 'en' }) });
}
