'use client'

import { useMemo, useRef, useState } from 'react'

/**
 * Searchable multi-select rendered as removable chips, storing its value as a
 * comma-joined string in a hidden input so plain server-action forms consume
 * it like any text field. Free entries are allowed — the options are
 * suggestions, not a cage.
 */
export function TagPicker({
  name,
  options,
  defaultValue,
  placeholder = 'Search…',
  allowCustom = true,
}: {
  name: string
  options: string[]
  defaultValue?: string | null
  placeholder?: string
  allowCustom?: boolean
}) {
  const [selected, setSelected] = useState<string[]>(() =>
    (defaultValue ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options
      .filter((option) => !selected.includes(option))
      .filter((option) => q === '' || option.toLowerCase().includes(q))
      .slice(0, 8)
  }, [options, selected, query])

  function add(value: string) {
    const cleaned = value.trim()
    if (!cleaned || selected.includes(cleaned)) return
    setSelected([...selected, cleaned])
    setQuery('')
    inputRef.current?.focus()
  }

  function remove(value: string) {
    setSelected(selected.filter((entry) => entry !== value))
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selected.join(', ')} />
      <div
        className="input flex min-h-[2.375rem] cursor-text flex-wrap items-center gap-1 py-1"
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--ink)]"
          >
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              className="text-[var(--ink-muted)] hover:text-[var(--critical)]"
              onClick={(event) => {
                event.stopPropagation()
                remove(value)
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="min-w-[6rem] flex-1 border-none bg-transparent text-sm outline-none"
          placeholder={selected.length === 0 ? placeholder : ''}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (matches.length > 0) add(matches[0])
              else if (allowCustom && query.trim()) add(query)
            } else if (event.key === 'Backspace' && query === '' && selected.length > 0) {
              remove(selected[selected.length - 1])
            }
          }}
        />
      </div>
      {open && (matches.length > 0 || (allowCustom && query.trim() !== '')) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] py-1 shadow-lg">
          {matches.map((option) => (
            <button
              key={option}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-xs text-[var(--ink)] hover:bg-[var(--surface-sunken)]"
              onMouseDown={(event) => {
                event.preventDefault()
                add(option)
              }}
            >
              {option}
            </button>
          ))}
          {allowCustom && query.trim() !== '' && !matches.includes(query.trim()) && (
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left text-xs text-[var(--ink-secondary)] hover:bg-[var(--surface-sunken)]"
              onMouseDown={(event) => {
                event.preventDefault()
                add(query)
              }}
            >
              Add “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export const TIMEFRAME_OPTIONS = [
  '30s',
  '1m',
  '2m',
  '3m',
  '5m',
  '10m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  'Daily',
  'Weekly',
]
