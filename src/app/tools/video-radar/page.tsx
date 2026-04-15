import LocalePage, { generateMetadata as generateLocaleMetadata } from '../../[locale]/tools/video-radar/page';

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: 'en' }) });
}

export default async function VideoRadarPage() {
  return LocalePage({ params: Promise.resolve({ locale: 'en' }) });
}
