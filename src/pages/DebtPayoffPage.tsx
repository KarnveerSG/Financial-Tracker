import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, SectionCard } from '../components/shared/MetricCard'
import { useFinanceStore } from '../store/useFinanceStore'
import { formatCurrency } from '../engine/format'

type Strategy = 'avalanche' | 'snowball'

interface DebtSim {
  order: Array<{ name: string; balance: number; rate: number; monthsToPayoff: number; interestPaid: number }>
  totalMonths: number
  totalInterest: number
}

function simulate(debts: Array<{ id: string; name: string; balance: number; rate: number; minPayment: number }>, strategy: Strategy, extra: number): DebtSim {
  const active = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({ ...d, interestPaid: 0, monthsToPayoff: 0, startBalance: d.balance }))

  if (active.length === 0) return { order: [], totalMonths: 0, totalInterest: 0 }

  let month = 0
  const order: DebtSim['order'] = []

  while (active.some((d) => d.balance > 0.01) && month < 600) {
    month++
    for (const d of active) {
      if (d.balance <= 0) continue
      const interest = d.balance * (d.rate / 100 / 12)
      d.interestPaid += interest
      d.balance += interest
      const pay = Math.min(d.balance, d.minPayment)
      d.balance -= pay
    }
    active.sort((a, b) => (strategy === 'avalanche' ? b.rate - a.rate : a.balance - b.balance))
    let remaining = extra
    for (const d of active) {
      if (remaining <= 0) break
      if (d.balance <= 0) continue
      const pay = Math.min(d.balance, remaining)
      d.balance -= pay
      remaining -= pay
    }
    for (const d of active) {
      if (d.balance <= 0.01 && d.monthsToPayoff === 0) {
        d.monthsToPayoff = month
        order.push({ name: d.name, balance: d.startBalance, rate: d.rate, monthsToPayoff: month, interestPaid: d.interestPaid })
      }
    }
  }

  return {
    order,
    totalMonths: month,
    totalInterest: active.reduce((s, d) => s + d.interestPaid, 0),
  }
}

export function DebtPayoffPage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const currency = scenario.profile.currency

  const debtAccounts = useMemo(
    () => scenario.accounts.filter((a) => a.isLiability && a.balance > 0),
    [scenario.accounts]
  )

  const [extra, setExtra] = useState(500)
  const [strategy, setStrategy] = useState<Strategy>('avalanche')

  const debts = useMemo(
    () =>
      debtAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        balance: a.balance,
        rate: a.interestRate || 0,
        minPayment: a.monthlyContribution || Math.max(25, a.balance * 0.02),
      })),
    [debtAccounts]
  )

  const result = useMemo(() => simulate(debts, strategy, extra), [debts, strategy, extra])
  const otherResult = useMemo(() => simulate(debts, strategy === 'avalanche' ? 'snowball' : 'avalanche', extra), [debts, strategy, extra])

  return (
    <div>
      <PageHeader title="Debt Payoff Planner" subtitle="Avalanche (highest APR first) vs Snowball (smallest balance first)" />

      {debtAccounts.length === 0 ? (
        <SectionCard title="No debts to plan">
          <p className="text-sm text-ledger-muted">Add a liability account (loan, mortgage, credit card) to see payoff strategies.</p>
        </SectionCard>
      ) : (
        <>
          <SectionCard title="Strategy">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setStrategy('avalanche')} className={`rounded-xl px-4 py-2 text-sm ${strategy === 'avalanche' ? 'bg-ledger-gold/15 text-ledger-gold' : 'text-ledger-muted hover:bg-ledger-elevated'}`}>Avalanche</button>
                <button type="button" onClick={() => setStrategy('snowball')} className={`rounded-xl px-4 py-2 text-sm ${strategy === 'snowball' ? 'bg-ledger-gold/15 text-ledger-gold' : 'text-ledger-muted hover:bg-ledger-elevated'}`}>Snowball</button>
              </div>
              <label className="text-sm">
                <span className="mr-2 text-ledger-muted">Extra $/month:</span>
                <input type="number" value={extra} onChange={(e) => setExtra(+e.target.value)} className="input-field inline-block w-32 text-sm" />
              </label>
            </div>
          </SectionCard>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <MetricCard label="Total months to debt-free" value={`${result.totalMonths} mo`} sub={`~${(result.totalMonths / 12).toFixed(1)} years`} />
            <MetricCard label="Total interest paid" value={formatCurrency(result.totalInterest, currency)} trend="down" />
            <MetricCard label={`vs ${strategy === 'avalanche' ? 'snowball' : 'avalanche'}`} value={formatCurrency(otherResult.totalInterest - result.totalInterest, currency)} sub="Interest saved by chosen strategy" trend={otherResult.totalInterest > result.totalInterest ? 'up' : 'down'} />
          </div>

          <div className="mt-6">
            <SectionCard title="Payoff order">
              <div className="overflow-auto">
                <table className="w-full min-w-[540px] text-left text-sm">
                  <thead className="border-b border-ledger-border text-ledger-muted">
                    <tr>
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">Debt</th>
                      <th className="px-2 py-2 text-right">Balance</th>
                      <th className="px-2 py-2 text-right">Rate</th>
                      <th className="px-2 py-2 text-right">Payoff month</th>
                      <th className="px-2 py-2 text-right">Interest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.order.map((d, i) => (
                      <tr key={d.name} className="border-b border-ledger-border/30">
                        <td className="px-2 py-2">{i + 1}</td>
                        <td className="px-2 py-2 font-medium">{d.name}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(d.balance, currency)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{d.rate.toFixed(2)}%</td>
                        <td className="px-2 py-2 text-right tabular-nums">{d.monthsToPayoff}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(d.interestPaid, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  )
}
