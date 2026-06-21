import { expect, test, type Page } from '@playwright/test';

type RouteExpectation = {
  name: string;
  path: string;
  canonicalPath: string;
  robots?: string;
};

const reportSlug = process.env.PLAYWRIGHT_REPORT_SLUG || process.env.OPENCLAW_REPORT_SLUG;

function normalizeRobots(value: string | null) {
  return (value || '').toLowerCase().replace(/\s+/g, '');
}

async function readCanonicalPath(page: Page) {
  const href = await page.locator('link[rel="canonical"]').first().getAttribute('href');
  expect(href, 'expected canonical link').toBeTruthy();
  return new URL(href as string).pathname;
}

async function expectRoute(page: Page, route: RouteExpectation) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  const response = await page.goto(route.path, { waitUntil: 'networkidle' });
  expect(response, `${route.path} should return a response`).not.toBeNull();
  expect(response?.status(), `${route.path} should load successfully`).toBe(200);
  expect(new URL(page.url()).pathname, `${route.path} should stay on the expected pathname`).toBe(route.path);
  expect(pageErrors, `${route.path} should stay free of page errors`).toEqual([]);

  const title = (await page.title()).trim();
  expect(title.length, `${route.path} should set a title`).toBeGreaterThan(0);
  expect(await page.locator('h1').count(), `${route.path} should render an h1`).toBeGreaterThan(0);
  expect(await readCanonicalPath(page), `${route.path} should emit the expected canonical path`).toBe(
    route.canonicalPath,
  );

  const robotsLocator = page.locator('meta[name="robots"]');
  const robotsContent = normalizeRobots(
    (await robotsLocator.count()) > 0 ? await robotsLocator.first().getAttribute('content') : null,
  );

  if (route.robots) {
    expect(robotsContent, `${route.path} should emit the expected robots policy`).toBe(route.robots);
  } else {
    expect(robotsContent, `${route.path} should stay indexable`).not.toContain('noindex');
  }
}

const routes: RouteExpectation[] = [
  {
    name: 'root landing stays unprefixed',
    path: '/',
    canonicalPath: '/',
  },
  {
    name: 'asset index stays indexable',
    path: '/asset',
    canonicalPath: '/asset',
  },
  {
    name: 'trending stays indexable',
    path: '/trending',
    canonicalPath: '/trending',
  },
  {
    name: 'tools stays reachable but noindex',
    path: '/tools',
    canonicalPath: '/tools',
    robots: 'noindex,follow',
  },
  {
    name: 'terminal stays reachable but noindex',
    path: '/terminal',
    canonicalPath: '/terminal',
    robots: 'noindex,nofollow',
  },
];

for (const route of routes) {
  test(route.name, async ({ page }) => {
    await expectRoute(page, route);
  });
}

test('english root stays unprefixed while /en remains reachable', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(new URL(page.url()).pathname).toBe('/');

  await page.goto('/en', { waitUntil: 'networkidle' });
  expect(new URL(page.url()).pathname).toBe('/en');
});

test('current report stays indexable', async ({ page }) => {
  test.skip(!reportSlug, 'PLAYWRIGHT_REPORT_SLUG or OPENCLAW_REPORT_SLUG is required for report coverage');

  await expectRoute(page, {
    name: 'current report',
    path: `/report/${reportSlug}`,
    canonicalPath: `/report/${reportSlug}`,
  });
});
