import LocalePage, { generateMetadata as generateLocaleMetadata } from '../../[locale]/tools/api/page';

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: 'en' }) });
}

export default async function ToolsApiPage() {
  return LocalePage({ params: Promise.resolve({ locale: 'en' }) });
}
