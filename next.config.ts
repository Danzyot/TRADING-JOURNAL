import type { NextConfig } from 'next'
import { isDemoDeployment } from './src/lib/demo'

const nextConfig: NextConfig = {
  // `standalone` keeps the Railway/Docker image small; Vercel ignores it.
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,

  // src/db/bootstrap.ts reads the SQL migrations from disk on first use. Next's
  // tracer cannot see a runtime directory read, so the folder has to be named
  // explicitly — otherwise the serverless bundle ships without it and the
  // database never gets created.
  outputFileTracingIncludes: {
    '/**': [
      './drizzle/**/*',
      // The demo runs Postgres in-process (see src/db/index.ts). Its WebAssembly
      // and data files are loaded by path at runtime, which the tracer cannot
      // see, so a serverless bundle would ship the package without the database
      // inside it.
      './node_modules/@electric-sql/pglite/dist/*',
    ],
    // The Settings page serves the local trade watcher for download.
    '/api/watcher/script': ['./tools/watcher.mjs'],
  },

  // `postgres` is a Node driver that imports `net` and `tls`. Middleware runs on
  // the edge runtime, where bundling those fails. Marking it external keeps the
  // driver out of every bundle and lets Node require it directly at runtime.
  // `@electric-sql/pglite` is a WebAssembly module that reads its own files
  // from disk; bundling it breaks both.
  serverExternalPackages: ['postgres', '@electric-sql/pglite'],

  experimental: {
    // Server Actions handle every mutation in this app; imports can be chunky.
    serverActions: { bodySizeLimit: '4mb' },
  },

  /**
   * Stamps every asset URL with the deployment that built it.
   *
   * Without this, a page loaded before a deploy asks for script files by their
   * old hashed names, and once the previous build is pruned those return 404 —
   * the app breaks under an installed home-screen icon that is never fully
   * closed. With it, Next sees the mismatch and does a full navigation instead
   * of failing, so the copy on the phone lands on the new version by itself.
   *
   * Vercel provides the id; anywhere else falls back to undefined, which is
   * the same behaviour as before.
   */
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID || undefined,

  /**
   * Lets a CDN serve the demo.
   *
   * Every page here is force-dynamic, so Next marks each response `no-store` —
   * right for a private journal, wrong for the demo, where every visitor is
   * asking for the same sample data and each miss wakes a serverless instance
   * that has to boot and seed a database before it can answer.
   *
   * The condition is the same fail-closed rule the rest of the app uses, and it
   * matters more here than anywhere: a deployment holding real data must never
   * emit `public` on a page. `isDemoDeployment` is false whenever an
   * `APP_PASSWORD` is present, so the only build that can produce this header
   * is one with no password at all — which is also one with no private data to
   * hand to the next visitor.
   *
   * Read at build time, because that is when headers are baked. Adding a
   * password to a demo project therefore needs a redeploy to take full effect,
   * which is what Vercel does with an environment change anyway.
   */
  async headers() {
    if (!isDemoDeployment(process.env)) return []
    return [
      {
        source: '/:path((?!api/).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ]
  },

  /**
   * The framework and its version are free reconnaissance for anyone probing
   * the app; nothing legitimate reads this header.
   */
  poweredByHeader: false,

  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
