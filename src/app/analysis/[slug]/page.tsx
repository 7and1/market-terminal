import LocalePage from '../../[locale]/analysis/[slug]/page';

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function AnalysisPage({ params }: Props) {
  const { slug } = await params;
  return LocalePage({ params: Promise.resolve({ locale: 'en', slug }) });
}
