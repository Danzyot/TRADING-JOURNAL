import { Shell } from '@/components/shell'
import { SiteTextProvider } from '@/components/site-text'
import { saveSiteText } from '@/server/actions'
import { getSiteText } from '@/server/site-text'

export const dynamic = 'force-dynamic'

/**
 * The overrides are read once here and handed to the whole tree, so making
 * every heading in the app rewritable costs a single query per page rather
 * than one per heading.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const overrides = await getSiteText()

  return (
    <SiteTextProvider overrides={overrides} save={saveSiteText}>
      <Shell>{children}</Shell>
    </SiteTextProvider>
  )
}
