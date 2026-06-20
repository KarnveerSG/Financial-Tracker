import * as XLSX from 'xlsx'
import type {
  Account,
  AccountType,
  NetWorthLineItem,
  NetWorthLineKind,
  NetWorthSide,
  NetWorthSnapshot,
  ProjectionAssumptions,
  Scenario,
  UserProfile,
} from '../types'
import { createId } from './format'
import { resolveAccountBalance, sumContributions } from './accounts'

const NW_SHEET_NAME = 'Net Worth Tracker'

const SKIP_LABELS = new Set([
  'total assets',
  'total liabilities',
  'total net worth',
  'total investments',
  'total cash/savings/equity',
  'total pre tax retirement %',
  'total roth retirement %',
  '401k pre tax %',
  '401k roth %',
  'pre tax retirement $ amount',
  'roth retirement $ amount',
  '$ diff from last entry',
  '% diff from last entry',
  'ytd $ diff',
  'ytd $ diff ',
])

const LIABILITY_TOTAL_LABELS = new Set([
  'car debt - benz(jan/19) - corvette(jul/24)',
  'ira limit',
])

const SECTION_LABELS = new Set(['assets', 'liabilities'])
const GROUP_LABELS = new Set([
  'taxable accounts',
  'tax-advantaged accounts',
  'cryptocurrency',
  'cash',
  'real estate',
  'other assets',
  'debts',
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

function getIndent(raw: string): number {
  const match = raw.match(/^(\s*)/)
  return match ? match[1].length : 0
}

function trimLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

function parseCellValue(value: unknown): number | null {
  if (value == null || value === '' || value === '-') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = String(value).trim()
  if (!text || text === '-' || text.endsWith('%')) return null
  const num = Number(text.replace(/[$,]/g, ''))
  return Number.isFinite(num) ? num : null
}

function excelDateToIso(value: unknown): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    const month = String(parsed.m).padStart(2, '0')
    const day = String(parsed.d).padStart(2, '0')
    return `${parsed.y}-${month}-${day}`
  }
  const text = String(value).trim()
  if (!text) return null
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
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

function isInvestmentLineItem(item: NetWorthLineItem): boolean {
  if (item.kind !== 'account' || item.side !== 'asset') return false
  if (item.accountType && INVESTMENT_TYPES.has(item.accountType)) {
    return item.accountType !== 'checking' && item.accountType !== 'savings'
  }
  const lower = item.name.toLowerCase()
  if (lower.includes('checking') || lower.includes('savings') && !lower.includes('equity')) return false
  return (
    lower.includes('401') ||
    lower.includes('ira') ||
    lower.includes('brokerage') ||
    lower.includes('hsa') ||
    lower.includes('529') ||
    lower.includes('crypto') ||
    lower.includes('espp') ||
    lower.includes('pension')
  )
}

function resolveIncludeInTotal(
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
  endDate: string
): NetWorthPeriodMetrics | null {
  const sorted = sortSnapshots(snapshots)
  if (sorted.length === 0) return null

  const startSnap = sorted.find((s) => s.date >= startDate) ?? sorted[0]
  const endSnap = [...sorted].reverse().find((s) => s.date <= endDate) ?? sorted[sorted.length - 1]
  const startTotals = computeSnapshotTotals(startSnap, lineItems)
  const endTotals = computeSnapshotTotals(endSnap, lineItems)

  const dollarChange = endTotals.netWorth - startTotals.netWorth
  const percentChange =
    startTotals.netWorth !== 0 ? dollarChange / Math.abs(startTotals.netWorth) : 0

  const months = monthsBetween(startSnap.date, endSnap.date)
  const monthlyContrib = sumContributions(accounts)
  const estimatedContributions = monthlyContrib * months

  const investmentReturn = dollarChange - estimatedContributions
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
    investmentReturn,
    investmentRor,
    cagr,
    ytdDollarChange,
    ytdPercentChange,
  }
}

export function getDateRangePresets(snapshots: NetWorthSnapshot[]): Record<string, { start: string; end: string }> {
  const sorted = sortSnapshots(snapshots)
  if (sorted.length === 0) {
    const today = new Date().toISOString().slice(0, 10)
    return { all: { start: today, end: today } }
  }

  const end = sorted[sorted.length - 1].date
  const endDate = new Date(end)

  const offset = (months: number) => {
    const d = new Date(endDate)
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
  return sortSnapshots(snapshots).map((snapshot) => {
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

export function parseNwTrackerXlsx(buffer: ArrayBuffer): NetWorthImportResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[NW_SHEET_NAME]
  if (!sheet) {
    throw new Error(`Sheet "${NW_SHEET_NAME}" not found in workbook`)
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })

  if (rows.length === 0) throw new Error('Worksheet is empty')

  const headerRow = rows[0] ?? []
  const dateColumns: { col: number; date: string }[] = []

  for (let col = 1; col < headerRow.length; col++) {
    const iso = excelDateToIso(headerRow[col])
    if (iso) dateColumns.push({ col, date: iso })
  }

  if (dateColumns.length === 0) throw new Error('No snapshot dates found in row 1')

  const lineItems: NetWorthLineItem[] = []
  const balanceRows: { item: NetWorthLineItem; rowIndex: number }[] = []
  let currentSide: NetWorthSide = 'asset'
  let currentGroupId: string | null = null
  let sortOrder = 0

  for (let rowIndex = 2; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] ?? []
    const rawLabel = String(row[0] ?? '')
    const label = trimLabel(rawLabel)
    if (!label) continue

    const normalized = normalizeLabel(label)
    if (SKIP_LABELS.has(normalized)) continue

    if (SECTION_LABELS.has(normalized)) {
      currentSide = normalized === 'assets' ? 'asset' : 'liability'
      currentGroupId = null
      lineItems.push({
        id: createId(),
        name: label,
        parentId: null,
        kind: 'section',
        side: currentSide,
        sortOrder: sortOrder++,
      })
      continue
    }

    const indent = getIndent(rawLabel)
    const kind: NetWorthLineKind =
      indent >= 3 ? 'account' : GROUP_LABELS.has(normalized) ? 'group' : 'account'

    const item: NetWorthLineItem = {
      id: createId(),
      name: label,
      parentId: kind === 'group' ? null : currentGroupId,
      kind,
      side: currentSide,
      accountType: inferAccountType(label),
      sortOrder: sortOrder++,
      includeInTotal: resolveIncludeInTotal(normalized, kind, currentSide),
    }

    lineItems.push(item)
    if (kind === 'group') {
      currentGroupId = item.id
      balanceRows.push({ item, rowIndex })
    } else if (kind === 'account') {
      balanceRows.push({ item, rowIndex })
    }
  }

  const snapshots: NetWorthSnapshot[] = dateColumns.map(({ col, date }) => {
    const balances: Record<string, number> = {}
    for (const { item, rowIndex } of balanceRows) {
      const value = parseCellValue(rows[rowIndex]?.[col])
      if (value != null) balances[item.id] = value
    }
    return { id: createId(), date, balances }
  })

  return { lineItems, snapshots }
}

export function netWorthSnapshotsToCsv(
  lineItems: NetWorthLineItem[],
  snapshots: NetWorthSnapshot[]
): string {
  const sorted = sortSnapshots(snapshots)
  const accounts = lineItems.filter((item) => item.kind === 'account')
  const header = ['Account', 'Side', ...sorted.map((s) => s.date)]
  const lines = [header.join(',')]

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

export function mapAccountsToSnapshotBalances(
  accounts: Account[],
  lineItems: NetWorthLineItem[]
): Record<string, number> {
  const balances: Record<string, number> = {}
  const accountItems = lineItems.filter((item) => item.kind === 'account')

  for (const item of accountItems) {
    const match =
      accounts.find((a) => a.name.toLowerCase() === item.name.toLowerCase()) ??
      accounts.find((a) => item.name.toLowerCase().includes(a.name.toLowerCase())) ??
      accounts.find((a) => a.name.toLowerCase().includes(item.name.toLowerCase()))
    if (match) balances[item.id] = resolveAccountBalance(match)
  }

  for (const account of accounts) {
    const existing = accountItems.find((item) => item.name.toLowerCase() === account.name.toLowerCase())
    if (existing) continue
    const newItem: NetWorthLineItem = {
      id: createId(),
      name: account.name,
      parentId: account.isLiability
        ? lineItems.find((i) => i.name === 'Debts')?.id ?? null
        : lineItems.find((i) => i.name === 'Accounts')?.id ?? null,
      kind: 'account',
      side: account.isLiability ? 'liability' : 'asset',
      accountType: account.accountType,
      sortOrder: lineItems.length,
    }
    lineItems.push(newItem)
    balances[newItem.id] = resolveAccountBalance(account)
  }

  return balances
}

export function getLatestSnapshotTotals(scenario: Scenario): SnapshotTotals | null {
  const sorted = sortSnapshots(scenario.netWorthSnapshots ?? [])
  if (sorted.length === 0) return null
  return computeSnapshotTotals(sorted[sorted.length - 1], scenario.netWorthLineItems ?? [])
}
