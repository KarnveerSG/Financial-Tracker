import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, SectionCard } from '../components/shared/MetricCard'
import { useFinanceStore } from '../store/useFinanceStore'
import { monthlyCashFlow, summarizeCashFlow, upcomingBills } from '../engine/cashFlow'
import { formatCurrency, todayISO } from '../engine/format'
import type { CashFlowEntry, CashFlowFrequency, CashFlowKind } from '../types'

const CATEGORY_OPTIONS = [
  'salary', 'housing', 'food', 'utilities', 'transport', 'entertainment', 'personal', 'savings', 'other',
]

export function CashFlowPage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const addCashFlow = useFinanceStore((s) => s.addCashFlow)
  const updateCashFlow = useFinanceStore((s) => s.updateCashFlow)
  const removeCashFlow = useFinanceStore((s) => s.removeCashFlow)
  const currency = scenario.profile.currency
  const entries = scenario.cashFlowEntries ?? []

  const [form, setForm] = useState({
    date: todayISO(),
    kind: 'expense' as CashFlowKind,
    amount: '',
    description: '',
    categoryId: 'other',
    recurring: false,
    frequency: 'monthly' as CashFlowFrequency,
  })

  const thisMonth = useMemo(() => {
    const now = new Date()
    return summarizeCashFlow(entries, new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0))
  }, [entries])

  const trailing6 = useMemo(() => monthlyCashFlow(entries, 6), [entries])

  const upcoming = useMemo(() => upcomingBills(entries, 30), [entries])

  const submit = () => {
    const amt = parseFloat(form.amount)
    if (!(amt > 0) || !form.description.trim()) return
    addCashFlow({
      date: form.date,
      kind: form.kind,
      amount: amt,
      description: form.description.trim(),
      categoryId: form.categoryId,
      recurring: form.recurring,
      frequency: form.recurring ? form.frequency : 'once',
    })
    setForm({ ...form, amount: '', description: '' })
  }

  return (
    <div>
      <PageHeader title="Cash Flow" subtitle="Recurring bills, income tracking, and monthly cash flow forecast" />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Income (month)" value={formatCurrency(thisMonth.income, currency)} trend="up" />
        <MetricCard label="Expenses (month)" value={formatCurrency(thisMonth.expenses, currency)} trend="down" />
        <MetricCard label="Net" value={formatCurrency(thisMonth.net, currency)} trend={thisMonth.net >= 0 ? 'up' : 'down'} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Upcoming in next 30 days">
          {upcoming.length === 0 ? (
            <p className="text-sm text-ledger-muted">No bills scheduled.</p>
          ) : (
            <ul className="divide-y divide-ledger-border">
              {upcoming.map((b, i) => (
                <li key={`${b.entryId}-${b.date}-${i}`} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="tabular-nums text-ledger-muted">{b.date}</span>
                    <span className="ml-3">{b.description}</span>
                  </span>
                  <span className="tabular-nums text-ledger-danger">{formatCurrency(b.amount, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Last 6 months">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ledger-muted">
                <th className="pb-2">Month</th>
                <th className="pb-2 text-right">In</th>
                <th className="pb-2 text-right">Out</th>
                <th className="pb-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {trailing6.map((row) => (
                <tr key={row.month} className="border-t border-ledger-border">
                  <td className="py-1.5 tabular-nums">{row.month}</td>
                  <td className="py-1.5 text-right tabular-nums text-ledger-success">{formatCurrency(row.income, currency)}</td>
                  <td className="py-1.5 text-right tabular-nums text-ledger-danger">{formatCurrency(row.expenses, currency)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCurrency(row.net, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>

      <SectionCard title="Add cash flow entry">
        <div className="grid gap-3 md:grid-cols-6">
          <label className="text-sm">
            <span className="label">Date</span>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" />
          </label>
          <label className="text-sm">
            <span className="label">Kind</span>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as CashFlowKind })} className="input-field">
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="label">Amount</span>
            <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field" />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="label">Description</span>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" />
          </label>
          <label className="text-sm">
            <span className="label">Category</span>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="input-field">
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} />
            Recurring
          </label>
          {form.recurring && (
            <label className="text-sm">
              <span className="label">Frequency</span>
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as CashFlowFrequency })} className="input-field">
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
          )}
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={submit} className="btn-primary text-sm">Add entry</button>
        </div>
      </SectionCard>

      <SectionCard title={`All entries (${entries.length})`}>
        {entries.length === 0 ? (
          <p className="text-sm text-ledger-muted">No entries yet. Add one above or load the demo scenario.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ledger-muted">
                <th className="pb-2">Date</th>
                <th className="pb-2">Description</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">Freq</th>
                <th className="pb-2 text-right">Amount</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {[...entries].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                <tr key={e.id} className="border-t border-ledger-border">
                  <td className="py-1.5 tabular-nums">{e.date}</td>
                  <td className="py-1.5">
                    <input
                      value={e.description}
                      onChange={(ev) => updateCashFlow(e.id, { description: ev.target.value })}
                      className="w-full bg-transparent"
                    />
                  </td>
                  <td className="py-1.5 text-ledger-muted">{e.categoryId ?? 'other'}</td>
                  <td className="py-1.5 text-ledger-muted">{e.recurring ? e.frequency : 'once'}</td>
                  <td className={`py-1.5 text-right tabular-nums ${e.kind === 'income' ? 'text-ledger-success' : 'text-ledger-danger'}`}>
                    {e.kind === 'income' ? '+' : '−'}{formatCurrency(e.amount, currency)}
                  </td>
                  <td className="py-1.5 text-right">
                    <button type="button" onClick={() => removeCashFlow(e.id)} className="text-xs text-ledger-muted hover:text-ledger-danger">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  )
}

export type { CashFlowEntry }
