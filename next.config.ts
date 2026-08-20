import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // `standalone` keeps the Railway/Docker image small; Vercel ignores it.
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  experimental: {
    // Server Actions handle every mutation in this app; imports can be chunky.
    serverActions: { bodySizeLimit: '4mb' },
  },
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
