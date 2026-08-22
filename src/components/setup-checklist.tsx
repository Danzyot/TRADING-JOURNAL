import Link from 'next/link'
import type { SetupState } from '@/server/dashboard'

type Step = {
  done: boolean
  /** Step exists but can't be acted on yet (e.g. no accounts to set commission on). */
  locked?: boolean
  title: string
  detail: string
  href: string
  linkLabel: string
}

/**
 * First-run guidance.
 *
 * Walks the actual state of the data — not a stored "step 3 of 5" flag — so it
 * can never disagree with reality, disappears the moment setup is genuinely
 * complete, and reappears only if something important goes missing.
 *
 * A step is done only when its thing exists. "Zero accounts are missing
 * commission" while there are zero accounts is not done, it is not started —
 * vacuous truths never earn a checkmark here.
 */
export function SetupChecklist({ setup }: { setup: SetupState }) {
  if (setup.complete && setup.accountsMissingCommission === 0) return null

  const steps: Step[] = [
    {
      done: setup.firms > 0,
      title: 'Add the prop firms you trade with',
      detail:
        'Templates in the add form can pre-fill the common ones — every value stays editable, and nothing is created for you.',
      href: '/accounts',
      linkLabel: 'Accounts page',
    },
    {
      done: setup.accounts > 0,
      title: 'Add each account, with its drawdown rule',
      detail:
        'Account size, max drawdown and drawdown type drive every risk warning in the app. Get the drawdown type right — intraday trailing is the punishing one.',
      href: '/accounts',
      linkLabel: 'Add account',
    },
    {
      done: setup.accounts > 0 && setup.accountsMissingCommission === 0,
      locked: setup.accounts === 0,
      title: 'Set the round-turn commission on each account',
      detail:
        setup.accounts === 0
          ? 'Unlocks once you have accounts. Broker fill feeds carry no commission — at zero, every strategy looks better than it is.'
          : 'Broker fill feeds carry no commission. At zero, every strategy looks better than it is — a losing scalping strategy can look profitable.',
      href: '/accounts',
      linkLabel: 'Edit accounts',
    },
    {
      done: setup.trades > 0,
      title: 'Get your trades in',
      detail:
        setup.connections > 0
          ? 'Your broker connection is set up — press Sync brokers, or import a CSV for the history it cannot reach.'
          : 'Import a CSV export from Tradovate, Rithmic or NinjaTrader — or connect Tradovate in Settings for automatic sync.',
      href: '/import',
      linkLabel: 'Import trades',
    },
    {
      done: setup.watcherSeen,
      locked: setup.accounts === 0,
      title: 'Run the trade watcher on your PC',
      detail:
        setup.accounts === 0
          ? 'Unlocks once you have accounts. Two downloads and a double-click — trades then arrive on their own.'
          : 'Settings has both files ready with your URL and token filled in. Install Node, download, double-click — done.',
      href: '/settings',
      linkLabel: 'Settings',
    },
    {
      done: setup.aiConfigured,
      title: 'Connect the AI trade reviewer',
      detail:
        'Add ANTHROPIC_API_KEY in Vercel (Settings → Environment Variables → redeploy). Unlocks AI trade checks, auto-tagging and model refinement.',
      href: '/models',
      linkLabel: 'Models page',
    },
    {
      done: setup.models > 0,
      title: 'Write your first trading model',
      detail:
        'Your setup as rules — entry, SL, TP, invalidations. Everything you tag afterwards gets judged against it.',
      href: '/models',
      linkLabel: 'Add model',
    },
    {
      done: setup.emailAutomation,
      title: 'Connect your prop-firm inbox',
      detail:
        'The app reads your firm emails twice a day and logs payouts, fees, passes, fails and daily balances by itself. Takes a Gmail app password.',
      href: '/settings',
      linkLabel: 'Connect inbox',
    },
    {
      done: setup.taxStatusChosen,
      title: 'Choose your tax status',
      detail:
        'The Tax page compares osek patur, zair, murshe and company on your real numbers. Until you choose, estimates assume osek murshe.',
      href: '/tax',
      linkLabel: 'Tax page',
    },
  ]

  const doneCount = steps.filter((step) => step.done).length
  // The step to point at: first one that is neither done nor waiting on another.
  const nextIndex = steps.findIndex((step) => !step.done && !step.locked)

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="card overflow-hidden">
        <div className="border-b border-[var(--line)] p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--ink)]">Set up your journal</h2>
            <span className="tabular text-xs font-medium text-[var(--ink-secondary)]">
              {doneCount} of {steps.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Everything in the app derives from these. The card disappears when setup is complete.
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div
              className="h-full rounded-full bg-[var(--good)] transition-all"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <ol className="p-3">
          {steps.map((step, index) => {
            const isNext = index === nextIndex
            return (
              <li key={step.title} className="relative flex gap-3.5 pb-1 last:pb-0">
                {/* Connector line between step markers */}
                {index < steps.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-[15px] top-9 w-px bg-[var(--line)]"
                  />
                )}

                <span
                  aria-hidden
                  className="z-10 mt-2 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={
                    step.done
                      ? { background: 'color-mix(in srgb, var(--good) 16%, transparent)', color: 'var(--good)' }
                      : isNext
                        ? { background: 'var(--accent)', color: '#fff' }
                        : {
                            background: 'var(--surface-sunken)',
                            color: 'var(--ink-muted)',
                            boxShadow: 'inset 0 0 0 1px var(--line)',
                          }
                  }
                >
                  {step.done ? '✓' : index + 1}
                </span>

                <div
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2.5 ${
                    isNext ? 'bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        step.done
                          ? 'text-sm font-medium text-[var(--ink-muted)]'
                          : step.locked
                            ? 'text-sm font-medium text-[var(--ink-muted)]'
                            : 'text-sm font-semibold text-[var(--ink)]'
                      }
                    >
                      {step.title}
                    </p>
                    {!step.done && (
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
                        {step.detail}
                      </p>
                    )}
                  </div>
                  {!step.done && !step.locked && (
                    <Link
                      href={step.href}
                      className={isNext ? 'btn btn-primary shrink-0' : 'btn shrink-0'}
                    >
                      {step.linkLabel}
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
