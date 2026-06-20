import type { MetadataRoute } from 'next';
import { listAssetArchiveDates, listCurrentPublished, listPublished } from '@/lib/db';
import { filterPublishableSessions, summarizeSessionQuality } from '@/lib/report-quality';
import { isSeededAssetKey, isSeededCanonicalHeadKey } from '@/lib/topic-catalog';

export const dynamic = 'force-dynamic';

const locales = ['en', 'es', 'zh'] as const;

function localizedEntry(
  baseUrl: string,
  path: string,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
): MetadataRoute.Sitemap[number] {
  return {
    url: `${baseUrl}${path}`,
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${baseUrl}${l === 'en' ? '' : `/${l}`}${path}`]),
        ['x-default', `${baseUrl}${path}`],
      ]),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai';

  const staticPages: MetadataRoute.Sitemap = [
    localizedEntry(baseUrl, '', 'daily', 1.0),
    localizedEntry(baseUrl, '/asset', 'daily', 0.8),
    localizedEntry(baseUrl, '/trending', 'daily', 0.9),
  ];

  try {
    const published = filterPublishableSessions(await listPublished(5000));
    const [currentPublished, archiveDates] = await Promise.all([
      listCurrentPublished(5000).then((items) => items.filter((item) => summarizeSessionQuality(item.session).publishable)),
      listAssetArchiveDates(5000).catch(() => []),
    ]);

    const reportPages: MetadataRoute.Sitemap = currentPublished
      .filter((item) => isSeededCanonicalHeadKey(item.head.subjectKey))
      .filter((item) => item.session.slug)
      .sort((a, b) => a.session.slug!.localeCompare(b.session.slug!))
      .map((item) => localizedEntry(baseUrl, `/report/${item.session.slug}`, 'monthly', 0.7));

    const assetKeys = new Set<string>();
    for (const s of published) {
      if (s.assetKey && isSeededAssetKey(s.assetKey)) assetKeys.add(s.assetKey);
    }
    const assetPages: MetadataRoute.Sitemap = Array.from(assetKeys).sort((a, b) => a.localeCompare(b)).map((key) =>
      localizedEntry(baseUrl, `/asset/${key}`, 'daily', 0.7),
    );
    const archivePages: MetadataRoute.Sitemap = archiveDates
      .filter((item) => item.assetKey && item.metricDate)
      .filter((item) => isSeededAssetKey(item.assetKey))
      .sort((a, b) => a.assetKey.localeCompare(b.assetKey) || b.metricDate.localeCompare(a.metricDate))
      .map((item) => localizedEntry(baseUrl, `/asset/${item.assetKey}/archive/${item.metricDate}`, 'weekly', 0.45));

    return [...staticPages, ...reportPages, ...assetPages, ...archivePages];
  } catch {
    return staticPages;
  }
}
