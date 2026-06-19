import type { Account, AllocationCategoryDef, Scenario, StockHolding } from '../types'
import { ACCOUNT_TYPES } from '../types'

export interface DashboardMetrics {
  netWorth: number
  totalInvested: number
  cashHoldings: number
  retirementAccounts: number
  brokerageAccounts: number
  debt: number
  savingsRate: number
  fiProgress: number
  coastFiProgress: number
  monthlyContributions: number
  annualContributions: number
}

const RETIREMENT_TYPES = new Set(['401k', 'roth_401k', 'traditional_ira', 'roth_ira', 'hsa', 'pension'])
const CASH_TYPES = new Set(['hysa', 'checking', 'savings'])
const BROKERAGE_TYPES = new Set(['brokerage', 'espp', 'crypto'])

export function getHoldingsValue(holdings: StockHolding[]): number {
  return holdings.reduce((sum, h) => sum + h.shares * h.pricePerShare, 0)
}

export function resolveAccountBalance(account: Account): number {
  if (account.syncBalanceFromHoldings && account.holdings?.length) {
    return getHoldingsValue(account.holdings)
  }
  return account.balance
}

export function sumBalances(accounts: Account[], filter: (a: Account) => boolean): number {
  return accounts.filter(filter).reduce((sum, a) => sum + resolveAccountBalance(a), 0)
}

export function sumContributions(accounts: Account[], filter?: (a: Account) => boolean): number {
  return accounts
    .filter((a) => !a.isLiability && (!filter || filter(a)))
    .reduce((sum, a) => sum + a.monthlyContribution * (1 + a.employerMatchPercent / 100), 0)
}

export function getAllocationBreakdown(
  accounts: Account[],
  categories: AllocationCategoryDef[]
): { id: string; label: string; value: number; color: string }[] {
  const assetAccounts = accounts.filter((a) => !a.isLiability && resolveAccountBalance(a) > 0)
  const map = new Map<string, number>()

  for (const account of assetAccounts) {
    const cat = account.allocationCategory
    const balance = resolveAccountBalance(account)
    map.set(cat, (map.get(cat) ?? 0) + balance)
  }

  return Array.from(map.entries())
    .map(([id, value]) => {
      const def = categories.find((c) => c.id === id)
      return {
        id,
        label: def?.label ?? id,
        value,
        color: def?.color ?? '#9aa5b8',
      }
    })
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
}

export function computeDashboardMetrics(
  scenario: Scenario,
  fiNumber: number,
  coastFiNumber: number
): DashboardMetrics {
  const { accounts, profile, paycheckInputs } = scenario
  const assets = accounts.filter((a) => !a.isLiability)
  const liabilities = accounts.filter((a) => a.isLiability)

  const netWorth =
    assets.reduce((s, a) => s + resolveAccountBalance(a), 0) -
    liabilities.reduce((s, a) => s + resolveAccountBalance(a), 0)

  const totalInvested = assets
    .filter((a) => a.taxTreatment !== 'none' || RETIREMENT_TYPES.has(a.accountType) || BROKERAGE_TYPES.has(a.accountType))
    .filter((a) => !CASH_TYPES.has(a.accountType) || a.accountType === 'hysa')
    .reduce((s, a) => s + resolveAccountBalance(a), 0)

  const cashHoldings = sumBalances(assets, (a) => CASH_TYPES.has(a.accountType))
  const retirementAccounts = sumBalances(assets, (a) => RETIREMENT_TYPES.has(a.accountType))
  const brokerageAccounts = sumBalances(assets, (a) => BROKERAGE_TYPES.has(a.accountType))
  const debt = liabilities.reduce((s, a) => s + resolveAccountBalance(a), 0)

  const monthlyContributions = sumContributions(accounts)
  const annualContributions = monthlyContributions * 12

  const grossAnnual =
    paycheckInputs.salary + paycheckInputs.bonus || profile.annualSalary || 1
  const savingsRate = grossAnnual > 0 ? (annualContributions / grossAnnual) * 100 : 0

  const investedForFi = assets
    .filter((a) => !a.isLiability)
    .reduce((s, a) => s + resolveAccountBalance(a), 0)

  const fiProgress = fiNumber > 0 ? (investedForFi / fiNumber) * 100 : 0
  const coastFiProgress = coastFiNumber > 0 ? (investedForFi / coastFiNumber) * 100 : 0

  return {
    netWorth,
    totalInvested,
    cashHoldings,
    retirementAccounts,
    brokerageAccounts,
    debt,
    savingsRate,
    fiProgress,
    coastFiProgress,
    monthlyContributions,
    annualContributions,
  }
}

export function createDefaultAccount(partial?: Partial<Account>): Account {
  const type = partial?.accountType ?? 'brokerage'
  const meta = ACCOUNT_TYPES.find((t) => t.value === type) ?? ACCOUNT_TYPES[0]

  return {
    id: partial?.id ?? crypto.randomUUID(),
    name: partial?.name ?? 'New Account',
    accountType: type,
    balance: partial?.balance ?? 0,
    monthlyContribution: partial?.monthlyContribution ?? 0,
    expectedAnnualReturn: partial?.expectedAnnualReturn ?? 7,
    taxTreatment: partial?.taxTreatment ?? meta.defaultTax,
    employerMatchPercent: partial?.employerMatchPercent ?? 0,
    contributionIncreaseRate: partial?.contributionIncreaseRate ?? 0,
    allocationCategory: partial?.allocationCategory ?? meta.defaultCategory,
    isLiability: partial?.isLiability ?? !!meta.isLiability,
    interestRate: partial?.interestRate ?? 0,
    loanTermMonths: partial?.loanTermMonths ?? 0,
    holdings: partial?.holdings ?? [],
    syncBalanceFromHoldings: partial?.syncBalanceFromHoldings ?? false,
    notes: partial?.notes ?? '',
  }
}

export function accountsToCsv(accounts: Account[]): string {
  const headers = [
    'name', 'accountType', 'balance', 'monthlyContribution', 'expectedAnnualReturn',
    'taxTreatment', 'employerMatchPercent', 'contributionIncreaseRate', 'allocationCategory',
    'isLiability', 'interestRate', 'loanTermMonths', 'syncBalanceFromHoldings', 'holdings', 'notes',
  ]
  const rows = accounts.map((a) =>
    headers.map((h) => {
      const val = a[h as keyof Account]
      const str = String(val ?? '')
      return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str
    }).join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

export function parseAccountsCsv(csv: string): Account[] {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    return createDefaultAccount({
      name: row.name,
      accountType: row.accountType as Account['accountType'],
      balance: parseFloat(row.balance) || 0,
      monthlyContribution: parseFloat(row.monthlyContribution) || 0,
      expectedAnnualReturn: parseFloat(row.expectedAnnualReturn) || 7,
      taxTreatment: row.taxTreatment as Account['taxTreatment'],
      employerMatchPercent: parseFloat(row.employerMatchPercent) || 0,
      contributionIncreaseRate: parseFloat(row.contributionIncreaseRate) || 0,
      allocationCategory: row.allocationCategory,
      isLiability: row.isLiability === 'true',
      interestRate: parseFloat(row.interestRate) || 0,
      loanTermMonths: parseInt(row.loanTermMonths, 10) || 0,
      syncBalanceFromHoldings: row.syncBalanceFromHoldings === 'true',
      holdings: row.holdings ? JSON.parse(row.holdings) : [],
      notes: row.notes,
    })
  })
}
