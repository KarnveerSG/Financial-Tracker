import type { Account, StockHolding } from '../types'
import { todayISO } from './format'
import { getHoldingsValue } from './accounts'

export interface HoldingGainLoss {
  ticker: string
  marketValue: number
  totalCost: number
  unrealizedGain: number
  unrealizedGainPct: number
  shortTermShares: number
  longTermShares: number
  unknownTermShares: number
  unknownTermGain: number
  shortTermGain: number
  longTermGain: number
  avgCostPerShare: number
  currentPrice: number
  totalShares: number
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  return Math.round((e - s) / (1000 * 60 * 60 * 24))
}

function getEffectiveLots(holding: StockHolding): Array<{ shares: number; costPerShare: number; acquiredDate: string | null }> {
  if (holding.lots && holding.lots.length > 0) {
    return holding.lots.map((lot) => ({
      shares: lot.shares,
      costPerShare: lot.costPerShare,
      acquiredDate: lot.acquiredDate || null,
    }))
  }
  return [{ shares: holding.shares, costPerShare: holding.pricePerShare, acquiredDate: todayISO() }]
}

export function getHoldingShares(holding: StockHolding): number {
  if (holding.lots && holding.lots.length > 0) {
    return holding.lots.reduce((sum, lot) => sum + lot.shares, 0)
  }
  return holding.shares
}

export function computeHoldingGainLoss(
  holding: StockHolding,
  currentPrice?: number,
  asOfDate = todayISO()
): HoldingGainLoss {
  const price = currentPrice ?? holding.pricePerShare
  const lots = getEffectiveLots(holding)
  const totalShares = lots.reduce((sum, lot) => sum + lot.shares, 0)
  const totalCost = lots.reduce((sum, lot) => sum + lot.shares * lot.costPerShare, 0)
  const marketValue = totalShares * price
  const unrealizedGain = marketValue - totalCost
  const unrealizedGainPct = totalCost > 0 ? unrealizedGain / totalCost : 0

  let shortTermShares = 0
  let longTermShares = 0
  let unknownTermShares = 0
  let unknownTermGain = 0
  let shortTermGain = 0
  let longTermGain = 0

  for (const lot of lots) {
    const lotCost = lot.shares * lot.costPerShare
    const lotValue = lot.shares * price
    const lotGain = lotValue - lotCost

    if (!lot.acquiredDate) {
      unknownTermShares += lot.shares
      unknownTermGain += lotGain
      continue
    }

    const heldDays = daysBetween(lot.acquiredDate, asOfDate)
    if (heldDays <= 365) {
      shortTermShares += lot.shares
      shortTermGain += lotGain
    } else {
      longTermShares += lot.shares
      longTermGain += lotGain
    }
  }

  return {
    ticker: holding.ticker,
    marketValue,
    totalCost,
    unrealizedGain,
    unrealizedGainPct,
    shortTermShares,
    longTermShares,
    unknownTermShares,
    unknownTermGain,
    shortTermGain,
    longTermGain,
    avgCostPerShare: totalShares > 0 ? totalCost / totalShares : 0,
    currentPrice: price,
    totalShares,
  }
}

export function aggregateGainLoss(accounts: Account[], asOfDate = todayISO(), priceOverrides?: Record<string, number>) {
  const perAccount: Array<{ accountId: string; accountName: string; gainLoss: HoldingGainLoss[] }> = []
  const tickerMap = new Map<string, HoldingGainLoss>()

  for (const account of accounts) {
    if (account.isLiability || !account.holdings?.length) continue
    const accountGainLoss: HoldingGainLoss[] = []

    for (const holding of account.holdings) {
      const price = priceOverrides?.[holding.ticker.toUpperCase()] ?? holding.pricePerShare
      const gl = computeHoldingGainLoss(holding, price, asOfDate)
      accountGainLoss.push(gl)

      const key = holding.ticker.toUpperCase()
      const existing = tickerMap.get(key)
      if (existing) {
        const totalShares = existing.totalShares + gl.totalShares
        const totalCost = existing.totalCost + gl.totalCost
        const marketValue = existing.marketValue + gl.marketValue
        tickerMap.set(key, {
          ticker: key,
          totalShares,
          totalCost,
          marketValue,
          unrealizedGain: marketValue - totalCost,
          unrealizedGainPct: totalCost > 0 ? (marketValue - totalCost) / totalCost : 0,
          shortTermShares: existing.shortTermShares + gl.shortTermShares,
          longTermShares: existing.longTermShares + gl.longTermShares,
          unknownTermShares: existing.unknownTermShares + gl.unknownTermShares,
          unknownTermGain: existing.unknownTermGain + gl.unknownTermGain,
          shortTermGain: existing.shortTermGain + gl.shortTermGain,
          longTermGain: existing.longTermGain + gl.longTermGain,
          avgCostPerShare: totalShares > 0 ? totalCost / totalShares : 0,
          currentPrice: price,
        })
      } else {
        tickerMap.set(key, { ...gl, ticker: key })
      }
    }

    if (accountGainLoss.length > 0) {
      perAccount.push({ accountId: account.id, accountName: account.name, gainLoss: accountGainLoss })
    }
  }

  const perTicker = Array.from(tickerMap.values()).sort((a, b) => b.marketValue - a.marketValue)
  const totals = perTicker.reduce(
    (acc, row) => ({
      marketValue: acc.marketValue + row.marketValue,
      totalCost: acc.totalCost + row.totalCost,
      unrealizedGain: acc.unrealizedGain + row.unrealizedGain,
      shortTerm: acc.shortTerm + row.shortTermGain,
      longTerm: acc.longTerm + row.longTermGain,
    }),
    { marketValue: 0, totalCost: 0, unrealizedGain: 0, shortTerm: 0, longTerm: 0 }
  )

  return { perTicker, perAccount, totals }
}

export function getUncategorizedCash(account: Account): number {
  if (!account.holdings?.length) return 0
  const holdingsValue = getHoldingsValue(account.holdings)
  const gap = account.balance - holdingsValue
  return gap > 0 ? gap : 0
}
