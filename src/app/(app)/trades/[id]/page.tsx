import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { accounts, executions, modelReviews, trades, tradingModels } from '@/db/schema'
import { ActionButton, ActionForm, Disclosure, Field, SubmitButton } from '@/components/form'
import { TradeForm } from '../trade-form'
import { Badge, Card, KeyValue, PageHeader, Pnl } from '@/components/ui'
import { longDate, money, number, rMultiple } from '@/lib/format'
import { displayName, priceToTicks, tickSize } from '@/lib/symbols'
import { formatInZone, secondsToHuman } from '@/lib/time'
import { annotateTrade, deleteTrade, reviewFeedbackAction, reviewTradeAction } from '@/server/actions'
import { aiConfigured } from '@/server/ai'
import { getSettings } from '@/server/settings'
import { listAccounts } from '@/server/trades'

export const dynamic = 'force-dynamic'

const COMMON_MISTAKES = [
  'moved stop',
  'no stop',
  'oversized',
  'chased entry',
  'early exit',
  'revenge trade',
  'traded outside plan',
  'held through news',
  'averaged down',
]

export default async function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tradeId = Number(id)
  if (!Number.isFinite(tradeId)) notFound()

  const [trade] = await db.select().from(trades).where(eq(trades.id, tradeId)).limit(1)
  if (!trade) notFound()

  const [settings, fills, [account], models, [latestReview], allAccounts] = await Promise.all([
    getSettings(),
    db.select().from(executions).where(eq(executions.tradeId, tradeId)).orderBy(asc(executions.fillAt)),
    db.select().from(accounts).where(eq(accounts.id, trade.accountId)).limit(1),
    db.select().from(tradingModels).where(eq(tradingModels.active, true)).orderBy(tradingModels.name),
    db
      .select()
      .from(modelReviews)
      .where(
        and(
          eq(modelReviews.accountId, trade.accountId),
          eq(modelReviews.entryAt, trade.entryAt),
          eq(modelReviews.symbol, trade.symbol),
        ),
      )
      .orderBy(desc(modelReviews.createdAt))
      .limit(1),
    listAccounts(),
  ])

  const ccy = settings.baseCurrency
  const tz = settings.timezone
  const stopDistance =
    trade.stopPrice !== null
      ? Math.abs(trade.avgEntry - trade.stopPrice)
      : null

  return (
    <>
      <PageHeader
        title={`${trade.symbol} ${trade.direction === 'long' ? 'long' : 'short'} · ${longDate(trade.tradingDay)}`}
        subtitle={`${displayName(trade.symbol)} · ${trade.qty} contract${trade.qty === 1 ? '' : 's'} · ${account?.label ?? 'Unknown account'}`}
        actions={
          <>
            <Link href="/trades" className="btn">
              ← All trades
            </Link>
            <ActionButton
              action={async () => {
                'use server'
                return deleteTrade(tradeId)
              }}
              className="btn btn-danger"
              confirm="Delete this trade? If it was built from fills, a rebuild will bring it back."
            >
              Delete
            </ActionButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Result">
            <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
              <div className="space-y-0">
                <KeyValue label="Net P&L" value={<Pnl value={trade.netPnl} currency={ccy} />} />
                <KeyValue label="Gross P&L" value={money(trade.grossPnl, ccy)} />
                <KeyValue label="Commission" value={money(-trade.commission, ccy)} />
                <KeyValue label="Fees" value={money(-trade.fees, ccy)} />
              </div>
              <div className="space-y-0">
                <KeyValue label="Average entry" value={number(trade.avgEntry, 4)} />
                <KeyValue label="Average exit" value={trade.avgExit === null ? 'Open' : number(trade.avgExit, 4)} />
                <KeyValue label="Quantity" value={String(trade.qty)} />
                <KeyValue label="Contract" value={trade.contract ?? trade.symbol} />
              </div>
              <div className="space-y-0">
                <KeyValue
                  label="Entry"
                  value={formatInZone(trade.entryAt, tz, 'dd MMM HH:mm:ss')}
                />
                <KeyValue
                  label="Exit"
                  value={trade.exitAt ? formatInZone(trade.exitAt, tz, 'dd MMM HH:mm:ss') : '—'}
                />
                <KeyValue label="Hold time" value={secondsToHuman(trade.durationSeconds)} />
                <KeyValue label="R multiple" value={rMultiple(trade.rMultiple)} />
              </div>
            </div>

            {trade.riskBase !== null && stopDistance !== null && (
              <p className="mt-4 rounded-lg bg-[var(--surface-sunken)] p-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
                Risked {money(trade.riskBase, ccy)} — a {number(stopDistance, 2)} point stop
                ({number(priceToTicks(trade.symbol, stopDistance), 0)} ticks of{' '}
                {number(tickSize(trade.symbol), 4)}) across {trade.qty} contract
                {trade.qty === 1 ? '' : 's'}. This trade returned {rMultiple(trade.rMultiple)}.
              </p>
            )}
          </Card>

          {fills.length > 0 && (
            <Card title="Fills" description="The executions this round trip was built from." bodyClassName="p-0">
              <div className="scroll-x">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Side</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Price</th>
                      <th className="text-right">Cost</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fills.map((fill) => (
                      <tr key={fill.id}>
                        <td className="tabular whitespace-nowrap">
                          {formatInZone(fill.fillAt, tz, 'dd MMM HH:mm:ss')}
                        </td>
                        <td>
                          <Badge tone={fill.side === 'buy' ? 'accent' : 'neutral'}>
                            {fill.side === 'buy' ? 'Buy' : 'Sell'}
                          </Badge>
                        </td>
                        <td className="tabular text-right">{fill.qty}</td>
                        <td className="tabular text-right">{number(fill.fillPrice, 4)}</td>
                        <td className="tabular text-right">{money(fill.commission + fill.fees, ccy)}</td>
                        <td className="text-xs">{fill.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card
            title="Model check"
            description="The AI judges the trade against your own written rules — outcome-blind. A losing trade that followed the model fits; a winner that broke it is a violation."
          >
            {trade.modelId === null ? (
              <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">
                No model assigned. Pick one in the journal panel {models.length === 0 && '— you have none yet: define your setups on the '}
                {models.length === 0 && (
                  <Link href="/models" className="text-[var(--accent)] hover:underline">
                    Models page
                  </Link>
                )}
                {models.length === 0 ? ' first.' : 'and save, then check it here.'}
              </p>
            ) : (
              <>
                {trade.modelReview ? (
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          trade.modelReview.verdict === 'fits'
                            ? 'good'
                            : trade.modelReview.verdict === 'partial'
                              ? 'warn'
                              : trade.modelReview.verdict === 'violation'
                                ? 'critical'
                                : 'neutral'
                        }
                      >
                        {trade.modelReview.verdict}
                      </Badge>
                      <span className="tabular text-xs font-medium text-[var(--ink)]">
                        {trade.modelReview.score}/100
                      </span>
                      <span className="text-[0.6875rem] text-[var(--ink-muted)]">
                        {models.find((m) => m.id === trade.modelId)?.name ?? 'model'} ·{' '}
                        {trade.modelReview.aiModel}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
                      {trade.modelReview.reasoning}
                    </p>
                    {trade.modelReview.violations.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {trade.modelReview.violations.map((violation) => (
                          <li key={violation} className="text-xs text-[var(--critical)]">
                            ✕ {violation}
                          </li>
                        ))}
                      </ul>
                    )}
                    {trade.modelReview.suggestions.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {trade.modelReview.suggestions.map((suggestion) => (
                          <li key={suggestion} className="text-xs text-[var(--ink-secondary)]">
                            → {suggestion}
                          </li>
                        ))}
                      </ul>
                    )}
                    {trade.modelReview.chartObservations && (
                      <p className="mt-2 rounded-lg bg-[var(--surface-sunken)] p-2.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
                        <span className="font-semibold text-[var(--ink)]">From the chart: </span>
                        {trade.modelReview.chartObservations}
                      </p>
                    )}

                    {latestReview && latestReview.feedback === null && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
                        <span className="text-[0.6875rem] text-[var(--ink-muted)]">
                          Is this verdict right? Your answer trains the reviewer.
                        </span>
                        <ActionForm
                          action={async (formData) => {
                            'use server'
                            return reviewFeedbackAction(latestReview.id, 'agree', formData)
                          }}
                          className="inline"
                        >
                          <SubmitButton className="btn px-2 py-1 text-[0.6875rem]">Agree</SubmitButton>
                        </ActionForm>
                        <ActionForm
                          action={async (formData) => {
                            'use server'
                            return reviewFeedbackAction(latestReview.id, 'disagree', formData)
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <input
                            name="note"
                            className="input w-48 py-1 text-[0.6875rem]"
                            placeholder="What it got wrong"
                          />
                          <SubmitButton className="btn px-2 py-1 text-[0.6875rem]">Disagree</SubmitButton>
                        </ActionForm>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">
                    Not reviewed yet.
                    {!aiConfigured() && ' Set ANTHROPIC_API_KEY in Vercel to enable the check.'}
                    {!trade.screenshotUrl &&
                      ' Tip: paste a chart screenshot URL below first — the AI then reads the chart itself against your entry rules.'}
                  </p>
                )}
                <div className="mt-3">
                  <ActionButton
                    action={async () => {
                      'use server'
                      return reviewTradeAction(tradeId)
                    }}
                    className="btn btn-primary"
                    pendingLabel="Checking against the model…"
                  >
                    {trade.modelReview ? 'Re-check with AI' : 'Check with AI'}
                  </ActionButton>
                </div>
              </>
            )}
          </Card>

          {trade.screenshotUrl && (
            <Card title="Chart">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={trade.screenshotUrl}
                alt="Trade chart screenshot"
                className="w-full rounded-lg border border-[var(--line)]"
              />
            </Card>
          )}
        </div>

        <Card
          title="Journal this trade"
          description="Recording the stop unlocks R. Naming the mistake is what makes the pattern visible later."
        >
          <ActionForm
            action={async (formData) => {
              'use server'
              return annotateTrade(tradeId, formData)
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stop price" hint="What you actually risked">
                <input
                  name="stopPrice"
                  type="number"
                  step="any"
                  defaultValue={trade.stopPrice ?? ''}
                  className="input"
                />
              </Field>
              <Field label="Target price">
                <input
                  name="targetPrice"
                  type="number"
                  step="any"
                  defaultValue={trade.targetPrice ?? ''}
                  className="input"
                />
              </Field>
            </div>

            <Field label="Model" hint="Which of your written setups this trade claims to be">
              <select name="modelId" defaultValue={trade.modelId ?? ''} className="select">
                <option value="">No model</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Setup" hint="Free-form pattern note, e.g. ORB, VWAP reclaim">
              <input name="setup" defaultValue={trade.setup ?? ''} className="input" />
            </Field>

            <Field label="Tags" hint="Comma separated">
              <input name="tags" defaultValue={trade.tags.join(', ')} className="input" />
            </Field>

            <Field label="Mistakes" hint={`Comma separated. Common: ${COMMON_MISTAKES.slice(0, 4).join(', ')}`}>
              <input name="mistakes" defaultValue={trade.mistakes.join(', ')} className="input" list="mistake-list" />
              <datalist id="mistake-list">
                {COMMON_MISTAKES.map((mistake) => (
                  <option key={mistake} value={mistake} />
                ))}
              </datalist>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Execution score" hint="1–5, how well you followed the plan">
                <input
                  name="execScore"
                  type="number"
                  min="1"
                  max="5"
                  defaultValue={trade.execScore ?? ''}
                  className="input"
                />
              </Field>
              <Field label="Emotion">
                <input name="emotion" defaultValue={trade.emotion ?? ''} className="input" placeholder="calm, rushed…" />
              </Field>
            </div>

            <Field label="Notes">
              <textarea name="notes" rows={5} defaultValue={trade.notes ?? ''} className="textarea" />
            </Field>

            <Field label="Screenshot URL" hint="Paste a TradingView snapshot link">
              <input name="screenshotUrl" defaultValue={trade.screenshotUrl ?? ''} className="input" />
            </Field>

            <SubmitButton>Save</SubmitButton>
          </ActionForm>
        </Card>
      </div>

      {!trade.autoGenerated && (
        <Card
          className="mt-4"
          title="Correct this trade"
          description="You typed this one in by hand, so every value on it can be changed — price, size, times, P&L."
        >
          <Disclosure label="Edit trade details">
            <TradeForm accounts={allAccounts} models={models} trade={trade} />
          </Disclosure>
        </Card>
      )}
    </>
  )
}
