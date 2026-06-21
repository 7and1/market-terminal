import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  // Pin the file-tracing / workspace root to this project. Without it, Next
  // infers a parent directory when multiple lockfiles exist up the tree (e.g.
  // the OpenClaw test workspace) and nests the standalone server under
  // `.next/standalone/<inferred-path>/server.js`, which breaks
  // scripts/openclaw-preview.sh. In the clean Docker build cwd is already the
  // project root, so this is a no-op there.
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
};

export default withNextIntl(nextConfig);
