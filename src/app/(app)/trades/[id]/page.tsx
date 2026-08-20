import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { accounts, executions, trades } from '@/db/schema'
import { ActionButton, ActionForm, Field, SubmitButton } from '@/components/form'
import { Badge, Card, KeyValue, PageHeader, Pnl } from '@/components/ui'
import { longDate, money, number, rMultiple } from '@/lib/format'
import { displayName, priceToTicks, tickSize } from '@/lib/symbols'
import { formatInZone, secondsToHuman } from '@/lib/time'
import { annotateTrade, deleteTrade } from '@/server/actions'
import { getSettings } from '@/server/settings'

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

  const [settings, fills, [account]] = await Promise.all([
    getSettings(),
    db.select().from(executions).where(eq(executions.tradeId, tradeId)).orderBy(asc(executions.fillAt)),
    db.select().from(accounts).where(eq(accounts.id, trade.accountId)).limit(1),
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

            <Field label="Setup" hint="The pattern you traded, e.g. ORB, VWAP reclaim">
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
    </>
  )
}
