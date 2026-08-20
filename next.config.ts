import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // `standalone` keeps the Railway/Docker image small; Vercel ignores it.
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,

  // The SQL migrations are read from disk at boot by src/instrumentation.ts.
  // Next's tracer cannot see a runtime directory read, so the folder has to be
  // named explicitly or the serverless bundle ships without it and the database
  // never gets created.
  outputFileTracingIncludes: {
    '/**': ['./drizzle/**/*'],
  },

  // `postgres` is a Node driver that imports `net` and `tls`. Next compiles
  // instrumentation for the edge runtime as well (middleware lives there), and
  // bundling it there fails. Marking it external keeps it out of every bundle
  // and lets Node require it directly at runtime.
  serverExternalPackages: ['postgres'],

  experimental: {
    // Server Actions handle every mutation in this app; imports can be chunky.
    serverActions: { bodySizeLimit: '4mb' },
  },

  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
