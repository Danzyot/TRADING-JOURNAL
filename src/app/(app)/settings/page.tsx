import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { brokerConnections, syncLog } from '@/db/schema'
import { FIRM_DOMAINS } from '@/lib/email/parse'
import { recentEmailEvents } from '@/server/email-ingest'
import { mailboxProblems, mailboxes } from '@/server/gmail'
import { listDevices, pushConfigured, vapidPublicKey } from '@/server/push'
import { PushSetup } from '@/components/push-setup'
import { LogoPicker } from '@/components/logo-picker'
import { logoOrDefault } from '@/lib/logos'
import { ActionButton, ActionForm, Disclosure, Field, SubmitButton } from '@/components/form'
import { Badge, Card, EmptyState, KeyValue, PageHeader } from '@/components/ui'
import { titleCase } from '@/lib/format'
import { DEFAULT_RISK_RULES } from '@/server/settings'
import {
  checkInbox,
  createConnection,
  saveLogo,
  registerPushDevice,
  removePushDevice,
  sendTestNotification,
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
  const [settings, connections, logs, emailLog, devices] = await Promise.all([
    getSettings(),
    db.select().from(brokerConnections).orderBy(desc(brokerConnections.createdAt)),
    db.select().from(syncLog).orderBy(desc(syncLog.ranAt)).limit(15),
    recentEmailEvents(8),
    listDevices(),
  ])

  const inboxes = mailboxes()
  const inboxProblems = mailboxProblems()

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
              action={{ href: '/trades', label: 'Import a CSV instead' }}
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
              The scheduled jobs run against <code>/api/cron/*</code>, authorised by the{' '}
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
              <Entry
                name="email"
                schedule="twice a day, from GitHub Actions"
                detail="Reads the prop-firm inboxes and logs payouts, evaluation fees, account passes and failures, daily balances and subscription changes. The daily job runs it too, so it still works with no Action configured."
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

        <Card
          title="Trade watcher — track trades automatically all day"
          description="A small script for your trading computer: it uploads any CSV you export and pumps the broker sync every few minutes, so trades appear in the journal minutes after you take them."
        >
          <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
            <li>
              Install <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">Node.js</a> (LTS) if you don&apos;t have it.
            </li>
            <li>
              Make a folder, e.g. <code>C:\trading</code>, and download both files into it:{' '}
              <a href="/api/watcher/script" className="text-[var(--accent)] hover:underline" download>
                watcher.mjs
              </a>{' '}
              and{' '}
              <a href="/api/watcher/launcher" className="text-[var(--accent)] hover:underline" download>
                start-watcher.bat
              </a>{' '}
              — the launcher already contains this journal&apos;s URL and token, so there is nothing to configure.
            </li>
            <li>
              Double-click <code>start-watcher.bat</code>. It creates an <code>exports</code> folder and starts
              watching. Keep the window open while you trade.
            </li>
            <li>
              <span className="font-medium text-[var(--ink)]">Auto-start at logon (optional):</span> open
              Command Prompt as administrator and run this once (adjust the path if you used a different
              folder):
              <pre className="mt-1.5 overflow-x-auto rounded-md bg-[var(--surface-sunken)] p-2 font-mono text-[0.6875rem] leading-relaxed">
                schtasks /Create /TN &quot;Trading journal watcher&quot; /SC ONLOGON /TR &quot;C:\trading\start-watcher.bat&quot;
              </pre>
              Undo anytime with{' '}
              <code>schtasks /Delete /TN &quot;Trading journal watcher&quot; /F</code>.
            </li>
          </ol>
          <div className="mt-3 space-y-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
            <p>
              <strong className="text-[var(--ink)]">Tradovate accounts:</strong> nothing more to do — the watcher
              triggers the sync every 5 minutes, so fills arrive on their own.
            </p>
            <p>
              <strong className="text-[var(--ink)]">Rithmic / Tradecopia / NinjaTrader:</strong> make a subfolder
              inside <code>exports</code> named exactly like the account (its label or broker id), and export the
              platform&apos;s CSV into it whenever you finish trading. The upload, matching and dedupe happen by
              themselves — re-exporting the same file never double-imports.
            </p>
            <p className="text-[var(--ink-muted)]">
              The launcher contains your machine token; treat the file like a password. Full details in
              docs/WATCHER.md.
            </p>
          </div>
        </Card>

        <Card
          title="App icon"
          description="The mark used in the sidebar, the browser tab and on your phone's home screen."
        >
          <LogoPicker current={logoOrDefault(settings.logo)} save={saveLogo} />
        </Card>

        <NotificationsCard
          configured={pushConfigured()}
          publicKey={vapidPublicKey()}
          devices={devices}
        />

        <EmailAutomationCard
          inboxes={inboxes.map((box) => box.user)}
          problems={inboxProblems}
          events={emailLog}
        />

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

/**
 * Notifications on the phone.
 *
 * The interesting half is client-side (permissions, service worker, the push
 * subscription) and lives in PushSetup; this is the frame around it, plus the
 * list of devices so a phone that was replaced can be removed.
 */
function NotificationsCard({
  configured,
  publicKey,
  devices,
}: {
  configured: boolean
  publicKey: string | null
  devices: { id: number; label: string | null; createdAt: Date; lastSentAt: Date | null }[]
}) {
  return (
    <Card
      title="Notifications on your phone"
      description="Payouts approved and paid, accounts passed or blown, daily balances — pushed to your home-screen app the moment the journal learns about them."
    >
      {configured ? (
        <div className="space-y-3">
          <PushSetup publicKey={publicKey} save={registerPushDevice} test={sendTestNotification} />

          {devices.length > 0 && (
            <ul className="space-y-1.5 border-t border-[var(--line)] pt-3">
              {devices.map((device) => (
                <li key={device.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[var(--ink-secondary)]">
                    {device.label ?? 'Device'}{' '}
                    <span className="text-[var(--ink-muted)]">
                      · added {device.createdAt.toLocaleDateString()}
                      {device.lastSentAt && ` · last alert ${device.lastSentAt.toLocaleDateString()}`}
                    </span>
                  </span>
                  <ActionButton
                    action={async () => {
                      'use server'
                      return removePushDevice(device.id)
                    }}
                    className="btn btn-danger px-2 py-0.5 text-xs"
                    confirm="Stop sending notifications to this device?"
                  >
                    Remove
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
          <p>
            Notifications need a VAPID key pair — one command, once, and they are free forever. Run{' '}
            <code>npm run push:keys</code>, then add <code>VAPID_PUBLIC_KEY</code>,{' '}
            <code>VAPID_PRIVATE_KEY</code> and <code>VAPID_SUBJECT</code> (your email as{' '}
            <code>mailto:you@example.com</code>) to Vercel and redeploy.
          </p>
          <p className="text-[var(--ink-muted)]">
            On iPhone the app must be added to the home screen first — Safari tabs cannot receive
            notifications. Full details in docs/NOTIFICATIONS.md.
          </p>
        </div>
      )}
    </Card>
  )
}

/**
 * Setting up the email automation, or showing what it has found.
 *
 * The setup half is deliberately a short list of literal steps: this is the
 * one feature whose configuration lives entirely outside the app, so the page
 * has to carry the instructions rather than assume anyone remembers them.
 */
function EmailAutomationCard({
  inboxes,
  problems,
  events,
}: {
  inboxes: string[]
  problems: string[]
  events: { id: number; kind: string; summary: string | null; createdAt: Date }[]
}) {
  const configured = inboxes.length > 0

  return (
    <Card
      title="Email automation — payouts, fees and account changes"
      description="Reads your prop-firm mail on the server and logs what it finds: payouts requested and paid, evaluation fees, accounts passed or blown, daily balances, subscription changes. Nothing has to be running on your computer."
    >
      {configured ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="good">{inboxes.length === 1 ? 'Connected' : `${inboxes.length} inboxes`}</Badge>
            <span className="text-xs text-[var(--ink-secondary)]">
              {inboxes.join(', ')} — watching {FIRM_DOMAINS.length} firms, twice a day.
            </span>
          </div>

          {problems.length > 0 && <ProblemList problems={problems} />}

          {/* Each button is boxed so that a long result message wraps under its
              own button instead of widening the row and pushing the next one
              onto a line of its own. */}
          <div className="flex flex-wrap items-start gap-2">
            <div className="max-w-[16rem]">
              <ActionButton action={checkInbox.bind(null, 3)} className="btn" pendingLabel="Reading…">
                Check inbox now
              </ActionButton>
            </div>
            <div className="max-w-[16rem]">
              <ActionButton action={checkInbox.bind(null, 30)} className="btn" pendingLabel="Backfilling…">
                Backfill 30 days
              </ActionButton>
            </div>
          </div>

          {events.length === 0 ? (
            <p className="text-xs text-[var(--ink-muted)]">
              Nothing found yet. Backfilling reads the last 30 days — re-reading the same mail never logs
              anything twice.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {events.map((event) => (
                <li key={event.id} className="flex items-start gap-2 text-xs">
                  <Badge tone={TONES[event.kind] ?? 'neutral'}>{titleCase(event.kind.replace(/_/g, ' '))}</Badge>
                  <span className="min-w-0 flex-1 text-[var(--ink-secondary)]">{event.summary}</span>
                  <span className="whitespace-nowrap tabular text-[var(--ink-muted)]">
                    {event.createdAt.toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {problems.length > 0 && <ProblemList problems={problems} />}
          <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
            <li>
              Turn on 2-Step Verification for your Google account, then create an app password at{' '}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                myaccount.google.com/apppasswords
              </a>
              . Google shows 16 characters — copy them.
            </li>
            <li>
              In Vercel → your project → Settings → Environment Variables, add{' '}
              <code>GMAIL_USER</code> (your address) and <code>GMAIL_APP_PASSWORD</code> (those 16
              characters), scoped to Production, then redeploy.
            </li>
            <li>
              For several inboxes, number them instead: <code>GMAIL_USER_1</code> /{' '}
              <code>GMAIL_APP_PASSWORD_1</code>, <code>GMAIL_USER_2</code> /{' '}
              <code>GMAIL_APP_PASSWORD_2</code>, and so on. (<code>GMAIL_ACCOUNTS</code> with{' '}
              <code>address:apppassword</code> per line works too.)
            </li>
            <li>
              Scheduled checks run from the <code>Email ingest</code> GitHub Action twice a day — add{' '}
              <code>JOURNAL_URL</code> and <code>CRON_SECRET</code> in the repository&apos;s Actions secrets to
              enable it. <code>CRON_SECRET</code> must match this app&apos;s environment variable exactly, or
              every run fails with a 401. Without the Action the daily cron still reads the mail once a day.
            </li>
          </ol>
          <p className="text-xs text-[var(--ink-muted)]">
            The app password only reads mail, is revocable on its own, and is never shown again after setup.
            Mailboxes are opened read-only — the automation cannot send, label or delete anything. Full
            details in docs/EMAIL.md.
          </p>
        </div>
      )}
    </Card>
  )
}

/**
 * Names configuration that was clearly meant to work but cannot.
 *
 * An address whose password is missing reads as "connected" everywhere else
 * while that inbox is never opened — the quietest possible failure, and the
 * one most likely after adding a second account.
 */
function ProblemList({ problems }: { problems: string[] }) {
  return (
    <div className="rounded-md border border-[var(--warning)]/40 bg-[var(--surface-sunken)] p-2.5">
      <p className="text-xs font-medium text-[var(--ink)]">Not being read:</p>
      <ul className="mt-1 space-y-0.5">
        {problems.map((problem) => (
          <li key={problem} className="text-xs text-[var(--ink-secondary)]">
            {problem}
          </li>
        ))}
      </ul>
    </div>
  )
}

const TONES: Record<string, 'good' | 'critical' | 'warn' | 'neutral'> = {
  payout: 'good',
  purchase: 'warn',
  account_status: 'critical',
  balance_snapshot: 'neutral',
  subscription: 'neutral',
  note: 'neutral',
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
