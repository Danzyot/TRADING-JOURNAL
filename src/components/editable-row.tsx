'use client'
import { useState } from 'react'
import type { ReactNode } from 'react'

/**
 * A table row that opens an editor underneath itself.
 *
 * Every automatic source in this app — the email reader, the broker sync, the
 * AI tagger — will eventually get a number wrong, and a row that can only be
 * deleted and retyped makes correcting it a chore worth avoiding. So each row
 * carries its own editing form, prefilled with what is already stored: open,
 * change the one field, save.
 *
 * The editor is rendered only while open, which keeps a long table cheap and
 * means the form mounts fresh each time — it always shows what is currently in
 * the database rather than a stale copy from the last time it was opened.
 */
export function EditableRow({
  cells,
  editor,
  actions,
  columns,
  label = 'Edit',
}: {
  /** The row's normal cells. */
  cells: ReactNode
  /** The form shown when the row is opened. */
  editor: ReactNode
  /** Anything else belonging in the actions cell, e.g. delete. */
  actions?: ReactNode
  /** Total column count, so the editor can span the table. */
  columns: number
  label?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <tr className={open ? 'bg-[var(--surface-sunken)]' : undefined}>
        {cells}
        <td className="whitespace-nowrap text-right">
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="btn px-2 py-1 text-xs"
              aria-expanded={open}
            >
              {open ? 'Close' : label}
            </button>
            {actions}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={columns} className="bg-[var(--surface-sunken)] p-3">
            {editor}
          </td>
        </tr>
      )}
    </>
  )
}
