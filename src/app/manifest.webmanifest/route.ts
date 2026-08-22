import { NextResponse } from 'next/server'
import { DEFAULT_LOGO, logoOrDefault, logoPath } from '@/lib/logos'
import { getSettings } from '@/server/settings'

export const dynamic = 'force-dynamic'

/**
 * The installable-app manifest, naming whichever mark is currently chosen.
 *
 * Served from a route rather than a static file so changing the logo in
 * Settings changes the icon a phone installs, with no redeploy. It is public
 * (see the middleware): iOS fetches it before anyone signs in, and it exposes
 * nothing beyond the app's name and its icons.
 */
export async function GET() {
  let logo = DEFAULT_LOGO
  try {
    logo = logoOrDefault((await getSettings()).logo)
  } catch {
    // An unreachable database must not stop the app installing.
  }

  return NextResponse.json(
    {
      name: 'Trading Journal',
      short_name: 'Journal',
      description: 'Futures trading journal — performance, costs, payouts and tax.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#0d0d0d',
      theme_color: '#0d0d0d',
      icons: [
        { src: logoPath(logo, 'icon-192'), sizes: '192x192', type: 'image/png' },
        { src: logoPath(logo, 'icon-512'), sizes: '512x512', type: 'image/png' },
        { src: logoPath(logo, 'icon-512'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: 'Log a trade', url: '/trades/new' },
        { name: 'Earnings and expenses', url: '/money' },
        { name: 'Journal', url: '/journal' },
      ],
    },
    {
      headers: {
        'content-type': 'application/manifest+json',
        // Short cache: the icon should follow a change in Settings quickly,
        // but the manifest is fetched on every install and launch.
        'cache-control': 'public, max-age=60',
      },
    },
  )
}
