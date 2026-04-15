import LocalePage, { generateMetadata as generateLocaleMetadata } from '../[locale]/how-it-works/page';

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: 'en' }) });
}

export default async function HowItWorksPage() {
  return LocalePage({ params: Promise.resolve({ locale: 'en' }) });
}
