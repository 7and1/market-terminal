import LocalePage, { generateMetadata as generateLocaleMetadata } from '../../[locale]/asset/[key]/page';

type Props = {
  params: Promise<{ key: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { key } = await params;
  return generateLocaleMetadata({ params: Promise.resolve({ locale: 'en', key }) });
}

export default async function AssetPage({ params }: Props) {
  const { key } = await params;
  return LocalePage({ params: Promise.resolve({ locale: 'en', key }) });
}
