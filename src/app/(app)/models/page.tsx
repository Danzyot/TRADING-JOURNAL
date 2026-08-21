import Link from 'next/link'
import { desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/db'
import { modelReviews, trades, tradingModels, type TradingModel } from '@/db/schema'
import { ActionButton, ActionForm, Disclosure, Field, SubmitButton } from '@/components/form'
import { Badge, Card, EmptyState, PageHeader, Stat, StatGrid } from '@/components/ui'
import { money, percent } from '@/lib/format'
import {
  autoTagAction,
  deleteTradingModel,
  refineModelAction,
  reviewFeedbackAction,
  reviewPendingAction,
  saveTradingModel,
} from '@/server/actions'
import { aiConfigured } from '@/server/ai'
import { getSettings } from '@/server/settings'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Models — Trading Journal' }

const VERDICT_TONE = {
  fits: 'good',
  partial: 'warn',
  violation: 'critical',
  unclear: 'neutral',
} as const

export default async function ModelsPage() {
  const [settings, models, taggedTrades, recentReviews] = await Promise.all([
    getSettings(),
    db.select().from(tradingModels).orderBy(tradingModels.name),
    db
      .select({ modelId: trades.modelId, netPnl: trades.netPnl, modelReview: trades.modelReview })
      .from(trades)
      .where(isNotNull(trades.modelId)),
    db.select().from(modelReviews).orderBy(desc(modelReviews.createdAt)).limit(60),
  ])

  const ccy = settings.baseCurrency
  const hasAi = aiConfigured()

  const statsFor = (modelId: number) => {
    const rows = taggedTrades.filter((t) => t.modelId === modelId)
    const reviewed = rows.filter((t) => t.modelReview !== null)
    const fits = reviewed.filter((t) => t.modelReview!.verdict === 'fits')
    const violations = reviewed.filter((t) => t.modelReview!.verdict === 'violation')
    const pnl = (list: typeof rows) => list.reduce((sum, t) => sum + t.netPnl, 0)
    return {
      tagged: rows.length,
      reviewed: reviewed.length,
      fitRate: reviewed.length > 0 ? fits.length / reviewed.length : null,
      pnlWhenFits: pnl(fits),
      pnlWhenViolated: pnl(violations),
      fitsCount: fits.length,
      violationCount: violations.length,
    }
  }

  const totalTagged = taggedTrades.length
  const totalReviewed = taggedTrades.filter((t) => t.modelReview !== null).length
  const gradedReviews = recentReviews.filter((r) => r.feedback !== null).length

  return (
    <>
      <PageHeader
        title="Trading models"
        subtitle="Your playbook as data: define each setup once, tag trades with it, and let the AI judge every trade against your own rules — outcome-blind."
        actions={
          <>
            <a href="/api/export/models.jsonl" className="btn" download>
              Export dataset
            </a>
            <ActionButton action={autoTagAction} pendingLabel="Classifying…">
              Auto-tag trades
            </ActionButton>
          </>
        }
      />

      {!hasAi && (
        <div className="mb-6 rounded-lg border border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] p-4 text-sm leading-relaxed text-[var(--ink)]">
          <p className="font-semibold">AI review is not connected yet.</p>
          <p className="mt-1 text-xs text-[var(--ink-secondary)]">
            Add <code className="font-mono">ANTHROPIC_API_KEY</code> to your Vercel environment
            variables (Settings → Environment Variables, then redeploy). Get a key at
            console.anthropic.com — usage is billed to that key, roughly a cent or two per trade
            review. Models, tagging and stats work without it; the Check-with-AI, auto-tag and
            refine buttons need it.
          </p>
        </div>
      )}

      <StatGrid columns={4}>
        <Card bodyClassName="p-4">
          <Stat label="Models" value={String(models.length)} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="Trades tagged" value={String(totalTagged)} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat label="AI-reviewed" value={String(totalReviewed)} />
        </Card>
        <Card bodyClassName="p-4">
          <Stat
            label="Verdicts graded"
            value={String(gradedReviews)}
            hint="Your agree/disagree is what trains the reviewer"
          />
        </Card>
      </StatGrid>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Your models</h2>
        <Disclosure label="Add model">
          <ModelForm />
        </Disclosure>
      </div>

      {models.length === 0 ? (
        <div className="mt-4">
          <Card>
            <EmptyState
              title="No models yet"
              body="A model is one entry setup written as rules: when it exists, where the entry is, where you are wrong, how you manage it. Write one, tag trades with it, and every review — human or AI — happens against the same yardstick."
            />
          </Card>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {models.map((model) => {
            const stats = statsFor(model.id)
            const reviews = recentReviews.filter((r) => r.modelId === model.id).slice(0, 4)
            return (
              <Card
                key={model.id}
                title={model.name}
                description={model.description ?? undefined}
                actions={
                  <Badge tone={model.active ? 'good' : 'neutral'}>
                    {model.active ? 'Active' : 'Retired'}
                  </Badge>
                }
              >
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                  <RuleCell label="Timeframe" value={model.timeframe} />
                  <RuleCell label="Instruments" value={model.instruments} />
                  <RuleCell label="Tagged" value={String(stats.tagged)} />
                  <RuleCell
                    label="Fit rate"
                    value={stats.fitRate === null ? '—' : percent(stats.fitRate, 0)}
                  />
                </div>

                <div className="mt-3 space-y-2 text-xs leading-relaxed">
                  <RuleBlock label="Entry" value={model.entryRules} />
                  <RuleBlock label="Exit" value={model.exitRules} />
                  <RuleBlock label="Risk" value={model.riskRules} />
                  <RuleBlock label="Void when" value={model.invalidations} />
                </div>

                {stats.reviewed > 0 && (
                  <p className="mt-3 rounded-lg bg-[var(--surface-sunken)] p-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
                    Following this model has {stats.pnlWhenFits >= 0 ? 'made' : 'lost'}{' '}
                    <span className={stats.pnlWhenFits >= 0 ? 'font-medium text-[var(--good-text)]' : 'font-medium text-[var(--critical)]'}>
                      {money(stats.pnlWhenFits, ccy, 0)}
                    </span>{' '}
                    across {stats.fitsCount} conforming trade{stats.fitsCount === 1 ? '' : 's'}
                    {stats.violationCount > 0 && (
                      <>
                        ; breaking it has {stats.pnlWhenViolated >= 0 ? 'made' : 'cost'}{' '}
                        <span className={stats.pnlWhenViolated >= 0 ? 'font-medium' : 'font-medium text-[var(--critical)]'}>
                          {money(stats.pnlWhenViolated, ccy, 0)}
                        </span>{' '}
                        across {stats.violationCount}
                      </>
                    )}
                    . That difference is what the model is worth.
                  </p>
                )}

                {model.aiGuidance && (
                  <details className="mt-3 rounded-lg border border-[var(--line)] p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-[var(--ink)]">
                      What the AI has learned about this model
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--ink-secondary)]">
                      {model.aiGuidance}
                    </p>
                  </details>
                )}

                {reviews.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-[var(--ink)]">Recent verdicts</p>
                    {reviews.map((review) => (
                      <div key={review.id} className="rounded-lg border border-[var(--line)] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={VERDICT_TONE[review.verdict]}>{review.verdict}</Badge>
                          <span className="tabular text-xs text-[var(--ink-secondary)]">
                            {review.score}/100 · {review.symbol} · {review.tradingDay}
                          </span>
                          {review.feedback && (
                            <span className="text-[0.6875rem] text-[var(--ink-muted)]">
                              you {review.feedback}d
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
                          {review.reasoning}
                        </p>
                        {review.feedback === null && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <ActionForm
                              action={async (formData) => {
                                'use server'
                                return reviewFeedbackAction(review.id, 'agree', formData)
                              }}
                              className="inline"
                            >
                              <SubmitButton className="btn px-2 py-1 text-[0.6875rem]">Agree</SubmitButton>
                            </ActionForm>
                            <ActionForm
                              action={async (formData) => {
                                'use server'
                                return reviewFeedbackAction(review.id, 'disagree', formData)
                              }}
                              className="flex items-center gap-1.5"
                            >
                              <input
                                name="note"
                                className="input w-44 py-1 text-[0.6875rem]"
                                placeholder="Why it's wrong (teaches the AI)"
                              />
                              <SubmitButton className="btn px-2 py-1 text-[0.6875rem]">Disagree</SubmitButton>
                            </ActionForm>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <ActionButton
                    action={async () => {
                      'use server'
                      return reviewPendingAction(model.id)
                    }}
                    pendingLabel="Reviewing…"
                    className="btn btn-primary"
                  >
                    AI-review tagged trades
                  </ActionButton>
                  <ActionButton
                    action={async () => {
                      'use server'
                      return refineModelAction(model.id)
                    }}
                    pendingLabel="Refining…"
                  >
                    Refine AI from feedback
                  </ActionButton>
                  <Disclosure label="Edit">
                    <ModelForm model={model} />
                  </Disclosure>
                  <ActionButton
                    action={async () => {
                      'use server'
                      return deleteTradingModel(model.id)
                    }}
                    className="btn btn-danger"
                    confirm={`Delete "${model.name}"? Trades keep their data but lose the link, and its review history goes with it.`}
                  >
                    Delete
                  </ActionButton>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-[var(--ink-muted)]">
        The dataset export is one JSON line per reviewed trade — your rules, the trade's numbers,
        the AI's label and your feedback. That file is labelled training data for the trading bots
        you want to build later: the longer you grade reviews, the better the dataset.{' '}
        <Link href="/trades" className="text-[var(--accent)] hover:underline">
          Tag trades from their detail pages →
        </Link>
      </p>
    </>
  )
}

// ---------------------------------------------------------------------------

function RuleCell({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[0.625rem] font-medium uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
      <p className="mt-0.5 text-xs text-[var(--ink)]">{value ?? '—'}</p>
    </div>
  )
}

function RuleBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <p className="text-[var(--ink-secondary)]">
      <span className="font-semibold text-[var(--ink)]">{label}: </span>
      {value}
    </p>
  )
}

function ModelForm({ model }: { model?: TradingModel }) {
  async function submit(formData: FormData) {
    'use server'
    return saveTradingModel(model?.id ?? null, formData)
  }

  return (
    <Card>
      <ActionForm action={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Name" hint="e.g. ORB 15m, VWAP reclaim">
            <input name="name" defaultValue={model?.name ?? ''} className="input" required />
          </Field>
          <Field label="Timeframe">
            <input name="timeframe" defaultValue={model?.timeframe ?? ''} className="input" placeholder="15m entry, 1h context" />
          </Field>
          <Field label="Instruments">
            <input name="instruments" defaultValue={model?.instruments ?? ''} className="input" placeholder="MNQ, NQ" />
          </Field>
        </div>

        <Field label="The idea" hint="What edge this captures, in one paragraph">
          <textarea name="description" rows={2} defaultValue={model?.description ?? ''} className="textarea" />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Entry rules" hint="The AI checks trades against these, word for word">
            <textarea name="entryRules" rows={3} defaultValue={model?.entryRules ?? ''} className="textarea" />
          </Field>
          <Field label="Exit rules">
            <textarea name="exitRules" rows={3} defaultValue={model?.exitRules ?? ''} className="textarea" />
          </Field>
          <Field label="Risk rules" hint="Stop placement, size limits">
            <textarea name="riskRules" rows={3} defaultValue={model?.riskRules ?? ''} className="textarea" />
          </Field>
          <Field label="Invalidations" hint="When the setup is void — weighed hardest in review">
            <textarea name="invalidations" rows={3} defaultValue={model?.invalidations ?? ''} className="textarea" />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-xs text-[var(--ink-secondary)]">
          <input type="checkbox" name="active" defaultChecked={model?.active ?? true} />
          Active — offered when tagging trades and in auto-tagging
        </label>

        <SubmitButton>{model ? 'Save model' : 'Add model'}</SubmitButton>
      </ActionForm>
    </Card>
  )
}
