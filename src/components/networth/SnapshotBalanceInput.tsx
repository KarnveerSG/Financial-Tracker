import { useRef, type KeyboardEvent } from 'react'

export function SnapshotBalanceInput({
  value,
  rowIndex,
  colIndex,
  gridRef,
  className,
  onChange,
}: {
  value: number | string
  rowIndex: number
  colIndex: number
  gridRef: React.RefObject<HTMLTableElement | null>
  className?: string
  onChange: (value: number | null) => void
}) {
  const editStart = useRef<string | null>(null)

  const focusCell = (row: number, col: number) => {
    const table = gridRef.current
    if (!table) return
    const input = table.querySelector<HTMLInputElement>(
      `input[data-grid-row="${row}"][data-grid-col="${col}"]`
    )
    input?.focus()
    input?.select()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && editStart.current != null) {
      const parsed = editStart.current === '' ? null : Number(editStart.current)
      onChange(Number.isFinite(parsed as number) ? (parsed as number) : null)
      e.currentTarget.blur()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      focusCell(rowIndex + 1, colIndex)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusCell(rowIndex + 1, colIndex)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusCell(rowIndex - 1, colIndex)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusCell(rowIndex, colIndex + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusCell(rowIndex, colIndex - 1)
    }
  }

  return (
    <input
      type="number"
      data-grid-row={rowIndex}
      data-grid-col={colIndex}
      className={className}
      value={value}
      onFocus={(e) => {
        editStart.current = e.currentTarget.value
      }}
      onKeyDown={handleKeyDown}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') {
          onChange(null)
          return
        }
        const num = Number(raw)
        onChange(Number.isFinite(num) ? num : null)
      }}
    />
  )
}
