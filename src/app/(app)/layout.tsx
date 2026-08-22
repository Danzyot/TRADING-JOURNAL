import { Shell } from '@/components/shell'
import { SiteTextProvider, TextLayer } from '@/components/site-text'
import { saveSiteText } from '@/server/actions'
import { getSiteText } from '@/server/site-text'
import { getSettings } from '@/server/settings'
import { logoOrDefault, logoPath } from '@/lib/logos'
import { demoMode } from '@/lib/demo'

export const dynamic = 'force-dynamic'

/**
 * The overrides are read once here and handed to the whole tree, so making
 * every heading in the app rewritable costs a single query per page rather
 * than one per heading.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [overrides, settings] = await Promise.all([getSiteText(), getSettings()])
  const logo = logoPath(logoOrDefault(settings.logo), 'icon-64')

  return (
    <SiteTextProvider overrides={overrides} save={saveSiteText}>
      <Shell logo={logo} demo={demoMode()}>
        {children}
      </Shell>
      {/* Sweeps the rendered page so wording nobody wrapped is editable too.
          A demo cannot rewrite anything, so it does not need the sweep. */}
      {!demoMode() && <TextLayer />}
    </SiteTextProvider>
  )
}
