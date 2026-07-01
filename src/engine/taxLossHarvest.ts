import type { Account, PriceQuote, StockHolding, TaxLot } from '../types'

export interface TLHCandidate {
  accountId: string
  accountName: string
  ticker: string
  lotId: string
  shares: number
  costPerShare: number
  currentPrice: number
  acquiredDate: string
  unrealizedGain: number
  gainPerShare: number
  isShortTerm: boolean
}

/** Surfaces unrealized-loss lots as tax-loss harvesting candidates.
 *  Only considers taxable accounts (brokerage / crypto / espp). */
export function findTLHCandidates(
  accounts: Account[],
  priceCache: Record<string, PriceQuote>
): TLHCandidate[] {
  const out: TLHCandidate[] = []
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const isTaxable = (t: Account['accountType']) => t === 'brokerage' || t === 'crypto' || t === 'espp'

  for (const account of accounts) {
    if (!isTaxable(account.accountType)) continue
    for (const holding of account.holdings ?? []) {
      const currentPrice = getCurrentPrice(holding, priceCache)
      const lots = holding.lots ?? []
      for (const lot of lots) {
        const gainPerShare = currentPrice - lot.costPerShare
        const unrealized = gainPerShare * lot.shares
        if (unrealized < 0) {
          out.push({
            accountId: account.id,
            accountName: account.name,
            ticker: holding.ticker,
            lotId: lot.id,
            shares: lot.shares,
            costPerShare: lot.costPerShare,
            currentPrice,
            acquiredDate: lot.acquiredDate,
            unrealizedGain: unrealized,
            gainPerShare,
            isShortTerm: new Date(lot.acquiredDate) > oneYearAgo,
          })
        }
      }
    }
  }
  return out.sort((a, b) => a.unrealizedGain - b.unrealizedGain)
}

function getCurrentPrice(holding: StockHolding, priceCache: Record<string, PriceQuote>): number {
  const key = holding.ticker.trim().toUpperCase()
  const q = priceCache[key]
  return q?.price ?? holding.pricePerShare
}

export function summarizeTLH(candidates: TLHCandidate[]): {
  totalUnrealizedLoss: number
  shortTermLoss: number
  longTermLoss: number
  candidateCount: number
} {
  let total = 0
  let short = 0
  let long = 0
  for (const c of candidates) {
    total += c.unrealizedGain
    if (c.isShortTerm) short += c.unrealizedGain
    else long += c.unrealizedGain
  }
  return { totalUnrealizedLoss: total, shortTermLoss: short, longTermLoss: long, candidateCount: candidates.length }
}

/** Fake TaxLot type import guard */
export type { TaxLot }
