import type { Scenario } from '../types'
import { resolveAccountBalance } from './accounts'
import { getLatestSnapshotTotals } from './networth'

export function resolveDisplayNetWorth(scenario: Scenario): { netWorth: number; source?: string } {
  const assets = scenario.accounts.filter((a) => !a.isLiability)
  const liabilities = scenario.accounts.filter((a) => a.isLiability)
  const accountNetWorth =
    assets.reduce((s, a) => s + resolveAccountBalance(a), 0) -
    liabilities.reduce((s, a) => s + resolveAccountBalance(a), 0)

  const snapshotTotals = getLatestSnapshotTotals(scenario)
  const snapshotDate =
    (scenario.netWorthSnapshots ?? []).length > 0
      ? [...scenario.netWorthSnapshots].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.date ?? null
      : null
  const daysSince =
    snapshotDate != null
      ? Math.round((Date.now() - new Date(snapshotDate).getTime()) / (1000 * 60 * 60 * 24))
      : Infinity

  if (snapshotTotals != null && snapshotDate != null && daysSince <= 45) {
    return { netWorth: snapshotTotals.netWorth, source: `snapshot ${snapshotDate}` }
  }
  return { netWorth: accountNetWorth }
}
