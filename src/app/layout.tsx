import type { Metadata, Viewport } from 'next'
import { NavigationFallback } from '@/components/navigation-fallback'
import './globals.css'

export const metadata: Metadata = {
  title: 'Trading Journal',
  description: 'Futures trading journal for prop firm accounts — performance, costs, payouts and tax.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <NavigationFallback />
        {children}
      </body>
    </html>
  )
}
