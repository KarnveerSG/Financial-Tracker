import { useMemo, useState } from 'react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { HOLDINGS_ACCOUNT_TYPES } from '../../types'
import type { Account } from '../../types'
import { createId } from '../../engine/format'

interface HoldingEntry {
  accountId: string
  ticker: string
  shares: string
  pricePerShare: string
}

export function HoldingsSetupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const { updateAccount } = useFinanceStore()

  const eligibleAccounts = useMemo(
    () =>
      scenario.accounts.filter(
        (a) => !a.isLiability && (HOLDINGS_ACCOUNT_TYPES.includes(a.accountType) || a.accountType === '401k' || a.accountType === 'roth_401k' || a.accountType === 'traditional_ira' || a.accountType === 'roth_ira' || a.accountType === 'hsa')
      ),
    [scenario.accounts]
  )

  const [rows, setRows] = useState<HoldingEntry[]>(() =>
    eligibleAccounts.map((a) => ({ accountId: a.id, ticker: '', shares: '', pricePerShare: '' }))
  )

  if (!open) return null

  const updateRow = (idx: number, partial: Partial<HoldingEntry>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...partial } : r)))
  }

  const addRowFor = (accountId: string) => {
    setRows((prev) => [...prev, { accountId, ticker: '', shares: '', pricePerShare: '' }])
  }

  const save = () => {
    const byAccount = new Map<string, Account>()
    for (const a of eligibleAccounts) byAccount.set(a.id, { ...a, holdings: [...(a.holdings ?? [])] })

    for (const row of rows) {
      const ticker = row.ticker.trim().toUpperCase()
      const shares = parseFloat(row.shares)
      const price = parseFloat(row.pricePerShare)
      if (!ticker || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(price) || price <= 0) continue
      const acct = byAccount.get(row.accountId)
      if (!acct) continue
      acct.holdings = [
        ...(acct.holdings ?? []),
        {
          id: createId(),
          ticker,
          shares,
          pricePerShare: price,
          lots: [{ id: createId(), shares, costPerShare: price, acquiredDate: new Date().toISOString().slice(0, 10) }],
        },
      ]
    }
    for (const acct of byAccount.values()) {
      updateAccount(acct.id, { holdings: acct.holdings, syncBalanceFromHoldings: acct.holdings.length > 0 ? acct.syncBalanceFromHoldings : acct.syncBalanceFromHoldings })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-ledger-border bg-ledger-surface shadow-glow">
        <div className="flex items-center justify-between border-b border-ledger-border px-6 py-4">
          <div>
            <h2 className="font-serif text-xl font-semibold">Add your stock holdings</h2>
            <p className="text-sm text-ledger-muted">Enter tickers + shares for each investment account. Prices auto-refresh from Yahoo when enabled.</p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost text-sm">Skip for now</button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {eligibleAccounts.length === 0 && (
            <p className="text-sm text-ledger-muted">No investment accounts yet. Add one from Accounts, then come back.</p>
          )}
          {eligibleAccounts.map((account) => {
            const accountRows = rows.map((r, i) => ({ ...r, _idx: i })).filter((r) => r.accountId === account.id)
            return (
              <div key={account.id} className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium">{account.name}</h3>
                  <button type="button" onClick={() => addRowFor(account.id)} className="btn-ghost text-xs text-ledger-gold">+ Add ticker</button>
                </div>
                <div className="space-y-2">
                  {accountRows.map((row) => (
                    <div key={row._idx} className="grid grid-cols-3 gap-2">
                      <input
                        placeholder="Ticker (e.g. VTI)"
                        value={row.ticker}
                        onChange={(e) => updateRow(row._idx, { ticker: e.target.value })}
                        className="input-field text-sm"
                      />
                      <input
                        placeholder="Shares"
                        type="number"
                        step="0.0001"
                        value={row.shares}
                        onChange={(e) => updateRow(row._idx, { shares: e.target.value })}
                        className="input-field text-sm"
                      />
                      <input
                        placeholder="Cost per share"
                        type="number"
                        step="0.01"
                        value={row.pricePerShare}
                        onChange={(e) => updateRow(row._idx, { pricePerShare: e.target.value })}
                        className="input-field text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end gap-2 border-t border-ledger-border px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button type="button" onClick={save} className="btn-primary text-sm">Save holdings</button>
        </div>
      </div>
    </div>
  )
}
