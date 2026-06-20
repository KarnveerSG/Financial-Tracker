import fs from 'node:fs'
import * as XLSX from 'xlsx'

const filePath = process.argv[2] ?? 'c:/Users/Karnveer/Downloads/NW Tracker.xlsx'
const buffer = fs.readFileSync(filePath)
const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
const sheet = workbook.Sheets['Net Worth Tracker']
if (!sheet) {
  console.error('Missing Net Worth Tracker sheet')
  process.exit(1)
}

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
const dates = rows[0].slice(1).filter(Boolean)
console.log('dates', dates.length)

const totalNwRow = rows.find((row) => String(row[0] ?? '').trim() === 'Total Net Worth')
if (totalNwRow) {
  console.log('excel first NW', totalNwRow[1])
  console.log('excel col7 NW', totalNwRow[7])
  console.log('excel last NW', totalNwRow[dates.length])
}

console.log('OK')
