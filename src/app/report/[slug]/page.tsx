import LocalePage, { generateMetadata as generateLocaleMetadata } from '../../[locale]/report/[slug]/page';

export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return generateLocaleMetadata({ params: Promise.resolve({ locale: 'en', slug }) });
}

export default async function ReportPage({ params }: Props) {
  const { slug } = await params;
  return LocalePage({ params: Promise.resolve({ locale: 'en', slug }) });
}
