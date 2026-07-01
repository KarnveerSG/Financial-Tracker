import { useMemo, useState } from 'react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { formatCurrency, formatCurrencyPrecise, formatPercent } from '../../engine/format'
import { SectionCard } from './MetricCard'

interface OwnRow {
  ticker: string
  shares: number
  avgCost: number
  currentPrice: number
  marketValue: number
  costBasis: number
  gain: number
  gainPct: number
  accounts: string[]
}

export function WhatIOwnPanel() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const priceCache = useFinanceStore((s) => s.priceCache)
  const refreshPrices = useFinanceStore((s) => s.refreshPrices)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const rows = useMemo<OwnRow[]>(() => {
    const map = new Map<string, OwnRow>()
    for (const account of scenario.accounts) {
      for (const holding of account.holdings ?? []) {
        const ticker = holding.ticker.trim().toUpperCase()
        if (!ticker) continue
        const live = priceCache[ticker]?.price
        const price = live ?? holding.pricePerShare
        const existing = map.get(ticker)
        if (existing) {
          existing.shares += holding.shares
          existing.costBasis += holding.shares * holding.pricePerShare
          existing.marketValue += holding.shares * price
          existing.currentPrice = price
          if (!existing.accounts.includes(account.name)) existing.accounts.push(account.name)
        } else {
          map.set(ticker, {
            ticker,
            shares: holding.shares,
            avgCost: holding.pricePerShare,
            currentPrice: price,
            marketValue: holding.shares * price,
            costBasis: holding.shares * holding.pricePerShare,
            gain: 0,
            gainPct: 0,
            accounts: [account.name],
          })
        }
      }
    }
    for (const row of map.values()) {
      row.avgCost = row.shares > 0 ? row.costBasis / row.shares : 0
      row.gain = row.marketValue - row.costBasis
      row.gainPct = row.costBasis > 0 ? (row.gain / row.costBasis) * 100 : 0
    }
    return [...map.values()].sort((a, b) => b.marketValue - a.marketValue)
  }, [scenario.accounts, priceCache])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({ marketValue: acc.marketValue + r.marketValue, costBasis: acc.costBasis + r.costBasis }),
      { marketValue: 0, costBasis: 0 }
    )
  }, [rows])

  const handleRefresh = async () => {
    setRefreshing(true)
    setError('')
    try {
      await refreshPrices()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const currency = scenario.profile.currency
  const lastRefresh = scenario.profile.marketData.lastPriceRefresh

  return (
    <SectionCard
      title="What I Own"
      action={
        <div className="flex items-center gap-3 text-xs text-ledger-muted">
          {lastRefresh && <span>Updated {new Date(lastRefresh).toLocaleString()}</span>}
          <button type="button" onClick={handleRefresh} disabled={refreshing} className="btn-ghost text-xs text-ledger-gold">
            {refreshing ? 'Refreshing…' : 'Refresh prices'}
          </button>
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-ledger-muted">No holdings tracked yet. Add tickers from Accounts or the setup prompt.</p>
      ) : (
        <>
          <div className="overflow-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-ledger-border text-ledger-muted">
                <tr>
                  <th className="px-2 py-2">Ticker</th>
                  <th className="px-2 py-2 text-right">Shares</th>
                  <th className="px-2 py-2 text-right">Avg cost</th>
                  <th className="px-2 py-2 text-right">Price</th>
                  <th className="px-2 py-2 text-right">Market value</th>
                  <th className="px-2 py-2 text-right">Gain</th>
                  <th className="px-2 py-2">Accounts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.ticker} className="border-b border-ledger-border/30">
                    <td className="px-2 py-2 font-medium">{row.ticker}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.shares.toFixed(4).replace(/\.?0+$/, '')}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrencyPrecise(row.avgCost, currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrencyPrecise(row.currentPrice, currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(row.marketValue, currency)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${row.gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatCurrency(row.gain, currency)} <span className="text-xs">({formatPercent(row.gainPct)})</span>
                    </td>
                    <td className="px-2 py-2 text-xs text-ledger-muted">{row.accounts.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td className="px-2 py-2">Total</td>
                  <td colSpan={3}></td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(totals.marketValue, currency)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${totals.marketValue - totals.costBasis >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(totals.marketValue - totals.costBasis, currency)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          {error && <p className="mt-2 text-sm text-ledger-danger">{error}</p>}
        </>
      )}
    </SectionCard>
  )
}
