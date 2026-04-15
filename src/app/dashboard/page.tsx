import LocalePage, { generateMetadata as generateLocaleMetadata } from '../[locale]/dashboard/page';

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: 'en' }) });
}

export default async function DashboardPage() {
  return LocalePage({ params: Promise.resolve({ locale: 'en' }) });
}
