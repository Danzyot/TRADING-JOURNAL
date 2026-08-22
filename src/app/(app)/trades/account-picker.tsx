'use client'

import { useState } from 'react'

export type PickableAccount = { id: number; label: string; firm: string }

/**
 * The accounts a trade was taken on — plural, because it usually is.
 *
 * A copier fires the same entry across every funded account at once, and the
 * journal was asking which single one it was. Picking several here logs the
 * trade once per account, each costed at that account's own commission rate,
 * which is the only part that actually differs between them.
 *
 * Grouped by firm and pre-filled with everything that was picked last time,
 * because the set of accounts being copied changes far less often than trades
 * are logged.
 */
export function AccountPicker({
  accounts,
  defaultSelected,
}: {
  accounts: PickableAccount[]
  defaultSelected: number[]
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(defaultSelected))

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const byFirm = new Map<string, PickableAccount[]>()
  for (const account of accounts) {
    byFirm.set(account.firm, [...(byFirm.get(account.firm) ?? []), account])
  }

  const setMany = (ids: number[], on: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  return (
    <div className="rounded-lg border border-[var(--line)] p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-[var(--ink)]">
          {selected.size === 0
            ? 'Pick at least one account'
            : `${selected.size} account${selected.size === 1 ? '' : 's'}`}
        </span>
        <span className="flex gap-2 text-[0.6875rem]">
          <button
            type="button"
            onClick={() => setMany(accounts.map((a) => a.id), true)}
            className="text-[var(--accent)] hover:underline"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setMany(accounts.map((a) => a.id), false)}
            className="text-[var(--ink-muted)] hover:underline"
          >
            None
          </button>
        </span>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...byFirm.entries()].map(([firm, rows]) => {
          const ids = rows.map((row) => row.id)
          const allOn = ids.every((id) => selected.has(id))
          return (
            <div key={firm}>
              <button
                type="button"
                onClick={() => setMany(ids, !allOn)}
                className="text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)] hover:text-[var(--accent)]"
                title={allOn ? `Clear every ${firm} account` : `Select every ${firm} account`}
              >
                {firm}
              </button>

              <div className="mt-1 space-y-1">
                {rows.map((account) => {
                  const on = selected.has(account.id)
                  return (
                    <label
                      key={account.id}
                      className="flex cursor-pointer items-center gap-2 text-xs text-[var(--ink-secondary)]"
                    >
                      {/* The circle is the control: a real checkbox, drawn round
                          and kept in the accessibility tree rather than replaced
                          by a div that only looks like one. */}
                      <input
                        type="checkbox"
                        name="accountIds"
                        value={account.id}
                        checked={on}
                        onChange={() => toggle(account.id)}
                        className="h-4 w-4 shrink-0 appearance-none rounded-full border border-[var(--line-strong)] transition-colors checked:border-[var(--accent)] checked:bg-[var(--accent)]"
                      />
                      <span className="truncate" title={account.label}>
                        {account.label}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
