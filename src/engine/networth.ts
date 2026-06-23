import type {
  Account,
  AccountType,
  AllocationCategoryDef,
  NetWorthLineItem,
  NetWorthLineKind,
  NetWorthSide,
  NetWorthSnapshot,
  ProjectionAssumptions,
  Scenario,
  SnapshotWindow,
  TaxTreatment,
  UserProfile,
} from '../types'
import { ACCOUNT_TYPES } from '../types'
import { createId, todayISO } from './format'
import { resolveAccountBalance, sumContributions } from './accounts'

const LIABILITY_TOTAL_LABELS = new Set([
  'car debt - benz(jan/19) - corvette(jul/24)',
  'ira limit',
])

const INVESTMENT_TYPES = new Set<AccountType>([
  '401k',
  'roth_401k',
  'traditional_ira',
  'roth_ira',
  'hsa',
  'brokerage',
  'espp',
  'pension',
  'crypto',
  'hysa',
])

export interface SnapshotTotals {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  totalInvestments: number
  cashEquity: number
}

export interface NetWorthPeriodMetrics {
  startDate: string
  endDate: string
  startNetWorth: number
  endNetWorth: number
  dollarChange: number
  percentChange: number
  estimatedContributions: number
  estimatedDistributions: number
  investmentReturn: number
  investmentRor: number
  cagr: number
  ytdDollarChange: number
  ytdPercentChange: number
}

export interface NetWorthImportResult {
  lineItems: NetWorthLineItem[]
  snapshots: NetWorthSnapshot[]
}

export interface NetWorthChartPoint {
  label: string
  date: string
  netWorth: number
  assets: number
  liabilities: number
  projected?: number
}

function normalizeLabel(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function inferAccountType(name: string): AccountType | undefined {
  const lower = name.toLowerCase()
  if (lower.includes('roth 401') || (lower.includes('401') && lower.includes('roth'))) return 'roth_401k'
  if (lower.includes('401')) return '401k'
  if (lower.includes('roth ira') || (lower.includes('roth') && lower.includes('ira'))) return 'roth_ira'
  if (lower.includes('ira')) return 'traditional_ira'
  if (lower.includes('hsa')) return 'hsa'
  if (lower.includes('529')) return 'custom'
  if (lower.includes('espp')) return 'espp'
  if (lower.includes('brokerage')) return 'brokerage'
  if (lower.includes('checking')) return 'checking'
  if (lower.includes('savings') || lower.includes('hysa')) return lower.includes('hysa') ? 'hysa' : 'savings'
  if (lower.includes('credit card') || lower.includes('discover') || lower.includes('citi') || lower.includes('capitalone')) return 'credit'
  if (lower.includes('car debt') || lower.includes('loan') || lower.includes('debt')) return 'loan'
  if (lower.includes('mortgage')) return 'mortgage'
  if (lower.includes('crypto')) return 'crypto'
  if (lower.includes('real estate') || lower.includes('residence') || lower.includes('rental') || lower.includes('property')) return 'real_estate'
  if (lower.includes('vehicle') || lower.includes('benz') || lower.includes('vette') || lower.includes('corvette')) return 'custom'
  return undefined
}

export function isInvestmentLineItem(item: NetWorthLineItem): boolean {
  if (item.kind !== 'account' || item.side !== 'asset') return false
  if (item.accountType && INVESTMENT_TYPES.has(item.accountType)) {
    return item.accountType !== 'checking' && item.accountType !== 'savings'
  }
  const lower = item.name.toLowerCase()
  if (lower.includes('checking') || (lower.includes('savings') && !lower.includes('equity'))) return false
  return (
    lower.includes('401') ||
    lower.includes('ira') ||
    lower.includes('brokerage') ||
    lower.includes('hsa') ||
    lower.includes('529') ||
    lower.includes('crypto') ||
    lower.includes('espp') ||
    lower.includes('pension') ||
    lower.includes('equity')
  )
}

export function resolveIncludeInTotal(
  normalized: string,
  kind: NetWorthLineKind,
  side: NetWorthSide
): boolean {
  if (kind === 'group' && side === 'asset') return true
  if (side === 'liability' && kind === 'account') {
    return (
      LIABILITY_TOTAL_LABELS.has(normalized) ||
      normalized.startsWith('car debt') ||
      normalized.startsWith('ira limit')
    )
  }
  return false
}

export function computeSnapshotTotals(
  snapshot: NetWorthSnapshot,
  lineItems: NetWorthLineItem[]
): SnapshotTotals {
  const hasGroupBalances = lineItems.some(
    (item) => item.kind === 'group' && snapshot.balances[item.id] != null
  )

  let totalAssets = 0
  let totalLiabilities = 0
  let totalInvestments = 0

  for (const item of lineItems) {
    if (item.kind === 'section' || item.kind === 'total') continue
    const balance = snapshot.balances[item.id]
    if (balance == null) continue

    const includeInTotal = hasGroupBalances
      ? (item.includeInTotal ?? resolveIncludeInTotal(normalizeLabel(item.name), item.kind, item.side))
      : item.kind === 'account'

    if (item.side === 'asset' && includeInTotal) {
      totalAssets += balance
      const groupName = normalizeLabel(item.name)
      if (item.kind === 'group') {
        if (
          groupName === 'taxable accounts' ||
          groupName === 'tax-advantaged accounts' ||
          groupName === 'cryptocurrency'
        ) {
          totalInvestments += balance
        }
      } else if (isInvestmentLineItem(item)) {
        totalInvestments += balance
      }
    }

    if (item.side === 'liability' && includeInTotal) {
      totalLiabilities += balance
    }
  }

  const netWorth = totalAssets - totalLiabilities
  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    totalInvestments,
    cashEquity: netWorth - totalInvestments,
  }
}

function sortSnapshots(snapshots: NetWorthSnapshot[]): NetWorthSnapshot[] {
  return [...snapshots].sort((a, b) => a.date.localeCompare(b.date))
}

/** True when snapshot has entered balances (not an empty / placeholder column). */
export function snapshotHasData(
  snapshot: NetWorthSnapshot,
  lineItems: NetWorthLineItem[]
): boolean {
  if (Object.values(snapshot.balances).some((value) => value != null && value !== 0)) {
    return true
  }
  const totals = computeSnapshotTotals(snapshot, lineItems)
  return totals.totalAssets !== 0 || totals.totalLiabilities !== 0
}

/** Snapshots on or before today that actually contain data — excludes blank future columns. */
export function getEffectiveSnapshots(
  snapshots: NetWorthSnapshot[],
  lineItems: NetWorthLineItem[],
  asOfDate = todayISO()
): NetWorthSnapshot[] {
  return sortSnapshots(snapshots).filter(
    (snapshot) => snapshot.date <= asOfDate && snapshotHasData(snapshot, lineItems)
  )
}

export function getLatestEffectiveSnapshot(
  snapshots: NetWorthSnapshot[],
  lineItems: NetWorthLineItem[],
  asOfDate = todayISO()
): NetWorthSnapshot | null {
  const effective = getEffectiveSnapshots(snapshots, lineItems, asOfDate)
  return effective.at(-1) ?? null
}

export function getDataThroughDate(
  snapshots: NetWorthSnapshot[],
  lineItems: NetWorthLineItem[],
  asOfDate = todayISO()
): string | null {
  return getLatestEffectiveSnapshot(snapshots, lineItems, asOfDate)?.date ?? null
}

function monthsBetween(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  return Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()))
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)))
}

export function computePeriodMetrics(
  snapshots: NetWorthSnapshot[],
  lineItems: NetWorthLineItem[],
  accounts: Account[],
  startDate: string,
  endDate: string,
  assumptions?: ProjectionAssumptions
): NetWorthPeriodMetrics | null {
  const sorted = getEffectiveSnapshots(snapshots, lineItems)
  if (sorted.length === 0) return null

  const effectiveEnd = sorted.at(-1)!.date
  const cappedEndDate = endDate > effectiveEnd ? effectiveEnd : endDate

  const startSnap = sorted.find((s) => s.date >= startDate) ?? sorted[0]
  const endSnap =
    [...sorted].reverse().find((s) => s.date <= cappedEndDate) ?? sorted[sorted.length - 1]
  const startTotals = computeSnapshotTotals(startSnap, lineItems)
  const endTotals = computeSnapshotTotals(endSnap, lineItems)

  const dollarChange = endTotals.netWorth - startTotals.netWorth
  const percentChange =
    startTotals.netWorth !== 0 ? dollarChange / Math.abs(startTotals.netWorth) : 0

  const months = monthsBetween(startSnap.date, endSnap.date)
  const monthlyContrib = sumContributions(accounts)
  const estimatedContributions = monthlyContrib * months

  const rangeSnapshots = sorted.filter(
    (s) => s.date > startSnap.date && s.date <= endSnap.date
  )
  const recordedDistributions = rangeSnapshots.reduce((sum, s) => sum + (s.distributions ?? 0), 0)
  const avgInvestments = (startTotals.totalInvestments + endTotals.totalInvestments) / 2
  const yieldEstimate =
    ((assumptions?.portfolioDividendYield ?? 0) / 100) * avgInvestments * (months / 12)
  const estimatedDistributions = recordedDistributions + yieldEstimate

  const investmentReturn = dollarChange - estimatedContributions + estimatedDistributions
  const denominator = startTotals.netWorth + estimatedContributions * 0.5
  const investmentRor = denominator !== 0 ? investmentReturn / denominator : 0

  const days = daysBetween(startSnap.date, endSnap.date)
  const cagr =
    startTotals.netWorth > 0 && endTotals.netWorth > 0
      ? Math.pow(endTotals.netWorth / startTotals.netWorth, 365 / days) - 1
      : 0

  const endYear = endSnap.date.slice(0, 4)
  const ytdStart =
    [...sorted].reverse().find((s) => s.date < `${endYear}-01-01`) ??
    sorted[0]
  const ytdStartTotals = computeSnapshotTotals(ytdStart, lineItems)
  const ytdDollarChange = endTotals.netWorth - ytdStartTotals.netWorth
  const ytdPercentChange =
    ytdStartTotals.netWorth !== 0 ? ytdDollarChange / Math.abs(ytdStartTotals.netWorth) : 0

  return {
    startDate: startSnap.date,
    endDate: endSnap.date,
    startNetWorth: startTotals.netWorth,
    endNetWorth: endTotals.netWorth,
    dollarChange,
    percentChange,
    estimatedContributions,
    estimatedDistributions,
    investmentReturn,
    investmentRor,
    cagr,
    ytdDollarChange,
    ytdPercentChange,
  }
}

export function getDateRangePresets(
  snapshots: NetWorthSnapshot[],
  lineItems: NetWorthLineItem[]
): Record<string, { start: string; end: string }> {
  const sorted = getEffectiveSnapshots(snapshots, lineItems)
  if (sorted.length === 0) {
    const today = todayISO()
    return { all: { start: today, end: today } }
  }

  const end = sorted[sorted.length - 1].date
  const endDate = new Date(end)

  const offset = (months: number) => {
    const d = new Date(endDate)
    d.setDate(1)
    d.setMonth(d.getMonth() - months)
    return d.toISOString().slice(0, 10)
  }

  const yearStart = `${end.slice(0, 4)}-01-01`

  return {
    '1M': { start: offset(1), end },
    '3M': { start: offset(3), end },
    '1Y': { start: offset(12), end },
    YTD: { start: yearStart, end },
    all: { start: sorted[0].date, end },
  }
}

export function buildNetWorthHistorySeries(
  snapshots: NetWorthSnapshot[],
  lineItems: NetWorthLineItem[]
): NetWorthChartPoint[] {
  return getEffectiveSnapshots(snapshots, lineItems).map((snapshot) => {
    const totals = computeSnapshotTotals(snapshot, lineItems)
    return {
      label: snapshot.date,
      date: snapshot.date,
      netWorth: totals.netWorth,
      assets: totals.totalAssets,
      liabilities: totals.totalLiabilities,
    }
  })
}

export function buildNetWorthProjectionOverlay(
  snapshots: NetWorthSnapshot[],
  lineItems: NetWorthLineItem[],
  _profile: UserProfile,
  assumptions: ProjectionAssumptions,
  accounts: Account[],
  years = 10
): NetWorthChartPoint[] {
  const history = buildNetWorthHistorySeries(snapshots, lineItems)
  if (history.length === 0) return []

  const latest = history[history.length - 1]
  let balance = latest.netWorth
  let monthlyContrib = sumContributions(accounts)
  const nominalReturn = assumptions.annualReturnRate / 100
  const contribGrowth = assumptions.contributionGrowthRate / 100
  const projected: NetWorthChartPoint[] = [...history]

  for (let y = 1; y <= years; y++) {
    balance = balance * (1 + nominalReturn) + monthlyContrib * 12
    monthlyContrib *= 1 + contribGrowth
    const date = new Date(latest.date)
    date.setFullYear(date.getFullYear() + y)
    projected.push({
      label: date.toISOString().slice(0, 10),
      date: date.toISOString().slice(0, 10),
      netWorth: balance,
      assets: balance,
      liabilities: 0,
      projected: balance,
    })
  }

  return projected
}

export function filterSnapshotsForWindow(
  snapshots: NetWorthSnapshot[],
  window: SnapshotWindow
): NetWorthSnapshot[] {
  const sorted = sortSnapshots(snapshots)
  if (window === 'all') return sorted
  if (window === 'ytd') {
    const year = sorted.at(-1)?.date.slice(0, 4) ?? new Date().getFullYear().toString()
    return sorted.filter((s) => s.date >= `${year}-01-01`)
  }
  const n = window === 6 ? 6 : 12
  return sorted.slice(-n)
}

export interface PortfolioBreakdownSlice {
  label: string
  value: number
  percent: number
  color: string
}

export interface TickerAccountRow {
  accountName: string
  shares: number
  marketValue: number
  taxTreatment: TaxTreatment
}

export interface TickerBreakdownRow {
  ticker: string
  totalShares: number
  avgPrice: number
  marketValue: number
  percent: number
  accounts: TickerAccountRow[]
}

export interface PortfolioBreakdown {
  byTaxBucket: PortfolioBreakdownSlice[]
  byTreatment: PortfolioBreakdownSlice[]
  byAccountType: PortfolioBreakdownSlice[]
  byTicker: TickerBreakdownRow[]
  uncategorizedCash: number
  total: number
}

const TAX_BUCKET_COLORS: Record<string, string> = {
  pretax: '#6b8fbf',
  roth: '#7d9b8a',
  taxable: '#c9a962',
  cash: '#9aa5b8',
  other: '#8b7aa8',
}

function getHoldingPrice(ticker: string, holding: { pricePerShare: number }, livePrices?: Record<string, number>): number {
  const live = livePrices?.[ticker.toUpperCase()]
  return live ?? holding.pricePerShare
}

export function getPortfolioBreakdown(
  accounts: Account[],
  allocationCategories: AllocationCategoryDef[],
  livePrices?: Record<string, number>
): PortfolioBreakdown {
  const assetAccounts = accounts.filter((a) => !a.isLiability)
  const liabilities = accounts.filter((a) => a.isLiability)
  const liabilityTotal = liabilities.reduce((s, a) => s + resolveAccountBalance(a), 0)

  const taxBucketMap = new Map<string, number>()
  const treatmentMap = new Map<string, number>()
  const accountTypeMap = new Map<string, number>()
  const tickerMap = new Map<string, TickerBreakdownRow>()
  let uncategorizedCash = 0
  let holdingsTotal = 0

  for (const account of assetAccounts) {
    const balance = resolveAccountBalance(account)
    const cat = account.allocationCategory
    let bucketKey = 'other'
    if (cat === 'pretax') bucketKey = 'pretax'
    else if (cat === 'posttax') bucketKey = 'roth'
    else if (cat === 'taxable_brokerage') bucketKey = 'taxable'
    else if (cat === 'cash_hysa') bucketKey = 'cash'
    taxBucketMap.set(bucketKey, (taxBucketMap.get(bucketKey) ?? 0) + balance)

    if (account.taxTreatment === 'pretax') {
      treatmentMap.set('Pretax', (treatmentMap.get('Pretax') ?? 0) + balance)
    } else if (account.taxTreatment === 'roth') {
      treatmentMap.set('Post-tax', (treatmentMap.get('Post-tax') ?? 0) + balance)
    } else if (account.taxTreatment === 'taxable') {
      treatmentMap.set('Taxable', (treatmentMap.get('Taxable') ?? 0) + balance)
    }

    const typeLabel = ACCOUNT_TYPES.find((t) => t.value === account.accountType)?.label ?? account.accountType
    accountTypeMap.set(typeLabel, (accountTypeMap.get(typeLabel) ?? 0) + balance)

    if (account.holdings?.length) {
      let accountHoldingsValue = 0
      for (const holding of account.holdings) {
        const ticker = holding.ticker.toUpperCase()
        const price = getHoldingPrice(ticker, holding, livePrices)
        const shares = holding.lots?.length
          ? holding.lots.reduce((sum, lot) => sum + lot.shares, 0)
          : holding.shares
        const marketValue = shares * price
        accountHoldingsValue += marketValue
        holdingsTotal += marketValue

        const existing = tickerMap.get(ticker)
        if (existing) {
          existing.totalShares += shares
          existing.marketValue += marketValue
          existing.accounts.push({
            accountName: account.name,
            shares,
            marketValue,
            taxTreatment: account.taxTreatment,
          })
          existing.avgPrice = existing.totalShares > 0 ? existing.marketValue / existing.totalShares : 0
        } else {
          tickerMap.set(ticker, {
            ticker,
            totalShares: shares,
            avgPrice: price,
            marketValue,
            percent: 0,
            accounts: [{
              accountName: account.name,
              shares,
              marketValue,
              taxTreatment: account.taxTreatment,
            }],
          })
        }
      }
      const gap = balance - accountHoldingsValue
      if (gap > 0) uncategorizedCash += gap
    }
  }

  const totalAssets = assetAccounts.reduce((s, a) => s + resolveAccountBalance(a), 0)
  const total = totalAssets - liabilityTotal

  const BUCKET_LABELS: Record<string, string> = {
    pretax: 'Pretax',
    roth: 'Roth (Post-tax)',
    taxable: 'Taxable',
    cash: 'Cash',
    other: allocationCategories.find((c) => c.id === 'other')?.label ?? 'Other',
  }

  const toSlices = (map: Map<string, number>, colorFn?: (key: string) => string): PortfolioBreakdownSlice[] =>
    Array.from(map.entries())
      .filter(([, value]) => value > 0)
      .map(([label, value]) => ({
        label,
        value,
        percent: total > 0 ? value / total : 0,
        color: colorFn?.(label) ?? '#9aa5b8',
      }))
      .sort((a, b) => b.value - a.value)

  const byTaxBucket: PortfolioBreakdownSlice[] = Array.from(taxBucketMap.entries())
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      label: BUCKET_LABELS[key] ?? key,
      value,
      percent: total > 0 ? value / total : 0,
      color: TAX_BUCKET_COLORS[key] ?? '#9aa5b8',
    }))
    .sort((a, b) => b.value - a.value)

  const byTicker = Array.from(tickerMap.values())
    .map((row) => ({
      ...row,
      percent: holdingsTotal > 0 ? row.marketValue / holdingsTotal : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue)

  if (uncategorizedCash > 0) {
    byTicker.push({
      ticker: 'Uncategorized cash/funds',
      totalShares: 0,
      avgPrice: 0,
      marketValue: uncategorizedCash,
      percent: holdingsTotal + uncategorizedCash > 0 ? uncategorizedCash / (holdingsTotal + uncategorizedCash) : 0,
      accounts: [],
    })
  }

  return {
    byTaxBucket,
    byTreatment: toSlices(treatmentMap, (key) =>
      key === 'Pretax' ? '#6b8fbf' : key === 'Post-tax' ? '#7d9b8a' : '#c9a962'
    ),
    byAccountType: toSlices(accountTypeMap),
    byTicker,
    uncategorizedCash,
    total,
  }
}

export function netWorthSnapshotsToCsv(
  lineItems: NetWorthLineItem[],
  snapshots: NetWorthSnapshot[]
): string {
  const sorted = sortSnapshots(snapshots)
  const exportedAt = new Date().toISOString().replace('T', ' ').slice(0, 16)
  const accounts = lineItems.filter((item) => item.kind === 'account')
  const header = ['Account', 'Side', ...sorted.map((s) => s.date)]
  const lines = [`# Exported ${exportedAt}`, header.join(',')]

  for (const item of accounts) {
    const row = [
      `"${item.name.replace(/"/g, '""')}"`,
      item.side,
      ...sorted.map((snapshot) => String(snapshot.balances[item.id] ?? '')),
    ]
    lines.push(row.join(','))
  }

  return lines.join('\n')
}

export function buildLineItemsFromAccounts(accounts: Account[]): NetWorthLineItem[] {
  const assetsSectionId = createId()
  const liabilitiesSectionId = createId()
  const assetGroupId = createId()
  const liabilityGroupId = createId()
  let sortOrder = 0

  const lineItems: NetWorthLineItem[] = [
    {
      id: assetsSectionId,
      name: 'Assets',
      parentId: null,
      kind: 'section',
      side: 'asset',
      sortOrder: sortOrder++,
    },
    {
      id: assetGroupId,
      name: 'Accounts',
      parentId: assetsSectionId,
      kind: 'group',
      side: 'asset',
      sortOrder: sortOrder++,
    },
    {
      id: liabilitiesSectionId,
      name: 'Liabilities',
      parentId: null,
      kind: 'section',
      side: 'liability',
      sortOrder: sortOrder++,
    },
    {
      id: liabilityGroupId,
      name: 'Debts',
      parentId: liabilitiesSectionId,
      kind: 'group',
      side: 'liability',
      sortOrder: sortOrder++,
    },
  ]

  for (const account of accounts) {
    lineItems.push({
      id: createId(),
      name: account.name,
      parentId: account.isLiability ? liabilityGroupId : assetGroupId,
      kind: 'account',
      side: account.isLiability ? 'liability' : 'asset',
      accountType: account.accountType,
      sortOrder: sortOrder++,
    })
  }

  return lineItems
}

function scoreAccountNameMatch(itemName: string, accountName: string): number {
  const item = itemName.toLowerCase()
  const acct = accountName.toLowerCase()
  if (item === acct) return 1000 + acct.length
  if (item.includes(acct)) return 100 + acct.length
  if (acct.includes(item)) return 50 + item.length
  return 0
}

function findBestAccountMatch(itemName: string, accounts: Account[]): Account | undefined {
  let best: Account | undefined
  let bestScore = 0
  for (const account of accounts) {
    const score = scoreAccountNameMatch(itemName, account.name)
    if (score > bestScore) {
      bestScore = score
      best = account
    }
  }
  return bestScore > 0 ? best : undefined
}

export function recomputeGroupBalancesFromAccounts(
  balances: Record<string, number>,
  lineItems: NetWorthLineItem[]
): Record<string, number> {
  const result = { ...balances }
  for (const group of lineItems.filter((item) => item.kind === 'group')) {
    const children = lineItems.filter((item) => item.parentId === group.id && item.kind === 'account')
    if (children.length === 0) continue
    result[group.id] = children.reduce((sum, child) => sum + (result[child.id] ?? 0), 0)
  }
  return result
}

export function mapAccountsToSnapshotBalances(
  accounts: Account[],
  lineItems: NetWorthLineItem[]
): { balances: Record<string, number>; lineItems: NetWorthLineItem[] } {
  const balances: Record<string, number> = {}
  const nextLineItems = [...lineItems]
  const accountItems = nextLineItems.filter((item) => item.kind === 'account')

  for (const item of accountItems) {
    const match = findBestAccountMatch(item.name, accounts)
    if (match) balances[item.id] = resolveAccountBalance(match)
  }

  for (const account of accounts) {
    const existing = accountItems.find((item) => item.name.toLowerCase() === account.name.toLowerCase())
    if (existing) continue
    const newItem: NetWorthLineItem = {
      id: createId(),
      name: account.name,
      parentId: account.isLiability
        ? nextLineItems.find((i) => i.name === 'Debts')?.id ?? null
        : nextLineItems.find((i) => i.name === 'Accounts')?.id ?? null,
      kind: 'account',
      side: account.isLiability ? 'liability' : 'asset',
      accountType: account.accountType,
      sortOrder: nextLineItems.length,
    }
    nextLineItems.push(newItem)
    balances[newItem.id] = resolveAccountBalance(account)
  }

  const withGroups = recomputeGroupBalancesFromAccounts(balances, nextLineItems)
  return { balances: withGroups, lineItems: nextLineItems }
}

export function getLatestSnapshotTotals(scenario: Scenario): SnapshotTotals | null {
  const latest = getLatestEffectiveSnapshot(
    scenario.netWorthSnapshots ?? [],
    scenario.netWorthLineItems ?? []
  )
  if (!latest) return null
  return computeSnapshotTotals(latest, scenario.netWorthLineItems ?? [])
}
