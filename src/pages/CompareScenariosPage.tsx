import { useMemo } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { SectionCard } from '../components/shared/MetricCard'
import { useFinanceStore } from '../store/useFinanceStore'
import { calculateCoastFiResults, calculateFireResults, estimateFireProbability } from '../engine/fire'
import { computeDashboardMetrics } from '../engine/accounts'
import { formatCurrency, formatPercent } from '../engine/format'

export function CompareScenariosPage() {
  const scenarios = useFinanceStore((s) => s.scenarios)
  const activeScenarioId = useFinanceStore((s) => s.activeScenarioId)

  const rows = useMemo(() => {
    return scenarios.map((scenario) => {
      const fire = calculateFireResults(scenario)
      const coast = calculateCoastFiResults(scenario)
      const metrics = computeDashboardMetrics(scenario, fire.fireNumber, coast.coastFiNumber)
      const successRate = estimateFireProbability(scenario, 150)

      return {
        id: scenario.id,
        name: scenario.name,
        isActive: scenario.id === activeScenarioId,
        netWorth: metrics.netWorth,
        netWorthSource: metrics.netWorthSource ?? 'accounts',
        fireNumber: fire.fireNumber,
        yearsUntilFi: fire.yearsUntilFi,
        coastFiNumber: coast.coastFiNumber,
        coastFiAge: coast.coastFiAge,
        fiProgress: metrics.fiProgress,
        savingsRate: metrics.savingsRate,
        successRate,
      }
    })
  }, [scenarios, activeScenarioId])

  const currency = scenarios.find((s) => s.id === activeScenarioId)?.profile.currency ?? 'USD'

  return (
    <div>
      <PageHeader
        title="Compare Scenarios"
        subtitle="Side-by-side FIRE, CoastFI, and net worth metrics across all scenarios"
      />

      {rows.length < 2 ? (
        <SectionCard title="Need more scenarios">
          <p className="text-sm text-ledger-muted">
            Create additional scenarios in Settings (e.g. Base, Aggressive, Frugal) to compare them here.
          </p>
        </SectionCard>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-ledger-border text-ledger-muted">
                <th className="px-3 py-2">Scenario</th>
                <th className="px-3 py-2 text-right">Net Worth</th>
                <th className="px-3 py-2 text-right">FIRE #</th>
                <th className="px-3 py-2 text-right">Years to FI</th>
                <th className="px-3 py-2 text-right">CoastFI #</th>
                <th className="px-3 py-2 text-right">Coast age</th>
                <th className="px-3 py-2 text-right">FI %</th>
                <th className="px-3 py-2 text-right">Savings %</th>
                <th className="px-3 py-2 text-right">FIRE prob.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-ledger-border/30 ${row.isActive ? 'bg-ledger-gold/5' : ''}`}
                >
                  <td className="px-3 py-2 font-medium">
                    {row.name}
                    {row.isActive && (
                      <span className="ml-2 rounded-full bg-ledger-gold/15 px-2 py-0.5 text-xs text-ledger-gold">
                        active
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(row.netWorth, currency)}
                    <div className="text-xs text-ledger-muted">{row.netWorthSource}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.fireNumber, currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.yearsUntilFi ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.coastFiNumber, currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.coastFiAge ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPercent(row.fiProgress)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPercent(row.savingsRate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPercent(row.successRate, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
