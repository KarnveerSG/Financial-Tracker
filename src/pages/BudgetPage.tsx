import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, SectionCard, InputRow } from '../components/shared/MetricCard'
import { BarBreakdownChart, WaterfallChart } from '../components/charts/FinanceCharts'
import { useFinanceStore } from '../store/useFinanceStore'
import { buildPostTaxBudget, buildPreTaxBudget } from '../engine/budget'
import { formatCurrency, formatPercent } from '../engine/format'

export function BudgetPage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const updateBudgetCategory = useFinanceStore((s) => s.updateBudgetCategory)
  const { profile, budgetInputs } = scenario

  const preTax = useMemo(() => buildPreTaxBudget(scenario), [scenario])
  const postTax = useMemo(() => buildPostTaxBudget(scenario), [scenario])

  const waterfallData = preTax.items.map((item) => ({
    name: item.label,
    value: item.amount,
  }))

  return (
    <div>
      <PageHeader
        title="Budget"
        subtitle="Pre-tax income allocation and post-tax spending breakdown"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Annual Gross" value={formatCurrency(preTax.grossAnnual, profile.currency)} />
        <MetricCard label="Monthly Net" value={formatCurrency(postTax.netMonthly, profile.currency)} />
        <MetricCard
          label="Monthly Spending"
          value={formatCurrency(postTax.totalSpending, profile.currency)}
        />
        <MetricCard
          label={postTax.remainder >= 0 ? 'Unallocated' : 'Over Budget'}
          value={formatCurrency(Math.abs(postTax.remainder), profile.currency)}
          trend={postTax.remainder >= 0 ? 'up' : 'down'}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Pre-Tax Income Allocation">
          <p className="mb-4 text-sm text-ledger-muted">
            Based on paycheck and account data. Edit salary on the{' '}
            <Link to="/paycheck" className="text-ledger-gold hover:underline">Paycheck</Link> page.
          </p>
          <WaterfallChart data={waterfallData} currency={profile.currency} />
          <div className="mt-4 space-y-2 text-sm">
            {preTax.items.map((item) => (
              <div key={item.label} className="flex justify-between">
                <span className="text-ledger-muted">{item.label}</span>
                <span className="tabular-nums">
                  {formatCurrency(item.amount, profile.currency)}
                  {preTax.grossAnnual > 0 && (
                    <span className="ml-2 text-ledger-muted">
                      ({formatPercent((item.amount / preTax.grossAnnual) * 100)})
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Post-Tax Spending">
          <p className="mb-4 text-sm text-ledger-muted">
            Monthly take-home: {formatCurrency(postTax.netMonthly, profile.currency)}
          </p>
          <div className="space-y-4">
            {budgetInputs.postTaxCategories.map((cat) => (
              <InputRow key={cat.id} label={cat.label}>
                <input
                  type="number"
                  value={cat.amount || ''}
                  onChange={(e) => updateBudgetCategory(cat.id, { amount: +e.target.value })}
                  className="input-field tabular-nums"
                  placeholder="0"
                />
              </InputRow>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-ledger-bg/50 p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span>Total spending</span>
              <span className="tabular-nums">{formatCurrency(postTax.totalSpending, profile.currency)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>{postTax.remainder >= 0 ? 'Remaining' : 'Over budget'}</span>
              <span className={`tabular-nums ${postTax.remainder >= 0 ? 'text-ledger-success' : 'text-ledger-danger'}`}>
                {formatCurrency(Math.abs(postTax.remainder), profile.currency)}
              </span>
            </div>
          </div>
        </SectionCard>

        <div className="lg:col-span-2">
          <SectionCard title="Post-Tax Breakdown Chart">
            <BarBreakdownChart
              data={postTax.chartData.map((d) => ({ name: d.label, value: d.amount, color: d.color }))}
              currency={profile.currency}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
