import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { SectionCard } from '../components/shared/MetricCard'
import { useFinanceStore } from '../store/useFinanceStore'
import { formatCurrency, todayISO } from '../engine/format'
import type { TransactionKind } from '../types'

export function TransactionsPage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const { addStockTransaction, removeStockTransaction } = useFinanceStore()

  const investmentAccounts = useMemo(
    () => scenario.accounts.filter((a) => !a.isLiability),
    [scenario.accounts]
  )

  const [form, setForm] = useState({
    date: todayISO(),
    accountId: investmentAccounts[0]?.id ?? '',
    ticker: '',
    kind: 'buy' as TransactionKind,
    shares: '',
    pricePerShare: '',
    amount: '',
    notes: '',
    recurring: false,
    recurWeeks: '4',
  })

  const submit = () => {
    if (!form.accountId) return
    const shares = parseFloat(form.shares) || 0
    const price = parseFloat(form.pricePerShare) || 0
    const amount = parseFloat(form.amount) || shares * price
    if (form.kind !== 'dividend' && (!form.ticker.trim() || shares <= 0)) return
    if (form.kind === 'dividend' && amount <= 0) return

    const weeks = form.recurring ? Math.max(1, Math.min(52, parseInt(form.recurWeeks, 10) || 1)) : 1
    const baseDate = new Date(form.date)
    for (let i = 0; i < weeks; i++) {
      const d = new Date(baseDate)
      d.setDate(d.getDate() + i * 7)
      addStockTransaction({
        date: d.toISOString().slice(0, 10),
        accountId: form.accountId,
        ticker: form.ticker.trim().toUpperCase(),
        kind: form.kind,
        shares,
        pricePerShare: price,
        amount: form.kind === 'dividend' ? amount : shares * price,
        notes: form.notes + (form.recurring ? ` (week ${i + 1}/${weeks})` : ''),
      })
    }
    setForm({ ...form, ticker: '', shares: '', pricePerShare: '', amount: '', notes: '' })
  }

  const transactions = useMemo(
    () => [...(scenario.stockTransactions ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [scenario.stockTransactions]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, typeof transactions>()
    for (const tx of transactions) {
      const month = tx.date.slice(0, 7)
      if (!map.has(month)) map.set(month, [])
      map.get(month)!.push(tx)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [transactions])

  const accountName = (id: string) => investmentAccounts.find((a) => a.id === id)?.name ?? '—'
  const currency = scenario.profile.currency

  return (
    <div>
      <PageHeader title="Monthly Transactions" subtitle="Log buys, sells, and dividends — updates your holdings and cost basis" />

      <SectionCard title="New transaction">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-ledger-muted">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ledger-muted">Account</label>
            <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="input-field text-sm">
              {investmentAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-ledger-muted">Type</label>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as TransactionKind })} className="input-field text-sm">
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
              <option value="dividend">Dividend</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-ledger-muted">Ticker</label>
            <input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder="VTI" className="input-field text-sm" />
          </div>
          {form.kind !== 'dividend' && (
            <>
              <div>
                <label className="mb-1 block text-xs text-ledger-muted">Shares</label>
                <input type="number" step="0.0001" value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} className="input-field text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ledger-muted">Price/share</label>
                <input type="number" step="0.01" value={form.pricePerShare} onChange={(e) => setForm({ ...form, pricePerShare: e.target.value })} className="input-field text-sm" />
              </div>
            </>
          )}
          {form.kind === 'dividend' && (
            <div>
              <label className="mb-1 block text-xs text-ledger-muted">Amount</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field text-sm" />
            </div>
          )}
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-ledger-muted">Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field text-sm" />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} />
              Recurring weekly
            </label>
            {form.recurring && (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-ledger-muted">for</span>
                <input type="number" min="1" max="52" value={form.recurWeeks} onChange={(e) => setForm({ ...form, recurWeeks: e.target.value })} className="input-field w-20 text-sm" />
                <span className="text-ledger-muted">weeks</span>
              </label>
            )}
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={submit} className="btn-primary text-sm">Add transaction{form.recurring ? 's' : ''}</button>
        </div>
      </SectionCard>

      <div className="mt-6 space-y-6">
        {grouped.length === 0 && (
          <SectionCard title="No transactions yet">
            <p className="text-sm text-ledger-muted">Log a buy, sell, or dividend above. Buys/sells write tax lots and adjust your holdings automatically.</p>
          </SectionCard>
        )}
        {grouped.map(([month, txs]) => {
          const monthLabel = new Date(month + '-01').toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
          const total = txs.reduce((sum, t) => sum + (t.kind === 'sell' || t.kind === 'dividend' ? t.amount : -t.amount), 0)
          return (
            <SectionCard key={month} title={monthLabel} action={<span className={`text-sm ${total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>Net: {formatCurrency(total, currency)}</span>}>
              <div className="overflow-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-ledger-border text-ledger-muted">
                    <tr>
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Ticker</th>
                      <th className="px-2 py-2">Account</th>
                      <th className="px-2 py-2 text-right">Shares</th>
                      <th className="px-2 py-2 text-right">Price</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {txs.map((tx) => (
                      <tr key={tx.id} className="border-b border-ledger-border/30">
                        <td className="px-2 py-2 tabular-nums">{tx.date}</td>
                        <td className={`px-2 py-2 capitalize ${tx.kind === 'buy' ? 'text-sky-400' : tx.kind === 'sell' ? 'text-rose-400' : 'text-emerald-400'}`}>{tx.kind}</td>
                        <td className="px-2 py-2 font-medium">{tx.ticker || '—'}</td>
                        <td className="px-2 py-2 text-xs text-ledger-muted">{accountName(tx.accountId)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{tx.shares || '—'}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{tx.pricePerShare ? formatCurrency(tx.pricePerShare, currency) : '—'}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(tx.amount, currency)}</td>
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => removeStockTransaction(tx.id)} className="btn-ghost text-xs text-ledger-danger">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )
        })}
      </div>
    </div>
  )
}
