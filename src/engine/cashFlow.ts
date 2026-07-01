import type { CashFlowEntry, CashFlowFrequency } from '../types'

/** Parse an ISO YYYY-MM-DD as a local date (no timezone shift). */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** Advance a date by one period of the given frequency (returns a new Date). */
export function advanceByFrequency(date: Date, frequency: CashFlowFrequency): Date {
  const d = new Date(date)
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7)
      break
    case 'biweekly':
      d.setDate(d.getDate() + 14)
      break
    case 'monthly':
      d.setMonth(d.getMonth() + 1)
      break
    case 'quarterly':
      d.setMonth(d.getMonth() + 3)
      break
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1)
      break
    default:
      break
  }
  return d
}

/** Expand a recurring entry into concrete occurrences within [from, to]. */
export function expandRecurring(
  entry: CashFlowEntry,
  from: Date,
  to: Date
): { date: string; amount: number; kind: CashFlowEntry['kind']; description: string; entryId: string }[] {
  const out: { date: string; amount: number; kind: CashFlowEntry['kind']; description: string; entryId: string }[] = []
  if (!entry.recurring || !entry.frequency || entry.frequency === 'once') {
    const d = parseLocalDate(entry.date)
    if (d >= from && d <= to) {
      out.push({ date: entry.date, amount: entry.amount, kind: entry.kind, description: entry.description, entryId: entry.id })
    }
    return out
  }
  const end = entry.endDate ? parseLocalDate(entry.endDate) : to
  const stop = end < to ? end : to
  let cursor = parseLocalDate(entry.date)
  let safety = 0
  while (cursor <= stop && safety < 500) {
    if (cursor >= from) {
      out.push({
        date: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`,
        amount: entry.amount,
        kind: entry.kind,
        description: entry.description,
        entryId: entry.id,
      })
    }
    cursor = advanceByFrequency(cursor, entry.frequency)
    safety++
  }
  return out
}

export interface CashFlowSummary {
  income: number
  expenses: number
  net: number
  byCategory: { categoryId: string; label: string; amount: number }[]
}

export function summarizeCashFlow(
  entries: CashFlowEntry[],
  from: Date,
  to: Date,
  categoryLabels: Record<string, string> = {}
): CashFlowSummary {
  const occurrences = entries.flatMap((e) => expandRecurring(e, from, to).map((occ) => ({ ...occ, categoryId: e.categoryId ?? 'uncategorized' })))
  let income = 0
  let expenses = 0
  const byCat = new Map<string, number>()
  for (const occ of occurrences) {
    if (occ.kind === 'income') income += occ.amount
    else if (occ.kind === 'expense') {
      expenses += occ.amount
      byCat.set(occ.categoryId, (byCat.get(occ.categoryId) ?? 0) + occ.amount)
    }
  }
  const byCategory = Array.from(byCat.entries())
    .map(([categoryId, amount]) => ({ categoryId, label: categoryLabels[categoryId] ?? categoryId, amount }))
    .sort((a, b) => b.amount - a.amount)
  return { income, expenses, net: income - expenses, byCategory }
}

/** Upcoming bills within `days` days from today. */
export function upcomingBills(entries: CashFlowEntry[], days: number): { date: string; description: string; amount: number; entryId: string }[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setDate(end.getDate() + days)
  const items = entries
    .filter((e) => e.kind === 'expense')
    .flatMap((e) => expandRecurring(e, today, end))
    .sort((a, b) => a.date.localeCompare(b.date))
  return items
}

/** Rolls entries up into per-month totals over the last N months. */
export function monthlyCashFlow(entries: CashFlowEntry[], monthsBack: number): { month: string; income: number; expenses: number; net: number }[] {
  const now = new Date()
  const results: { month: string; income: number; expenses: number; net: number }[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    const summary = summarizeCashFlow(entries, start, end)
    results.push({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      income: summary.income,
      expenses: summary.expenses,
      net: summary.net,
    })
  }
  return results
}
