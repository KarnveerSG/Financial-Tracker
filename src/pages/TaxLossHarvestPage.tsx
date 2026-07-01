import { useMemo } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, SectionCard } from '../components/shared/MetricCard'
import { useFinanceStore } from '../store/useFinanceStore'
import { findTLHCandidates, summarizeTLH } from '../engine/taxLossHarvest'
import { formatCurrency } from '../engine/format'

export function TaxLossHarvestPage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const priceCache = useFinanceStore((s) => s.priceCache)
  const currency = scenario.profile.currency

  const candidates = useMemo(() => findTLHCandidates(scenario.accounts, priceCache), [scenario.accounts, priceCache])
  const summary = summarizeTLH(candidates)

  return (
    <div>
      <PageHeader title="Tax-Loss Harvesting" subtitle="Unrealized losses in taxable accounts that could offset gains at year end" />

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Candidate lots" value={String(summary.candidateCount)} />
        <MetricCard label="Total unrealized loss" value={formatCurrency(summary.totalUnrealizedLoss, currency)} trend="down" />
        <MetricCard label="Short-term" value={formatCurrency(summary.shortTermLoss, currency)} />
        <MetricCard label="Long-term" value={formatCurrency(summary.longTermLoss, currency)} />
      </div>

      <SectionCard title="Loss candidates by lot">
        {candidates.length === 0 ? (
          <p className="text-sm text-ledger-muted">
            No unrealized losses found. Losses only surface for lots in taxable accounts (brokerage, ESPP, crypto)
            where the current price is below the lot's cost basis.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ledger-muted">
                <th className="pb-2">Account</th>
                <th className="pb-2">Ticker</th>
                <th className="pb-2">Acquired</th>
                <th className="pb-2 text-right">Shares</th>
                <th className="pb-2 text-right">Cost</th>
                <th className="pb-2 text-right">Current</th>
                <th className="pb-2 text-right">Loss</th>
                <th className="pb-2">Term</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.lotId} className="border-t border-ledger-border">
                  <td className="py-1.5">{c.accountName}</td>
                  <td className="py-1.5">{c.ticker}</td>
                  <td className="py-1.5 tabular-nums text-ledger-muted">{c.acquiredDate}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.shares.toFixed(2)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCurrency(c.costPerShare, currency)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCurrency(c.currentPrice, currency)}</td>
                  <td className="py-1.5 text-right tabular-nums text-ledger-danger">{formatCurrency(c.unrealizedGain, currency)}</td>
                  <td className="py-1.5 text-xs text-ledger-muted">{c.isShortTerm ? 'ST' : 'LT'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-4 text-xs text-ledger-muted">
          Reminder: wash-sale rules disallow the loss if you (or your spouse) repurchase the same or a substantially
          identical security within 30 days before or after the sale.
        </p>
      </SectionCard>
    </div>
  )
}
