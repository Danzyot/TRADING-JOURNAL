import type { Metadata, Viewport } from 'next'
import { NavigationFallback } from '@/components/navigation-fallback'
import { ServiceWorker } from '@/components/service-worker'
import './globals.css'

export const metadata: Metadata = {
  title: 'Trading Journal',
  description: 'Futures trading journal for prop firm accounts — performance, costs, payouts and tax.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Trading Journal',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192' }],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    // Runs full screen from the home screen, without Safari's chrome — and on
    // iOS this is also the precondition for receiving push notifications.
    capable: true,
    title: 'Journal',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
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
