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

  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
