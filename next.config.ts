import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // `standalone` keeps the Railway/Docker image small; Vercel ignores it.
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,

  // src/db/bootstrap.ts reads the SQL migrations from disk on first use. Next's
  // tracer cannot see a runtime directory read, so the folder has to be named
  // explicitly — otherwise the serverless bundle ships without it and the
  // database never gets created.
  outputFileTracingIncludes: {
    '/**': ['./drizzle/**/*'],
    // The Settings page serves the local trade watcher for download.
    '/api/watcher/script': ['./tools/watcher.mjs'],
  },

  // `postgres` is a Node driver that imports `net` and `tls`. Middleware runs on
  // the edge runtime, where bundling those fails. Marking it external keeps the
  // driver out of every bundle and lets Node require it directly at runtime.
  serverExternalPackages: ['postgres'],

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

  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
