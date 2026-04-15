import LocalePage, { generateMetadata as generateLocaleMetadata } from '../../[locale]/tools/news-analyzer/page';

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: 'en' }) });
}

export default async function NewsAnalyzerPage() {
  return LocalePage({ params: Promise.resolve({ locale: 'en' }) });
}
