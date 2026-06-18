import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, ProgressGauge, SectionCard } from '../components/shared/MetricCard'
import { AllocationPieChart, LineTrendChart } from '../components/charts/FinanceCharts'
import { useFinanceStore } from '../store/useFinanceStore'
import {
  computeDashboardMetrics,
  getAllocationBreakdown,
} from '../engine/accounts'
import { calculateFireResults, calculateCoastFiResults } from '../engine/fire'
import { buildNetWorthGrowthSeries } from '../engine/projections'
import { formatCurrency, formatPercent } from '../engine/format'

export function DashboardPage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const { profile, accounts, allocationCategories } = scenario

  const fire = useMemo(() => calculateFireResults(scenario), [scenario])
  const coast = useMemo(() => calculateCoastFiResults(scenario), [scenario])
  const metrics = useMemo(
    () => computeDashboardMetrics(scenario, fire.fireNumber, coast.coastFiNumber),
    [scenario, fire.fireNumber, coast.coastFiNumber]
  )
  const allocation = useMemo(
    () => getAllocationBreakdown(accounts, allocationCategories),
    [accounts, allocationCategories]
  )
  const growth = useMemo(
    () => buildNetWorthGrowthSeries(accounts, profile, scenario.assumptions),
    [accounts, profile, scenario.assumptions]
  )

  const greeting = profile.name ? `${profile.name}'s overview` : 'Financial overview'

  return (
    <div>
      <PageHeader title={greeting} subtitle="Wealth accumulation, retirement readiness, and FI progress at a glance" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Net Worth" value={formatCurrency(metrics.netWorth, profile.currency)} />
        <MetricCard label="Invested Assets" value={formatCurrency(metrics.totalInvested, profile.currency)} />
        <MetricCard label="Cash Holdings" value={formatCurrency(metrics.cashHoldings, profile.currency)} />
        <MetricCard label="Total Debt" value={formatCurrency(metrics.debt, profile.currency)} trend="down" />
        <MetricCard label="Retirement Accounts" value={formatCurrency(metrics.retirementAccounts, profile.currency)} />
        <MetricCard label="Brokerage" value={formatCurrency(metrics.brokerageAccounts, profile.currency)} />
        <MetricCard
          label="Savings Rate"
          value={formatPercent(metrics.savingsRate)}
          sub={`${formatCurrency(metrics.annualContributions, profile.currency)}/yr saved`}
          trend="up"
        />
        <MetricCard
          label="Monthly Contributions"
          value={formatCurrency(metrics.monthlyContributions, profile.currency)}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ProgressGauge
          label="FI Progress"
          percent={metrics.fiProgress}
          detail={`${formatCurrency(fire.gapRemaining, profile.currency)} to FIRE number`}
          color="#c9a962"
        />
        <ProgressGauge
          label="CoastFI Progress"
          percent={metrics.coastFiProgress}
          detail={
            coast.coastFiAge
              ? `Coast reached at age ${coast.coastFiAge}`
              : `${formatCurrency(coast.additionalSavingsNeeded, profile.currency)} to CoastFI`
          }
          color="#7d9b8a"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Asset Allocation">
          <AllocationPieChart
            data={allocation.map((a) => ({ label: a.label, value: a.value, color: a.color }))}
            currency={profile.currency}
          />
        </SectionCard>

        <SectionCard title="Net Worth Projection">
          <LineTrendChart
            data={growth.filter((_, i) => i % 2 === 0)}
            xKey="age"
            currency={profile.currency}
            lines={[
              { key: 'nominal', color: '#c9a962', label: 'Nominal' },
              { key: 'real', color: '#7d9b8a', label: 'Inflation-adjusted' },
            ]}
          />
        </SectionCard>
      </div>

      {accounts.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 rounded-2xl border border-dashed border-ledger-gold/30 p-8 text-center"
        >
          <p className="text-ledger-muted">No accounts yet. Head to Accounts to build your portfolio.</p>
        </motion.div>
      )}
    </div>
  )
}
