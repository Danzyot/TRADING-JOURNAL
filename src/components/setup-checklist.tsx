import Link from 'next/link'
import type { SetupState } from '@/server/dashboard'
import { Card } from './ui'

type Step = {
  done: boolean
  title: string
  detail: string
  href: string
  linkLabel: string
}

/**
 * First-run guidance.
 *
 * An empty dashboard full of zeros tells a new user nothing about what to do
 * next. This walks the actual state of their data — not a stored "step 3 of 5"
 * flag — so it can never disagree with reality, disappears the moment setup is
 * genuinely complete, and reappears only if something important goes missing.
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
      done: setup.accountsMissingCommission === 0,
      title: 'Set the round-turn commission on each account',
      detail:
        'Broker fill feeds carry no commission. At zero, every strategy looks better than it is — a losing scalping strategy can look profitable.',
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
      done: setup.taxStatusChosen,
      title: 'Choose your tax status',
      detail:
        'The Tax page compares osek patur, zair, murshe and company on your real numbers. Until you choose, estimates assume osek murshe.',
      href: '/tax',
      linkLabel: 'Tax page',
    },
  ]

  const remaining = steps.filter((step) => !step.done).length

  return (
    <Card
      title="Set up your journal"
      description={`${steps.length - remaining} of ${steps.length} done. This card disappears when setup is complete.`}
      className="mb-6"
      bodyClassName="divide-y divide-[var(--line)]"
    >
      {steps.map((step) => (
        <div key={step.title} className="flex items-start gap-3 p-4 first:pt-0 last:pb-0">
          <span
            aria-hidden
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold"
            style={
              step.done
                ? { background: 'color-mix(in srgb, var(--good) 18%, transparent)', color: 'var(--good)' }
                : { background: 'var(--surface-sunken)', color: 'var(--ink-muted)' }
            }
          >
            {step.done ? '✓' : '·'}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={
                step.done
                  ? 'text-sm font-medium text-[var(--ink-muted)] line-through decoration-[var(--line-strong)]'
                  : 'text-sm font-medium text-[var(--ink)]'
              }
            >
              {step.title}
            </p>
            {!step.done && (
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-secondary)]">{step.detail}</p>
            )}
          </div>
          {!step.done && (
            <Link href={step.href} className="btn shrink-0">
              {step.linkLabel}
            </Link>
          )}
        </div>
      ))}
    </Card>
  )
}
