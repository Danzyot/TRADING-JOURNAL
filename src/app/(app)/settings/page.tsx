import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { brokerConnections, syncLog } from '@/db/schema'
import { ActionButton, ActionForm, Disclosure, Field, SubmitButton } from '@/components/form'
import { Badge, Card, EmptyState, KeyValue, PageHeader } from '@/components/ui'
import { titleCase } from '@/lib/format'
import { DEFAULT_RISK_RULES } from '@/server/settings'
import {
  createConnection,
  deleteConnection,
  refreshInsights,
  runSync,
  saveGeneralSettings,
  saveRiskRules,
  syncAllBrokers,
} from '@/server/actions'
import { getSettings } from '@/server/settings'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Settings — Trading Journal' }

const TIMEZONES = [
  'Asia/Jerusalem',
  'America/New_York',
  'America/Chicago',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Bangkok',
  'Asia/Tokyo',
  'UTC',
]

export default async function SettingsPage() {
  const [settings, connections, logs] = await Promise.all([
    getSettings(),
    db.select().from(brokerConnections).orderBy(desc(brokerConnections.createdAt)),
    db.select().from(syncLog).orderBy(desc(syncLog.ranAt)).limit(15),
  ])

  const rules = settings.riskRules ?? DEFAULT_RISK_RULES

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="How the app reads your data, and what it connects to."
        actions={
          <>
            <ActionButton action={refreshInsights} pendingLabel="Analysing…">
              Refresh insights
            </ActionButton>
            <ActionButton action={syncAllBrokers} className="btn btn-primary" pendingLabel="Syncing…">
              Sync now
            </ActionButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="General">
          <ActionForm action={saveGeneralSettings} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Display name">
                <input name="displayName" defaultValue={settings.displayName} className="input" />
              </Field>
              <Field label="Reporting currency" hint="Trading is in USD; life is in ILS. Pick what you want totals in.">
                <select name="baseCurrency" defaultValue={settings.baseCurrency} className="select">
                  <option value="USD">USD</option>
                  <option value="ILS">ILS</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Timezone" hint="Sessions, weekdays and hour-of-day analysis are all bucketed in this zone.">
                <select name="timezone" defaultValue={settings.timezone} className="select">
                  {TIMEZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Trading day boundary"
                hint='Leave at 00:00 for calendar days. Set 18:00 to follow the CME session, where an evening fill belongs to the next day.'
              >
                <input name="dayBoundary" type="time" defaultValue={settings.dayBoundary} className="input" />
              </Field>
            </div>

            <Field label="USD → ILS rate" hint="Used to convert payouts and costs for the tax estimate.">
              <input name="usdIls" type="number" step="0.001" defaultValue={settings.usdIls} className="input" />
            </Field>

            <SubmitButton>Save settings</SubmitButton>
          </ActionForm>
        </Card>

        <Card title="Risk rules" description="What the insights engine measures your behaviour against.">
          <ActionForm action={saveRiskRules} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max trades per day">
                <input name="maxTradesPerDay" type="number" defaultValue={rules.maxTradesPerDay} className="input" />
              </Field>
              <Field label="Max daily loss">
                <input
                  name="maxLossPerDayBase"
                  type="number"
                  step="any"
                  defaultValue={rules.maxLossPerDayBase}
                  className="input"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Max consecutive losses" hint="Stop for the day at this many.">
                <input
                  name="maxConsecutiveLosses"
                  type="number"
                  defaultValue={rules.maxConsecutiveLosses}
                  className="input"
                />
              </Field>
              <Field label="Max daily loss in R">
                <input name="maxDailyLossR" type="number" step="0.5" defaultValue={rules.maxDailyLossR} className="input" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Session start" hint="Local time">
                <input name="sessionStart" type="time" defaultValue={rules.sessionStart} className="input" />
              </Field>
              <Field label="Session end">
                <input name="sessionEnd" type="time" defaultValue={rules.sessionEnd} className="input" />
              </Field>
            </div>

            <Field label="Max risk per trade (%)" hint="As a share of account size.">
              <input
                name="maxRiskPercentPerTrade"
                type="number"
                step="0.1"
                defaultValue={rules.maxRiskPercentPerTrade * 100}
                className="input"
              />
            </Field>

            <SubmitButton>Save rules</SubmitButton>
          </ActionForm>
        </Card>
      </div>

      {/* --- Broker connections --------------------------------------------- */}
      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">Broker connections</h2>
            <p className="text-xs text-[var(--ink-secondary)]">
              Credentials are encrypted with AES-256-GCM before they touch the database and never leave the server.
            </p>
          </div>
          <Disclosure label="Add Tradovate connection">
            <ConnectionForm />
          </Disclosure>
        </div>

        {connections.length === 0 ? (
          <Card>
            <EmptyState
              title="No connections"
              body="Tradovate is the only broker here with a usable retail API. Rithmic licenses R|API+ through your FCM under a professional agreement, and Tradecopia connects outward to brokers rather than offering an API to you — for both, use CSV import."
              action={{ href: '/import', label: 'Import a CSV instead' }}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {connections.map((connection) => (
              <Card
                key={connection.id}
                title={connection.label}
                description={`${titleCase(connection.provider)} · ${connection.environment}`}
                actions={
                  <Badge
                    tone={
                      connection.lastSyncStatus === 'ok'
                        ? 'good'
                        : connection.lastSyncStatus === 'error'
                          ? 'critical'
                          : 'neutral'
                    }
                  >
                    {connection.lastSyncStatus ? titleCase(connection.lastSyncStatus) : 'Never synced'}
                  </Badge>
                }
              >
                <KeyValue
                  label="Last synced"
                  value={connection.lastSyncedAt ? connection.lastSyncedAt.toLocaleString() : 'Never'}
                />
                <KeyValue label="Enabled" value={connection.enabled ? 'Yes' : 'No'} />

                {connection.lastSyncError && (
                  <p className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] p-2.5 text-xs text-[var(--critical)]">
                    {connection.lastSyncError}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionButton
                    action={async () => {
                      'use server'
                      return runSync(connection.id)
                    }}
                    pendingLabel="Syncing…"
                  >
                    Sync this connection
                  </ActionButton>
                  <ActionButton
                    action={async () => {
                      'use server'
                      return deleteConnection(connection.id)
                    }}
                    className="btn btn-danger"
                    confirm="Remove this connection and its stored credentials?"
                  >
                    Remove
                  </ActionButton>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* --- Automation ------------------------------------------------------ */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Automation" description="What runs on its own once deployed.">
          <div className="space-y-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
            <p>
              Four scheduled jobs run against <code>/api/cron/*</code>, authorised by the{' '}
              <code>CRON_SECRET</code> bearer token. On Vercel they are declared in{' '}
              <code>vercel.json</code>; anywhere else, point a scheduler at the same URLs.
            </p>
            <dl className="space-y-2">
              <Entry
                name="daily"
                schedule="once a day"
                detail="Logs subscription charges that have fallen due, refreshes the USD/ILS rate, rebuilds trades and regenerates insights."
              />
              <Entry
                name="sync"
                schedule="once a day"
                detail="Pulls fills and balances from every enabled broker connection, then rebuilds trades."
              />
            </dl>
            <p>
              Two jobs, both daily, because Vercel&apos;s Hobby plan rejects any cron that fires more than
              once a day. On Pro you can raise the sync to <code>*/30 * * * *</code> in{' '}
              <code>vercel.json</code> for near-live data. Either way, <strong>Sync brokers</strong> at the top
              of the dashboard runs it on demand.
            </p>
            <p>
              <code>/api/cron/fx</code> and <code>/api/cron/insights</code> still exist and can be called
              directly; the daily job just does their work too.
            </p>
            <p>
              A TradingView alert can post to <code>/api/webhook/tradingview</code> with the same token to record
              intended stops and targets as they are placed.
            </p>
          </div>
        </Card>

        <Card title="Recent automated runs" bodyClassName="p-0">
          {logs.length === 0 ? (
            <EmptyState title="Nothing has run yet" body="Scheduled jobs will report here once the app is deployed." />
          ) : (
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Job</th>
                    <th>Status</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="tabular whitespace-nowrap text-xs">{log.ranAt.toLocaleString()}</td>
                      <td className="text-xs">{log.job}</td>
                      <td>
                        <Badge tone={log.status === 'ok' ? 'good' : log.status === 'error' ? 'critical' : 'neutral'}>
                          {log.status}
                        </Badge>
                      </td>
                      <td className="max-w-[280px] truncate text-xs">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

function Entry({ name, schedule, detail }: { name: string; schedule: string; detail: string }) {
  return (
    <div>
      <dt className="font-medium text-[var(--ink)]">
        <code>/api/cron/{name}</code> — {schedule}
      </dt>
      <dd className="text-[var(--ink-muted)]">{detail}</dd>
    </div>
  )
}

function ConnectionForm() {
  return (
    <Card>
      <ActionForm action={createConnection} className="space-y-3" resetOnSuccess>
        <p className="rounded-lg bg-[var(--surface-sunken)] p-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
          API access is requested from Tradovate directly — they issue the app id, cid and secret. Sign in
          through the Tradovate web platform at least once before syncing, or the first request comes back
          asking for a captcha. Tradovate also penalises repeated password logins, so this app reuses its access
          token between runs rather than re-authenticating each time.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Label" hint="How you refer to it here">
            <input name="label" className="input" required placeholder="Tradovate live" />
          </Field>
          <Field label="Provider">
            <select name="provider" className="select" defaultValue="tradovate">
              <option value="tradovate">Tradovate</option>
            </select>
          </Field>
          <Field label="Environment">
            <select name="environment" className="select" defaultValue="live">
              <option value="live">Live</option>
              <option value="demo">Demo</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Username">
            <input name="name" className="input" required autoComplete="off" />
          </Field>
          <Field label="Password">
            <input name="password" type="password" className="input" required autoComplete="new-password" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="App id">
            <input name="appId" className="input" required />
          </Field>
          <Field label="App version">
            <input name="appVersion" className="input" defaultValue="1.0" />
          </Field>
          <Field label="cid">
            <input name="cid" className="input" required />
          </Field>
          <Field label="sec">
            <input name="sec" type="password" className="input" required autoComplete="new-password" />
          </Field>
        </div>

        <SubmitButton>Save connection</SubmitButton>
      </ActionForm>
    </Card>
  )
}
