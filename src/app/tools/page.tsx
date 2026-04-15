import LocalePage, { generateMetadata as generateLocaleMetadata } from '../[locale]/tools/page';

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: 'en' }) });
}

export default async function ToolsPage() {
  return LocalePage({ params: Promise.resolve({ locale: 'en' }) });
}
