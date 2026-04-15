import LocalePage, { generateMetadata as generateLocaleMetadata } from '../[locale]/terminal/page';

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: 'en' }) });
}

export default async function TerminalPage() {
  return LocalePage({ params: Promise.resolve({ locale: 'en' }) });
}
