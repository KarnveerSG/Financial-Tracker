import fs from 'node:fs'
import { parseNwTrackerXlsx, computeSnapshotTotals } from '../src/engine/networth.ts'

const filePath = process.argv[2] ?? 'c:/Users/Karnveer/Downloads/NW Tracker.xlsx'
const buffer = fs.readFileSync(filePath)
const { lineItems, snapshots } = parseNwTrackerXlsx(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
)

const first = computeSnapshotTotals(snapshots[0], lineItems)
const col7 = computeSnapshotTotals(snapshots[6], lineItems)

console.log('accounts', lineItems.filter((i) => i.kind === 'account').length)
console.log('snapshots', snapshots.length)
console.log('parsed first NW', first.netWorth.toFixed(2), 'excel 49087.02')
console.log('parsed col7 NW', col7.netWorth.toFixed(2), 'excel 121258')

const firstOk = Math.abs(first.netWorth - 49087.02) < 100
const col7Ok = Math.abs(col7.netWorth - 121258) < 500
if (!firstOk || !col7Ok) {
  console.error('Parser totals mismatch')
  process.exit(1)
}
console.log('Parser OK')
