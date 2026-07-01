import type { NetWorthLineItem } from '../../types'
import { is401kLineItem, isIraLineItem, resolveIraVariant, resolveLineItemRothPercent } from '../../engine/networth'

export function LineItemTaxControls({
  item,
  onUpdate,
}: {
  item: NetWorthLineItem
  onUpdate: (partial: Partial<NetWorthLineItem>) => void
}) {
  if (isIraLineItem(item)) {
    const variant = resolveIraVariant(item)
    return (
      <select
        value={variant}
        onChange={(e) =>
          onUpdate({
            accountType: e.target.value === 'roth' ? 'roth_ira' : 'traditional_ira',
          })
        }
        className="mt-1 block w-full max-w-[9rem] rounded-lg border border-ledger-border bg-ledger-elevated px-2 py-0.5 text-xs text-ledger-muted"
        aria-label={`${item.name} IRA type`}
      >
        <option value="roth">Roth (post-tax)</option>
        <option value="traditional">Traditional (pre-tax)</option>
      </select>
    )
  }

  if (is401kLineItem(item)) {
    const rothPct = resolveLineItemRothPercent(item)
    return (
      <label className="mt-1 flex items-center gap-1.5 text-xs text-ledger-muted">
        <span className="whitespace-nowrap">Roth %</span>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={rothPct}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') return
            const num = Math.min(100, Math.max(0, Number(raw)))
            if (!Number.isFinite(num)) return
            onUpdate({ rothPercent: num, accountType: '401k' })
          }}
          className="input-field w-14 py-0.5 text-right text-xs tabular-nums"
          aria-label={`${item.name} Roth percentage`}
        />
        <span className="whitespace-nowrap tabular-nums">· {100 - rothPct}% pre-tax</span>
      </label>
    )
  }

  return null
}
