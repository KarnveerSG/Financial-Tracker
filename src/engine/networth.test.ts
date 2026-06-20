import { describe, expect, it } from 'vitest'
import type { NetWorthLineItem, NetWorthSnapshot } from '../types'
import {
  computePeriodMetrics,
  computeSnapshotTotals,
  getDataThroughDate,
  getEffectiveSnapshots,
  getLatestEffectiveSnapshot,
  snapshotHasData,
} from './networth'

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
