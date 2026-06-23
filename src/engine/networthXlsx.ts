import type { NetWorthLineItem, NetWorthLineKind, NetWorthSide } from '../types'
import { createId } from './format'
import { inferAccountType, resolveIncludeInTotal, snapshotHasData, type NetWorthImportResult } from './networth'

const NW_SHEET_NAME = 'Net Worth Tracker'

const SKIP_LABELS = new Set([
  'total assets',
  'total liabilities',
  'total net worth',
  'total investments',
  'total cash/savings/equity',
  'total tax-advantaged accounts',
  'total taxable accounts',
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

function excelDateToIso(value: unknown, XLSX: typeof import('xlsx')): string | null {
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

export async function parseNwTrackerXlsx(buffer: ArrayBuffer): Promise<NetWorthImportResult> {
  const XLSX = await import('xlsx')
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
    const iso = excelDateToIso(headerRow[col], XLSX)
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

  const snapshots = dateColumns
    .map(({ col, date }) => {
      const balances: Record<string, number> = {}
      for (const { item, rowIndex } of balanceRows) {
        const value = parseCellValue(rows[rowIndex]?.[col])
        if (value != null) balances[item.id] = value
      }
      return { id: createId(), date, balances }
    })
    .filter((snapshot) => snapshotHasData(snapshot, lineItems))

  return { lineItems, snapshots }
}
