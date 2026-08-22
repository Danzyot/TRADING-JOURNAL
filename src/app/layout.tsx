import type { Metadata, Viewport } from 'next'
import { DEFAULT_LOGO, logoOrDefault, logoPath } from '@/lib/logos'
import { getSettings } from '@/server/settings'
import { NavigationFallback } from '@/components/navigation-fallback'
import { ServiceWorker } from '@/components/service-worker'
import './globals.css'

/**
 * Resolved per request so the chosen mark reaches the tab icon and, more
 * importantly, iOS — which reads apple-touch-icon out of the page HTML rather
 * than from the manifest.
 *
 * The settings read is guarded: this layout also wraps the login page, and a
 * database blip must not take the whole app down over an icon.
 */
export async function generateMetadata(): Promise<Metadata> {
  let logo = DEFAULT_LOGO
  try {
    logo = logoOrDefault((await getSettings()).logo)
  } catch {
    // Fall back to the default mark.
  }

  return {
    title: 'Trading Journal',
    description: 'Futures trading journal for prop firm accounts — performance, costs, payouts and tax.',
    manifest: '/manifest.webmanifest',
    applicationName: 'Trading Journal',
    icons: {
      icon: [{ url: logoPath(logo, 'icon-192'), sizes: '192x192' }],
      apple: logoPath(logo, 'apple-touch-icon'),
    },
    appleWebApp: {
      capable: true,
      title: 'Journal',
      statusBarStyle: 'black-translucent',
    },
    formatDetection: { telephone: false },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Keeps the layout out from under the notch and the home indicator when the
  // app runs full screen.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9f9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0d' },
  ],
}

/**
 * The theme is read and applied before first paint. Doing this in an effect
 * instead would flash the wrong theme on every navigation, which is especially
 * jarring going from a dark chart platform into a white page.
 */
const themeScript = `
try {
  var stored = localStorage.getItem('tj-theme');
  if (stored === 'dark' || stored === 'light') {
    document.documentElement.setAttribute('data-theme', stored);
  }
} catch (e) {}
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Next emits the modern `mobile-web-app-capable`; iOS has honoured the
          `apple-` prefixed name for a decade and still does, and it is what
          makes the home-screen app open without Safari's chrome.
        */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <NavigationFallback />
        <ServiceWorker />
        {children}
      </body>
    </html>
  )
}
