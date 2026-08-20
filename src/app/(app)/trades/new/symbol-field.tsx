'use client'

import { useState } from 'react'

/** The products actually traded here, one tap instead of typing. */
const POPULAR = ['NQ', 'MNQ', 'ES', 'MES']

export function SymbolField({ specs }: { specs: { root: string; name: string }[] }) {
  const [value, setValue] = useState('')

  return (
    <div>
      <input
        name="symbol"
        className="input"
        list="symbol-list"
        required
        placeholder="MNQ"
        value={value}
        onChange={(event) => setValue(event.target.value.toUpperCase())}
      />
      <datalist id="symbol-list">
        {specs.map((spec) => (
          <option key={spec.root} value={spec.root}>
            {spec.name}
          </option>
        ))}
      </datalist>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {POPULAR.map((root) => (
          <button
            key={root}
            type="button"
            onClick={() => setValue(root)}
            className={`rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium transition-colors ${
              value === root
                ? 'border-transparent bg-[var(--accent)] text-white'
                : 'border-[var(--line)] text-[var(--ink-secondary)] hover:border-[var(--line-strong)]'
            }`}
          >
            {root}
          </button>
        ))}
      </div>
    </div>
  )
}
