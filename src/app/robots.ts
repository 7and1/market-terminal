import type { MetadataRoute } from 'next';

const CONTROL_PLANE_PATHS = ['/api/', '/dashboard', '/terminal', '/tools'] as const;
const LOCALE_PREFIXES = ['/en', '/es', '/zh'] as const;

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    ...CONTROL_PLANE_PATHS,
    ...LOCALE_PREFIXES.flatMap((prefix) =>
      CONTROL_PLANE_PATHS.filter((path) => path !== '/api/').map((path) => `${prefix}${path}`),
    ),
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://trendanalysis.ai'}/sitemap.xml`,
  };
}
