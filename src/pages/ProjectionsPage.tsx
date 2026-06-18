import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { SectionCard, InputRow } from '../components/shared/MetricCard'
import { MonteCarloFanChart } from '../components/charts/FinanceCharts'
import { useFinanceStore } from '../store/useFinanceStore'
import { runMonteCarloProjection } from '../engine/projections'
import { formatPercent } from '../engine/format'

export function ProjectionsPage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const updateAssumptions = useFinanceStore((s) => s.updateAssumptions)
  const updateProfile = useFinanceStore((s) => s.updateProfile)
  const { assumptions, profile, accounts } = scenario
  const [showReal, setShowReal] = useState(false)
  const [simulations, setSimulations] = useState(500)

  const monteCarlo = useMemo(
    () => runMonteCarloProjection(accounts, profile, assumptions, simulations),
    [accounts, profile, assumptions, simulations]
  )

  return (
    <div>
      <PageHeader
        title="Projections"
        subtitle="Monte Carlo net worth projections from current age through life expectancy"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Assumptions">
          <div className="space-y-4">
            <InputRow label="Current Age">
              <input
                type="number"
                value={profile.currentAge}
                onChange={(e) => updateProfile({ currentAge: +e.target.value })}
                className="input-field tabular-nums"
              />
            </InputRow>
            <InputRow label="Retirement Age">
              <input
                type="number"
                value={profile.retirementAge}
                onChange={(e) => updateProfile({ retirementAge: +e.target.value })}
                className="input-field tabular-nums"
              />
            </InputRow>
            <InputRow label="Life Expectancy">
              <input
                type="number"
                value={profile.lifeExpectancy}
                onChange={(e) => updateProfile({ lifeExpectancy: +e.target.value })}
                className="input-field tabular-nums"
              />
            </InputRow>
            <InputRow label="Inflation Rate (%)">
              <input
                type="number"
                step="0.1"
                value={assumptions.inflationRate}
                onChange={(e) => updateAssumptions({ inflationRate: +e.target.value })}
                className="input-field tabular-nums"
              />
            </InputRow>
            <InputRow label="Annual Return (%)">
              <input
                type="number"
                step="0.1"
                value={assumptions.annualReturnRate}
                onChange={(e) => updateAssumptions({ annualReturnRate: +e.target.value })}
                className="input-field tabular-nums"
              />
            </InputRow>
            <InputRow label="Return Std Dev (%)">
              <input
                type="number"
                step="0.1"
                value={assumptions.returnStdDev}
                onChange={(e) => updateAssumptions({ returnStdDev: +e.target.value })}
                className="input-field tabular-nums"
              />
            </InputRow>
            <InputRow label="Salary Growth (%)">
              <input
                type="number"
                step="0.1"
                value={assumptions.salaryGrowthRate}
                onChange={(e) => updateAssumptions({ salaryGrowthRate: +e.target.value })}
                className="input-field tabular-nums"
              />
            </InputRow>
            <InputRow label="Contribution Growth (%)">
              <input
                type="number"
                step="0.1"
                value={assumptions.contributionGrowthRate}
                onChange={(e) => updateAssumptions({ contributionGrowthRate: +e.target.value })}
                className="input-field tabular-nums"
              />
            </InputRow>
            <InputRow label="Simulations">
              <select
                value={simulations}
                onChange={(e) => setSimulations(+e.target.value)}
                className="input-field"
              >
                <option value={200}>200 (fast)</option>
                <option value={500}>500</option>
                <option value={1000}>1000 (detailed)</option>
              </select>
            </InputRow>
          </div>
        </SectionCard>

        <div className="lg:col-span-2">
          <SectionCard
            title="Net Worth Projection — Monte Carlo Fan Chart"
            action={
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowReal(false)}
                  className={`btn-ghost text-xs ${!showReal ? 'text-ledger-gold' : ''}`}
                >
                  Nominal
                </button>
                <button
                  type="button"
                  onClick={() => setShowReal(true)}
                  className={`btn-ghost text-xs ${showReal ? 'text-ledger-gold' : ''}`}
                >
                  Real
                </button>
              </div>
            }
          >
            <p className="mb-4 text-sm text-ledger-muted">
              Median path with best-case (90th) and worst-case (10th) percentiles ·{' '}
              {monteCarlo.simulations} simulations · Success rate at retirement:{' '}
              {formatPercent(monteCarlo.successRate, 0)}
            </p>
            <MonteCarloFanChart
              data={monteCarlo.years.filter((_, i) => i % 2 === 0 || i === monteCarlo.years.length - 1)}
              currency={profile.currency}
              showReal={showReal}
            />
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-ledger-muted">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-ledger-gold" /> Median</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-ledger-success" /> Best case</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-ledger-danger" /> Worst case</span>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
