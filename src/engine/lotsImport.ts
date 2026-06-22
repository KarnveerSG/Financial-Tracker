import type { TaxLot } from '../types'
import { createId } from './format'
import { parseCsvLine } from './csvParse'

const TICKER_KEYS = ['ticker', 'symbol', 'security', 'description']
const SHARES_KEYS = ['shares', 'quantity', 'qty', 'units']
const COST_KEYS = ['cost', 'cost basis', 'cost/share', 'cost per share', 'price paid', 'unit cost']
const DATE_KEYS = ['acquired', 'acquired date', 'purchase date', 'date acquired', 'trade date', 'open date']

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_"]/g, ' ')
}

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader)
  for (const key of candidates) {
    const idx = normalized.findIndex((h) => h === key || h.includes(key))
    if (idx >= 0) return idx
  }
  return -1
}


export interface LotsImportPreview {
  ticker: string
  shares: number
  costPerShare: number
  acquiredDate: string
}

export interface LotsImportResult {
  columns: { ticker: number; shares: number; cost: number; date: number }
  preview: LotsImportPreview[]
  lots: TaxLot[]
}

export function detectLotsCsvColumns(headers: string[]) {
  return {
    ticker: findColumn(headers, TICKER_KEYS),
    shares: findColumn(headers, SHARES_KEYS),
    cost: findColumn(headers, COST_KEYS),
    date: findColumn(headers, DATE_KEYS),
  }
}

function parseDate(raw: string): string {
  const text = raw.trim()
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const d = new Date(text)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return ''
}

export function parseLotsCsv(csv: string): LotsImportResult {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) {
    return { columns: { ticker: -1, shares: -1, cost: -1, date: -1 }, preview: [], lots: [] }
  }

  const headers = parseCsvLine(lines[0])
  const columns = detectLotsCsvColumns(headers)
  const preview: LotsImportPreview[] = []
  const lots: TaxLot[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const ticker = columns.ticker >= 0 ? cells[columns.ticker]?.trim().toUpperCase() : ''
    const shares = columns.shares >= 0 ? parseFloat(cells[columns.shares] ?? '') : 0
    const costPerShare = columns.cost >= 0 ? parseFloat(cells[columns.cost] ?? '') : 0
    const acquiredDate = columns.date >= 0 ? parseDate(cells[columns.date] ?? '') : ''
    if (!ticker || !Number.isFinite(shares) || shares <= 0) continue

    preview.push({ ticker, shares, costPerShare: Number.isFinite(costPerShare) ? costPerShare : 0, acquiredDate })
    lots.push({
      id: createId(),
      shares,
      costPerShare: Number.isFinite(costPerShare) ? costPerShare : 0,
      acquiredDate: acquiredDate || new Date().toISOString().slice(0, 10),
    })
  }

  return { columns, preview, lots }
}
