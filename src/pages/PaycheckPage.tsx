import { useMemo } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, SectionCard, InputRow } from '../components/shared/MetricCard'
import { BarBreakdownChart } from '../components/charts/FinanceCharts'
import { useFinanceStore } from '../store/useFinanceStore'
import { US_STATES } from '../types'
import { calculatePaycheck, PERIODS } from '../engine/paycheck'
import { formatCurrency, formatCurrencyPrecise, formatPercent } from '../engine/format'

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'semimonthly', label: 'Semi-monthly' },
  { value: 'monthly', label: 'Monthly' },
] as const

export function PaycheckPage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const updatePaycheckInputs = useFinanceStore((s) => s.updatePaycheckInputs)
  const updateProfile = useFinanceStore((s) => s.updateProfile)
  const { paycheckInputs, profile } = scenario

  const stateRate = US_STATES.find((s) => s.code === profile.state)?.flatRate ?? 0

  const paycheck = useMemo(
    () => calculatePaycheck(paycheckInputs, profile.filingStatus, stateRate),
    [paycheckInputs, profile.filingStatus, stateRate]
  )

  const effectiveTaxRate =
    paycheck.annualGross > 0
      ? ((paycheck.federalTax * PERIODS[paycheckInputs.frequency] * (paycheckInputs.frequency === 'monthly' ? 1 : 1) +
          paycheck.stateTax * PERIODS[paycheckInputs.frequency] +
          paycheck.socialSecurity * PERIODS[paycheckInputs.frequency] +
          paycheck.medicare * PERIODS[paycheckInputs.frequency]) /
          paycheck.annualGross) * 100
      : 0

  return (
    <div>
      <PageHeader title="Paycheck Calculator" subtitle="Gross-to-net breakdown with retirement contributions" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Gross (per period)" value={formatCurrencyPrecise(paycheck.grossPay, profile.currency)} />
        <MetricCard label="Net (per period)" value={formatCurrencyPrecise(paycheck.netPay, profile.currency)} />
        <MetricCard label="Annual Gross" value={formatCurrency(paycheck.annualGross, profile.currency)} />
        <MetricCard label="Annual Net" value={formatCurrency(paycheck.annualNet, profile.currency)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Income & Deductions">
          <div className="grid gap-4 sm:grid-cols-2">
            <InputRow label="Annual Salary">
              <input type="number" value={paycheckInputs.salary} onChange={(e) => updatePaycheckInputs({ salary: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="Annual Bonus">
              <input type="number" value={paycheckInputs.bonus} onChange={(e) => updatePaycheckInputs({ bonus: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="Pay Frequency">
              <select value={paycheckInputs.frequency} onChange={(e) => updatePaycheckInputs({ frequency: e.target.value as typeof paycheckInputs.frequency })} className="input-field">
                {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </InputRow>
            <InputRow label="State">
              <select value={profile.state} onChange={(e) => updateProfile({ state: e.target.value })} className="input-field">
                {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </InputRow>
            <InputRow label="401(k) Pretax (annual)">
              <input type="number" value={paycheckInputs.pretax401k} onChange={(e) => updatePaycheckInputs({ pretax401k: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="401(k) Roth (annual)">
              <input type="number" value={paycheckInputs.roth401k} onChange={(e) => updatePaycheckInputs({ roth401k: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="HSA (annual)">
              <input type="number" value={paycheckInputs.hsa} onChange={(e) => updatePaycheckInputs({ hsa: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="ESPP (annual)">
              <input type="number" value={paycheckInputs.espp} onChange={(e) => updatePaycheckInputs({ espp: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="Health Insurance (annual)">
              <input type="number" value={paycheckInputs.healthInsurance} onChange={(e) => updatePaycheckInputs({ healthInsurance: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="Other Deductions (annual)">
              <input type="number" value={paycheckInputs.otherDeductions} onChange={(e) => updatePaycheckInputs({ otherDeductions: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
          </div>
        </SectionCard>

        <SectionCard title="Paycheck Breakdown">
          <BarBreakdownChart data={paycheck.chartData} currency={profile.currency} />
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between"><span className="text-ledger-muted">Federal</span><span className="tabular-nums">{formatCurrencyPrecise(paycheck.federalTax, profile.currency)}</span></div>
            <div className="flex justify-between"><span className="text-ledger-muted">State</span><span className="tabular-nums">{formatCurrencyPrecise(paycheck.stateTax, profile.currency)}</span></div>
            <div className="flex justify-between"><span className="text-ledger-muted">Social Security</span><span className="tabular-nums">{formatCurrencyPrecise(paycheck.socialSecurity, profile.currency)}</span></div>
            <div className="flex justify-between"><span className="text-ledger-muted">Medicare</span><span className="tabular-nums">{formatCurrencyPrecise(paycheck.medicare, profile.currency)}</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Annual Cash Flow Summary">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Gross Income</span><span className="tabular-nums">{formatCurrency(paycheck.annualGross, profile.currency)}</span></div>
            <div className="flex justify-between"><span>Retirement Contributions</span><span className="tabular-nums">{formatCurrency(paycheckInputs.pretax401k + paycheckInputs.roth401k + paycheckInputs.hsa, profile.currency)}</span></div>
            <div className="flex justify-between"><span>Est. Tax Rate</span><span className="tabular-nums">{formatPercent(Math.min(100, effectiveTaxRate))}</span></div>
            <div className="flex justify-between border-t border-ledger-border pt-3 font-medium"><span>Net Take-Home</span><span className="tabular-nums text-ledger-success">{formatCurrency(paycheck.annualNet, profile.currency)}</span></div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}