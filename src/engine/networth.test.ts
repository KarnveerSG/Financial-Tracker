import { describe, expect, it } from 'vitest'
import type { NetWorthLineItem, NetWorthSnapshot } from '../types'
import { createDefaultAccount } from './accounts'
import {
  buildNetWorthHistorySeries,
  computePeriodMetrics,
  computeRetirementTaxSplit,
  computeSnapshotTotals,
  filterSnapshotsForWindow,
  getDataThroughDate,
  getEffectiveSnapshots,
  getLatestEffectiveSnapshot,
  getPortfolioBreakdown,
  is401kLineItem,
  isInvestmentLineItem,
  isIraLineItem,
  mapAccountsToSnapshotBalances,
  netWorthSnapshotsToCsv,
  resolveIraVariant,
  resolveLineItemRothPercent,
  snapshotHasData,
} from './networth'
import { DEFAULT_ALLOCATION_CATEGORIES } from '../types'

function fixtureLineItems(): NetWorthLineItem[] {
  return [
    {
      id: 'g-taxable',
      name: 'Taxable Accounts',
      parentId: null,
      kind: 'group',
      side: 'asset',
      sortOrder: 0,
      includeInTotal: true,
    },
    {
      id: 'g-cash',
      name: 'Cash',
      parentId: null,
      kind: 'group',
      side: 'asset',
      sortOrder: 1,
      includeInTotal: true,
    },
    {
      id: 'a-brokerage',
      name: 'Brokerage #1',
      parentId: 'g-taxable',
      kind: 'account',
      side: 'asset',
      accountType: 'brokerage',
      sortOrder: 2,
    },
    {
      id: 'a-car',
      name: 'Car Debt',
      parentId: null,
      kind: 'account',
      side: 'liability',
      accountType: 'loan',
      sortOrder: 3,
      includeInTotal: true,
    },
    {
      id: 'a-ira-limit',
      name: 'IRA Limit',
      parentId: null,
      kind: 'account',
      side: 'liability',
      accountType: 'custom',
      sortOrder: 4,
      includeInTotal: true,
    },
  ]
}

function fixtureSnapshots(): NetWorthSnapshot[] {
  return [
    {
      id: 's1',
      date: '2023-03-23',
      balances: {
        'g-taxable': 0,
        'g-cash': 7449.27,
        'a-brokerage': 0,
        'a-car': 8975.19,
        'a-ira-limit': 3000,
      },
    },
    {
      id: 's2',
      date: '2026-06-01',
      balances: {
        'g-taxable': 18363,
        'g-cash': 11200,
        'a-brokerage': 24000,
        'a-car': 0,
        'a-ira-limit': 0,
      },
    },
    {
      id: 's3-empty-future',
      date: '2026-12-01',
      balances: {
        'g-taxable': 0,
        'g-cash': 0,
        'a-brokerage': 0,
        'a-car': 0,
        'a-ira-limit': 0,
      },
    },
  ]
}

describe('snapshotHasData', () => {
  it('returns false for all-zero placeholder columns', () => {
    const lineItems = fixtureLineItems()
    const empty = fixtureSnapshots()[2]
    expect(snapshotHasData(empty, lineItems)).toBe(false)
  })

  it('returns true when group totals exist', () => {
    const lineItems = fixtureLineItems()
    const snap = fixtureSnapshots()[1]
    expect(snapshotHasData(snap, lineItems)).toBe(true)
  })
})

describe('getEffectiveSnapshots', () => {
  it('excludes future empty columns and uses last real snapshot', () => {
    const lineItems = fixtureLineItems()
    const snapshots = fixtureSnapshots()
    const effective = getEffectiveSnapshots(snapshots, lineItems, '2026-06-19')

    expect(effective).toHaveLength(2)
    expect(effective.at(-1)?.date).toBe('2026-06-01')
    expect(getDataThroughDate(snapshots, lineItems, '2026-06-19')).toBe('2026-06-01')
  })

  it('does not treat empty December as latest', () => {
    const lineItems = fixtureLineItems()
    const snapshots = fixtureSnapshots()
    const latest = getLatestEffectiveSnapshot(snapshots, lineItems, '2026-12-31')
    expect(latest?.date).toBe('2026-06-01')
  })
})

describe('computeSnapshotTotals', () => {
  it('uses group totals for assets and selected liabilities (Excel formula)', () => {
    const lineItems = fixtureLineItems()
    const first = fixtureSnapshots()[0]
    const totals = computeSnapshotTotals(first, lineItems)

    expect(totals.totalAssets).toBeCloseTo(7449.27, 2)
    expect(totals.totalLiabilities).toBeCloseTo(11975.19, 2)
    expect(totals.netWorth).toBeCloseTo(-4525.92, 2)
  })
})

describe('computePeriodMetrics', () => {
  it('does not produce -100% cliff when empty future snapshot exists', () => {
    const lineItems = fixtureLineItems()
    const snapshots = fixtureSnapshots()
    const metrics = computePeriodMetrics(
      snapshots,
      lineItems,
      [],
      '2023-03-23',
      '2026-12-31'
    )

    expect(metrics).not.toBeNull()
    expect(metrics!.endDate).toBe('2026-06-01')
    expect(metrics!.endNetWorth).toBeGreaterThan(0)
    expect(metrics!.percentChange).toBeGreaterThan(-0.99)
  })
})

describe('isInvestmentLineItem', () => {
  const base = (name: string, accountType?: NetWorthLineItem['accountType']): NetWorthLineItem => ({
    id: 'x',
    name,
    parentId: null,
    kind: 'account',
    side: 'asset',
    sortOrder: 0,
    accountType,
  })

  it('treats Savings (Equity) as investment', () => {
    expect(isInvestmentLineItem(base('Savings (Equity)'))).toBe(true)
  })

  it('excludes Chase Checking', () => {
    expect(isInvestmentLineItem(base('Chase Checking', 'checking'))).toBe(false)
  })

  it('includes Roth IRA accounts', () => {
    expect(isInvestmentLineItem(base('Roth IRA – Fidelity', 'roth_ira'))).toBe(true)
  })
})

describe('filterSnapshotsForWindow', () => {
  it('limits visible snapshots without changing history series', () => {
    const lineItems = fixtureLineItems()
    const snapshots: NetWorthSnapshot[] = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
      date: `2025-${String(i + 1).padStart(2, '0')}-01`,
      balances: { 'g-taxable': 1000 * (i + 1), 'g-cash': 500 },
    }))

    const effective = getEffectiveSnapshots(snapshots, lineItems, '2026-12-31')
    const windowed = filterSnapshotsForWindow(effective, 6)
    const history = buildNetWorthHistorySeries(snapshots, lineItems)

    expect(windowed).toHaveLength(6)
    expect(history.length).toBe(effective.length)
  })
})

describe('getPortfolioBreakdown', () => {
  it('returns expected tax bucket and ticker totals', () => {
    const accounts = [
      createDefaultAccount({
        name: '401k',
        accountType: '401k',
        balance: 50000,
        allocationCategory: 'pretax',
        taxTreatment: 'pretax',
      }),
      createDefaultAccount({
        name: 'Brokerage',
        accountType: 'brokerage',
        balance: 30000,
        allocationCategory: 'taxable_brokerage',
        taxTreatment: 'taxable',
        holdings: [
          { id: 'h1', ticker: 'VTI', shares: 50, pricePerShare: 240 },
          { id: 'h2', ticker: 'AAPL', shares: 20, pricePerShare: 190 },
        ],
        syncBalanceFromHoldings: true,
      }),
    ]

    const breakdown = getPortfolioBreakdown(accounts, DEFAULT_ALLOCATION_CATEGORIES)
    const pretax = breakdown.byTaxBucket.find((b) => b.label === 'Pretax')
    expect(pretax?.value).toBe(50000)

    const vti = breakdown.byTicker.find((t) => t.ticker === 'VTI')
    expect(vti?.marketValue).toBe(12000)

    const pretaxTreatment = breakdown.byTreatment.find((t) => t.label === 'Pretax')
    expect(pretaxTreatment?.value).toBe(50000)
  })
})

describe('mapAccountsToSnapshotBalances', () => {
  it('prefers longest account name match for ambiguous items', () => {
    const accounts = [
      createDefaultAccount({ name: 'Roth', balance: 1000 }),
      createDefaultAccount({ name: 'Roth 401k', balance: 50000 }),
    ]
    const lineItems: NetWorthLineItem[] = [
      {
        id: 'item-roth401',
        name: 'Roth 401k',
        parentId: null,
        kind: 'account',
        side: 'asset',
        sortOrder: 0,
      },
      {
        id: 'item-roth',
        name: 'Roth',
        parentId: null,
        kind: 'account',
        side: 'asset',
        sortOrder: 1,
      },
    ]
    const { balances } = mapAccountsToSnapshotBalances(accounts, lineItems)
    expect(balances['item-roth401']).toBe(50000)
    expect(balances['item-roth']).toBe(1000)
  })
})

describe('retirement tax classification', () => {
  const iraRoth: NetWorthLineItem = {
    id: 'ira-r',
    name: 'IRA - Mine - Vanguard',
    parentId: null,
    kind: 'account',
    side: 'asset',
    accountType: 'roth_ira',
    sortOrder: 0,
  }
  const iraTrad: NetWorthLineItem = {
    id: 'ira-t',
    name: 'IRA - Spouse',
    parentId: null,
    kind: 'account',
    side: 'asset',
    accountType: 'traditional_ira',
    sortOrder: 1,
  }
  const k401: NetWorthLineItem = {
    id: 'k401',
    name: '401(k) - Mine',
    parentId: null,
    kind: 'account',
    side: 'asset',
    accountType: '401k',
    rothPercent: 30,
    sortOrder: 2,
  }

  it('detects IRA and 401k line items', () => {
    expect(isIraLineItem(iraRoth)).toBe(true)
    expect(is401kLineItem(k401)).toBe(true)
    expect(isIraLineItem(fixtureLineItems()[3])).toBe(false)
  })

  it('resolves IRA variant and 401k roth percent', () => {
    expect(resolveIraVariant(iraRoth)).toBe('roth')
    expect(resolveIraVariant(iraTrad)).toBe('traditional')
    expect(resolveLineItemRothPercent(k401)).toBe(30)
    expect(resolveLineItemRothPercent({ ...k401, rothPercent: undefined, accountType: 'roth_401k' })).toBe(100)
  })

  it('splits retirement balances by tax treatment', () => {
    const snapshot: NetWorthSnapshot = {
      id: 's',
      date: '2024-01-01',
      balances: { 'ira-r': 10000, 'ira-t': 5000, k401: 20000 },
    }
    const split = computeRetirementTaxSplit(snapshot, [iraRoth, iraTrad, k401])
    expect(split.roth).toBe(16000)
    expect(split.pretax).toBe(19000)
    expect(split.rothPercent).toBeCloseTo(16000 / 35000)
  })
})

describe('netWorthSnapshotsToCsv', () => {
  it('includes export timestamp header', () => {
    const lineItems = fixtureLineItems()
    const snapshots = fixtureSnapshots().slice(0, 1)
    const csv = netWorthSnapshotsToCsv(lineItems, snapshots)
    expect(csv.startsWith('# Exported ')).toBe(true)
  })
})
