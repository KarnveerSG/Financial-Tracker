import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, SectionCard } from '../components/shared/MetricCard'
import { LineTrendChart } from '../components/charts/FinanceCharts'
import { useFinanceStore } from '../store/useFinanceStore'
import { formatCurrency, formatPercent } from '../engine/format'

interface AmortRow {
  month: number
  interest: number
  principal: number
  balance: number
  invested: number
}

function amortize({
  balance,
  annualRate,
  monthlyPayment,
  extraMonthly,
  lumpSum,
  months,
  investExtra,
  investReturn,
}: {
  balance: number
  annualRate: number
  monthlyPayment: number
  extraMonthly: number
  lumpSum: number
  months: number
  investExtra: boolean
  investReturn: number
}): AmortRow[] {
  const monthlyRate = annualRate / 12
  const investMonthlyRate = investReturn / 12
  const rows: AmortRow[] = []
  let bal = Math.max(0, balance - (investExtra ? 0 : lumpSum))
  let invested = investExtra ? lumpSum : 0

  for (let m = 1; m <= months; m++) {
    const interest = bal * monthlyRate
    let principal = Math.min(bal, monthlyPayment - interest)
    const extra = investExtra ? 0 : extraMonthly
    principal = Math.min(bal, principal + extra)
    bal = Math.max(0, bal - principal)
    invested = invested * (1 + investMonthlyRate) + (investExtra ? extraMonthly : 0)
    rows.push({ month: m, interest, principal, balance: bal, invested })
    if (bal <= 0 && !investExtra) break
  }
  return rows
}

export function MortgagePage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const currency = scenario.profile.currency

  const [balance, setBalance] = useState(285000)
  const [annualRatePct, setAnnualRatePct] = useState(3.75)
  const [monthlyPayment, setMonthlyPayment] = useState(1783)
  const [extraMonthly, setExtraMonthly] = useState(500)
  const [lumpSum, setLumpSum] = useState(40000)
  const [investReturnPct, setInvestReturnPct] = useState(7)
  const [termMonths, setTermMonths] = useState(360)

  const payoff = useMemo(
    () => amortize({
      balance,
      annualRate: annualRatePct / 100,
      monthlyPayment,
      extraMonthly,
      lumpSum,
      months: termMonths,
      investExtra: false,
      investReturn: investReturnPct / 100,
    }),
    [balance, annualRatePct, monthlyPayment, extraMonthly, lumpSum, termMonths, investReturnPct]
  )

  const invest = useMemo(
    () => amortize({
      balance,
      annualRate: annualRatePct / 100,
      monthlyPayment,
      extraMonthly,
      lumpSum,
      months: termMonths,
      investExtra: true,
      investReturn: investReturnPct / 100,
    }),
    [balance, annualRatePct, monthlyPayment, extraMonthly, lumpSum, termMonths, investReturnPct]
  )

  const payoffInterest = payoff.reduce((s, r) => s + r.interest, 0)
  const investInterest = invest.reduce((s, r) => s + r.interest, 0)
  const finalInvestedValue = invest.at(-1)?.invested ?? 0
  const finalPayoffMonth = payoff.findIndex((r) => r.balance <= 0) + 1 || payoff.length

  const chartData = useMemo(() => {
    const step = Math.max(1, Math.floor(termMonths / 60))
    const rows: Array<{ label: string; payoffBalance: number; investBalance: number; investPortfolio: number }> = []
    for (let i = 0; i < payoff.length; i += step) {
      rows.push({
        label: `Y${Math.round(i / 12)}`,
        payoffBalance: payoff[i].balance,
        investBalance: invest[i]?.balance ?? 0,
        investPortfolio: invest[i]?.invested ?? 0,
      })
    }
    return rows
  }, [payoff, invest, termMonths])

  const netAdvantage = finalInvestedValue - (investInterest - payoffInterest)

  return (
    <div>
      <PageHeader title="Mortgage: Pay Down vs Invest" subtitle="Compare extra principal payments against investing the same money" />

      <SectionCard title="Inputs">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-ledger-muted">Current balance</span>
            <input type="number" value={balance} onChange={(e) => setBalance(+e.target.value)} className="input-field text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-ledger-muted">Interest rate (%)</span>
            <input type="number" step="0.01" value={annualRatePct} onChange={(e) => setAnnualRatePct(+e.target.value)} className="input-field text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-ledger-muted">Base monthly payment (P&I)</span>
            <input type="number" value={monthlyPayment} onChange={(e) => setMonthlyPayment(+e.target.value)} className="input-field text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-ledger-muted">Extra monthly principal</span>
            <input type="number" value={extraMonthly} onChange={(e) => setExtraMonthly(+e.target.value)} className="input-field text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-ledger-muted">One-time lump sum</span>
            <input type="number" value={lumpSum} onChange={(e) => setLumpSum(+e.target.value)} className="input-field text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-ledger-muted">Expected investment return (%)</span>
            <input type="number" step="0.1" value={investReturnPct} onChange={(e) => setInvestReturnPct(+e.target.value)} className="input-field text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-ledger-muted">Analysis horizon (months)</span>
            <input type="number" value={termMonths} onChange={(e) => setTermMonths(+e.target.value)} className="input-field text-sm" />
          </label>
        </div>
      </SectionCard>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Payoff strategy — total interest" value={formatCurrency(payoffInterest, currency)} sub={`Paid off in ${finalPayoffMonth} months`} trend="down" />
        <MetricCard label="Invest strategy — total interest" value={formatCurrency(investInterest, currency)} sub="Interest paid on unaccelerated loan" />
        <MetricCard label="Portfolio at end of horizon" value={formatCurrency(finalInvestedValue, currency)} sub={`Invested lump + ${formatCurrency(extraMonthly, currency)}/mo @ ${formatPercent(investReturnPct)}`} trend="up" />
        <MetricCard label="Net advantage of investing" value={formatCurrency(netAdvantage, currency)} sub="Portfolio value minus extra interest paid" trend={netAdvantage >= 0 ? 'up' : 'down'} />
      </div>

      <div className="mt-8">
        <SectionCard title="Balance vs portfolio over time">
          <LineTrendChart
            data={chartData}
            xKey="label"
            currency={currency}
            lines={[
              { key: 'payoffBalance', color: '#c9a962', label: 'Mortgage bal. (payoff strategy)' },
              { key: 'investBalance', color: '#b85c5c', label: 'Mortgage bal. (invest strategy)' },
              { key: 'investPortfolio', color: '#7d9b8a', label: 'Portfolio (invest strategy)' },
            ]}
          />
        </SectionCard>
      </div>

      <p className="mt-4 text-xs text-ledger-muted">
        Assumes constant return, no taxes on invested growth, no mortgage-interest deduction. Higher expected return favors investing; higher mortgage rate favors payoff.
      </p>
    </div>
  )
}
