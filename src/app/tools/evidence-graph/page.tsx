import LocalePage, { generateMetadata as generateLocaleMetadata } from '../../[locale]/tools/evidence-graph/page';

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: 'en' }) });
}

export default async function EvidenceGraphPage() {
  return LocalePage({ params: Promise.resolve({ locale: 'en' }) });
}
