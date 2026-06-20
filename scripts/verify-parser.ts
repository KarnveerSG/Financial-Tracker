import fs from 'node:fs'
import {
  parseNwTrackerXlsx,
  computeSnapshotTotals,
  getEffectiveSnapshots,
  getLatestEffectiveSnapshot,
} from '../src/engine/networth.ts'

const filePath = process.argv[2] ?? 'c:/Users/Karnveer/Downloads/NW Tracker.xlsx'

if (!fs.existsSync(filePath)) {
  console.log(`SKIP  NW Tracker.xlsx not found at ${filePath}`)
  process.exit(0)
}

const buffer = fs.readFileSync(filePath)
const { lineItems, snapshots } = parseNwTrackerXlsx(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
)

const effective = getEffectiveSnapshots(snapshots, lineItems)
const first = computeSnapshotTotals(effective[0], lineItems)
const col7 = computeSnapshotTotals(effective[6], lineItems)
const latest = getLatestEffectiveSnapshot(snapshots, lineItems)

console.log('accounts', lineItems.filter((i) => i.kind === 'account').length)
console.log('snapshots imported', snapshots.length, 'effective', effective.length)
console.log('parsed first NW', first.netWorth.toFixed(2), 'excel 49087.02')
console.log('parsed col7 NW', col7.netWorth.toFixed(2), 'excel 121258')
console.log('latest data through', latest?.date)

const firstOk = Math.abs(first.netWorth - 49087.02) < 100
const col7Ok = Math.abs(col7.netWorth - 121258) < 500
if (!firstOk || !col7Ok) {
  console.error('Parser totals mismatch')
  process.exit(1)
}
if (latest && latest.date > new Date().toISOString().slice(0, 10)) {
  console.error('Latest snapshot should not be in the future')
  process.exit(1)
}
console.log('Parser OK')
