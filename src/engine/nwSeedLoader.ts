import type { Account, NetWorthLineItem, NetWorthSnapshot } from '../types'
import { createDefaultAccount } from './accounts'
import { createId } from './format'
import { inferAccountType } from './networth'
import seedData from '../assets/nwTrackerSeed.json'

interface SeedShape {
  lineItems: Array<Omit<NetWorthLineItem, 'id'> & { id: string }>
  snapshots: Array<{ id: string; date: string; balances: Record<string, number> }>
}

const SEED = seedData as unknown as SeedShape

export interface SeedResult {
  lineItems: NetWorthLineItem[]
  snapshots: NetWorthSnapshot[]
  accounts: Account[]
}

/**
 * Load the pre-parsed NW Tracker seed. Fresh IDs are generated so it can be re-imported
 * cleanly. Also derives Account records from account-kind line items using the latest
 * snapshot's balance as the starting balance.
 */
export function buildNwTrackerSeed(): SeedResult {
  const idMap = new Map<string, string>()
  const lineItems: NetWorthLineItem[] = SEED.lineItems.map((item) => {
    const newId = createId()
    idMap.set(item.id, newId)
    return { ...item, id: newId } as NetWorthLineItem
  })
  for (const item of lineItems) {
    if (item.parentId) item.parentId = idMap.get(item.parentId) ?? null
  }

  const snapshots: NetWorthSnapshot[] = SEED.snapshots.map((snap) => ({
    id: createId(),
    date: snap.date,
    balances: Object.fromEntries(
      Object.entries(snap.balances).map(([oldId, value]) => [idMap.get(oldId) ?? oldId, value])
    ),
  }))

  const sortedSnapshots = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sortedSnapshots.at(-1)

  const accountItems = lineItems.filter((li) => li.kind === 'account')
  const accounts: Account[] = accountItems
    .map((li) => {
      const balance = latest?.balances[li.id] ?? 0
      if (balance === 0) return null
      const inferred = li.accountType ?? inferAccountType(li.name) ?? 'custom'
      return createDefaultAccount({
        name: li.name,
        accountType: inferred,
        balance,
        isLiability: li.side === 'liability',
      })
    })
    .filter((a): a is Account => a != null)

  return { lineItems, snapshots, accounts }
}
