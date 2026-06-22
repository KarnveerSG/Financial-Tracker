import { useEffect, useMemo, useState, Fragment } from 'react'
import { AllocationPieChart } from '../charts/FinanceCharts'
import { useFinanceStore } from '../../store/useFinanceStore'
import { getPortfolioBreakdown } from '../../engine/networth'
import { aggregateGainLoss } from '../../engine/costBasis'
import { formatCurrency, formatPercent } from '../../engine/format'
import { isQuoteStale, getQuoteCacheTtlMs } from '../../engine/prices'
import type { Currency, PortfolioBreakdownTab } from '../../types'

const TABS: { id: PortfolioBreakdownTab; label: string }[] = [
  { id: 'taxBucket', label: 'Tax bucket' },
  { id: 'treatment', label: 'Pretax vs Post-tax' },
  { id: 'accountType', label: 'Account type' },
  { id: 'ticker', label: 'By ticker' },
  { id: 'costBasis', label: 'Cost basis' },
]

type GainFilter = 'all' | 'gains' | 'losses'

export function PortfolioBreakdown() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const priceCache = useFinanceStore((s) => s.priceCache)
  const { updateUiState, refreshPrices } = useFinanceStore()
  const { accounts, allocationCategories, profile } = scenario
  const uiState = scenario.uiState ?? { portfolioBreakdownTab: 'taxBucket' as const }
  const activeTab = uiState.portfolioBreakdownTab

  const [expandedTickers, setExpandedTickers] = useState<Record<string, boolean>>({})
  const [gainFilter, setGainFilter] = useState<GainFilter>('all')
  const [priceWarning, setPriceWarning] = useState('')

  const livePrices = useMemo(() => {
    const map: Record<string, number> = {}
    for (const [ticker, quote] of Object.entries(priceCache)) {
      map[ticker] = quote.price
    }
    return map
  }, [priceCache])

  const breakdown = useMemo(
    () => getPortfolioBreakdown(accounts, allocationCategories, livePrices),
    [accounts, allocationCategories, livePrices]
  )

  const gainLoss = useMemo(
    () => aggregateGainLoss(accounts, undefined, livePrices),
    [accounts, livePrices]
  )

  const filteredGainRows = useMemo(() => {
    if (gainFilter === 'gains') return gainLoss.perTicker.filter((r) => r.unrealizedGain > 0)
    if (gainFilter === 'losses') return gainLoss.perTicker.filter((r) => r.unrealizedGain < 0)
    return gainLoss.perTicker
  }, [gainLoss.perTicker, gainFilter])

  useEffect(() => {
    if (!profile.marketData.livePricesEnabled) return
    const hasHoldings = accounts.some((a) => a.holdings?.length)
    if (!hasHoldings) return

    const last = profile.marketData.lastPriceRefresh
    if (last && Date.now() - new Date(last).getTime() < getQuoteCacheTtlMs()) return

    void refreshPrices().catch(() => {
      setPriceWarning('Could not refresh live prices — using manual values')
    })
  }, [profile.marketData.livePricesEnabled, profile.marketData.lastPriceRefresh, accounts, refreshPrices])

  const tabData = useMemo(() => {
    switch (activeTab) {
      case 'taxBucket':
        return breakdown.byTaxBucket
      case 'treatment':
        return breakdown.byTreatment
      case 'accountType':
        return breakdown.byAccountType
      default:
        return []
    }
  }, [activeTab, breakdown])

  const lastRefresh = profile.marketData.lastPriceRefresh
  const staleQuotes = Object.values(priceCache).some((q) => isQuoteStale(q.asOf))

  return (
    <div>
      <p className="mb-4 text-xs text-ledger-muted">
        Based on current account balances and holdings, not historical snapshots.
      </p>

      {profile.marketData.livePricesEnabled && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-ledger-muted">
          {lastRefresh && (
            <span>
              Prices: {profile.marketData.quoteProvider}
              {Object.values(priceCache)[0]?.source && ` · ${Object.values(priceCache)[0].source}`}
              {' · '}
              {formatRelativeTime(lastRefresh)}
            </span>
          )}
          {staleQuotes && (
            <span className="rounded-full bg-ledger-elevated px-2 py-0.5 text-ledger-danger">Stale (&gt;24h)</span>
          )}
          {priceWarning && (
            <span className="rounded-full bg-ledger-elevated px-2 py-0.5">{priceWarning}</span>
          )}
          <button type="button" className="btn-ghost text-xs" onClick={() => void refreshPrices()}>
            Refresh prices
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => updateUiState({ portfolioBreakdownTab: tab.id })}
            className={`rounded-xl px-3 py-1.5 text-sm ${
              activeTab === tab.id
                ? 'bg-ledger-gold/15 font-medium text-ledger-gold'
                : 'text-ledger-muted hover:bg-ledger-elevated'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'ticker' && (
        breakdown.byTicker.length === 0 ? (
          <p className="text-sm text-ledger-muted">No stock holdings configured. Add tickers on the Accounts page.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <AllocationPieChart
              data={breakdown.byTicker.map((row) => ({
                label: row.ticker,
                value: row.marketValue,
                color: row.ticker === 'Uncategorized cash/funds' ? '#9aa5b8' : '#c9a962',
              }))}
              currency={profile.currency}
            />
            <TickerTable
              rows={breakdown.byTicker}
              currency={profile.currency}
              expanded={expandedTickers}
              onToggle={(ticker) => setExpandedTickers((prev) => ({ ...prev, [ticker]: !prev[ticker] }))}
            />
          </div>
        )
      )}

      {activeTab === 'costBasis' && (
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {(['all', 'gains', 'losses'] as GainFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setGainFilter(f)}
                className={`rounded-xl px-3 py-1 text-sm capitalize ${
                  gainFilter === f ? 'bg-ledger-gold/15 text-ledger-gold' : 'text-ledger-muted hover:bg-ledger-elevated'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {filteredGainRows.length === 0 ? (
            <p className="text-sm text-ledger-muted">No holdings with cost basis data.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ledger-border text-ledger-muted">
                    <th className="px-2 py-2">Ticker</th>
                    <th className="px-2 py-2 text-right">Shares</th>
                    <th className="px-2 py-2 text-right">Avg cost</th>
                    <th className="px-2 py-2 text-right">Price</th>
                    <th className="px-2 py-2 text-right">Value</th>
                    <th className="px-2 py-2 text-right">Unrealized</th>
                    <th className="px-2 py-2 text-right">%</th>
                    <th className="px-2 py-2 text-right">ST gain</th>
                    <th className="px-2 py-2 text-right">LT gain</th>
                    <th className="px-2 py-2 text-right">Unknown</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGainRows.map((row) => (
                    <tr key={row.ticker} className="border-b border-ledger-border/30">
                      <td className="px-2 py-1.5 font-medium">{row.ticker}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{row.totalShares.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(row.avgCostPerShare, profile.currency)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(row.currentPrice, profile.currency)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(row.marketValue, profile.currency)}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${row.unrealizedGain >= 0 ? 'text-ledger-success' : 'text-ledger-danger'}`}>
                        {formatCurrency(row.unrealizedGain, profile.currency)}
                      </td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${row.unrealizedGainPct >= 0 ? 'text-ledger-success' : 'text-ledger-danger'}`}>
                        {formatPercent(row.unrealizedGainPct * 100)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(row.shortTermGain, profile.currency)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(row.longTermGain, profile.currency)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {row.unknownTermShares > 0 ? formatCurrency(row.unknownTermGain, profile.currency) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab !== 'ticker' && activeTab !== 'costBasis' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <AllocationPieChart
            data={tabData.map((d) => ({ label: d.label, value: d.value, color: d.color }))}
            currency={profile.currency}
          />
          <BreakdownTable rows={tabData} currency={profile.currency} total={breakdown.total} />
        </div>
      )}

      <p className="mt-4 text-xs text-ledger-muted tabular-nums">
        Total: {formatCurrency(breakdown.total, profile.currency)}
      </p>
    </div>
  )
}

function BreakdownTable({
  rows,
  currency,
  total,
}: {
  rows: { label: string; value: number; percent: number }[]
  currency: Currency
  total: number
}) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-ledger-border text-ledger-muted">
          <th className="px-2 py-2">Category</th>
          <th className="px-2 py-2 text-right">Value</th>
          <th className="px-2 py-2 text-right">%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-ledger-border/30">
            <td className="px-2 py-1.5">{row.label}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(row.value, currency)}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{formatPercent((total > 0 ? row.value / total : row.percent) * 100)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TickerTable({
  rows,
  currency,
  expanded,
  onToggle,
}: {
  rows: ReturnType<typeof getPortfolioBreakdown>['byTicker']
  currency: Currency
  expanded: Record<string, boolean>
  onToggle: (ticker: string) => void
}) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-ledger-border text-ledger-muted">
          <th className="px-2 py-2">Ticker</th>
          <th className="px-2 py-2 text-right">Shares</th>
          <th className="px-2 py-2 text-right">Avg price</th>
          <th className="px-2 py-2 text-right">Value</th>
          <th className="px-2 py-2 text-right">%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Fragment key={row.ticker}>
            <tr
              className="border-b border-ledger-border/30 cursor-pointer hover:bg-ledger-elevated/30"
              onClick={() => row.accounts.length > 0 && onToggle(row.ticker)}
            >
              <td className="px-2 py-1.5 font-medium">
                {row.accounts.length > 0 && (expanded[row.ticker] ? '▾ ' : '▸ ')}
                {row.ticker}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{row.totalShares > 0 ? row.totalShares.toFixed(2) : '—'}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{row.avgPrice > 0 ? formatCurrency(row.avgPrice, currency) : '—'}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(row.marketValue, currency)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatPercent(row.percent * 100)}</td>
            </tr>
            {expanded[row.ticker] &&
              row.accounts.map((acct) => (
                <tr key={`${row.ticker}-${acct.accountName}`} className="border-b border-ledger-border/20 bg-ledger-elevated/20">
                  <td className="px-2 py-1 pl-6 text-ledger-muted">{acct.accountName}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ledger-muted">{acct.shares.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right text-ledger-muted">{acct.taxTreatment}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ledger-muted">{formatCurrency(acct.marketValue, currency)}</td>
                  <td />
                </tr>
              ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString()
}
