import type { Account, StockHolding, StockTransaction, TaxLot } from '../types'
import { createId } from './format'

export function applyTransactionToAccounts(accounts: Account[], tx: StockTransaction): Account[] {
  return accounts.map((account) => {
    if (account.id !== tx.accountId) return account
    const holdings = [...(account.holdings ?? [])]
    const idx = holdings.findIndex((h) => h.ticker.trim().toUpperCase() === tx.ticker)
    const existing = idx >= 0 ? { ...holdings[idx], lots: [...(holdings[idx].lots ?? [])] } : null

    if (tx.kind === 'buy') {
      const newLot: TaxLot = {
        id: createId(),
        shares: tx.shares,
        costPerShare: tx.pricePerShare,
        acquiredDate: tx.date,
      }
      if (existing) {
        const totalShares = existing.shares + tx.shares
        const totalCost = existing.shares * existing.pricePerShare + tx.shares * tx.pricePerShare
        existing.shares = totalShares
        existing.pricePerShare = totalShares > 0 ? totalCost / totalShares : tx.pricePerShare
        existing.lots = [...(existing.lots ?? []), newLot]
        holdings[idx] = existing
      } else {
        const holding: StockHolding = {
          id: createId(),
          ticker: tx.ticker,
          shares: tx.shares,
          pricePerShare: tx.pricePerShare,
          lots: [newLot],
        }
        holdings.push(holding)
      }
    } else if (tx.kind === 'sell') {
      if (!existing) return account
      let remaining = tx.shares
      const nextLots: TaxLot[] = []
      for (const lot of existing.lots ?? []) {
        if (remaining <= 0) { nextLots.push(lot); continue }
        if (lot.shares <= remaining) {
          remaining -= lot.shares
        } else {
          nextLots.push({ ...lot, shares: lot.shares - remaining })
          remaining = 0
        }
      }
      existing.lots = nextLots
      existing.shares = Math.max(0, existing.shares - tx.shares)
      if (existing.shares <= 0) {
        holdings.splice(idx, 1)
      } else {
        holdings[idx] = existing
      }
    }

    let nextBalance = account.balance
    if (tx.kind === 'buy') nextBalance = account.balance
    if (tx.kind === 'dividend') nextBalance = account.balance + tx.amount

    return {
      ...account,
      holdings,
      balance: nextBalance,
    }
  })
}
