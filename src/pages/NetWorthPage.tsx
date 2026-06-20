import { useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, SectionCard } from '../components/shared/MetricCard'
import { LineTrendChart } from '../components/charts/FinanceCharts'
import { useFinanceStore } from '../store/useFinanceStore'
import {
  buildNetWorthHistorySeries,
  buildNetWorthProjectionOverlay,
  computePeriodMetrics,
  computeSnapshotTotals,
  getDateRangePresets,
  getLatestSnapshotTotals,
  netWorthSnapshotsToCsv,
} from '../engine/networth'
import { formatCurrency, formatPercent } from '../engine/format'
import type { NetWorthLineItem } from '../types'

type RangePreset = '1M' | '3M' | '1Y' | 'YTD' | 'all'

type NetWorthChartRow = {
  label: string
  date?: string
  netWorth?: number
  assets?: number
  liabilities?: number
  projected?: number
}

function indentLevel(item: NetWorthLineItem, items: NetWorthLineItem[]): number {
  let depth = 0
  let current: NetWorthLineItem | undefined = item
  while (current?.parentId) {
    depth++
    current = items.find((i) => i.id === current!.parentId)
  }
  return item.kind === 'section' ? 0 : item.kind === 'group' ? 1 : depth + 1
}

export function NetWorthPage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const {
    importNetWorthFromXlsx,
    recordNetWorthFromAccounts,
    addNetWorthSnapshot,
    updateNetWorthBalance,
    removeNetWorthSnapshot,
  } = useFinanceStore()

  const fileRef = useRef<HTMLInputElement>(null)
  const [rangePreset, setRangePreset] = useState<RangePreset>('all')
  const [showProjection, setShowProjection] = useState(true)
  const [importError, setImportError] = useState('')
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10))

  const { profile, netWorthLineItems, netWorthSnapshots, accounts } = scenario
  const sortedSnapshots = useMemo(
    () => [...netWorthSnapshots].sort((a, b) => a.date.localeCompare(b.date)),
    [netWorthSnapshots]
  )

  const latestTotals = useMemo(
    () => getLatestSnapshotTotals(scenario),
    [scenario]
  )

  const rangePresets = useMemo(
    () => getDateRangePresets(netWorthSnapshots),
    [netWorthSnapshots]
  )

  const selectedRange = rangePresets[rangePreset] ?? rangePresets.all

  const periodMetrics = useMemo(
    () =>
      computePeriodMetrics(
        netWorthSnapshots,
        netWorthLineItems,
        accounts,
        selectedRange.start,
        selectedRange.end
      ),
    [netWorthSnapshots, netWorthLineItems, accounts, selectedRange]
  )

  const historySeries = useMemo(
    () => buildNetWorthHistorySeries(netWorthSnapshots, netWorthLineItems),
    [netWorthSnapshots, netWorthLineItems]
  )

  const chartData = useMemo((): NetWorthChartRow[] => {
    if (!showProjection || historySeries.length === 0) return historySeries
    return buildNetWorthProjectionOverlay(
      netWorthSnapshots,
      netWorthLineItems,
      profile,
      scenario.assumptions,
      accounts,
      10
    ).map((point) => ({
      label: point.label,
      date: point.date,
      netWorth: point.projected == null ? point.netWorth : undefined,
      assets: point.assets,
      liabilities: point.liabilities,
      projected: point.projected,
    }))
  }, [
    showProjection,
    historySeries,
    netWorthSnapshots,
    netWorthLineItems,
    profile,
    scenario.assumptions,
    accounts,
  ])

  const displayItems = useMemo(
    () =>
      [...netWorthLineItems]
        .filter((item) => item.kind === 'account' || item.kind === 'group')
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [netWorthLineItems]
  )

  const handleImport = async (file: File) => {
    setImportError('')
    try {
      const buffer = await file.arrayBuffer()
      importNetWorthFromXlsx(buffer)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    }
  }

  const handleExportCsv = () => {
    const csv = netWorthSnapshotsToCsv(netWorthLineItems, netWorthSnapshots)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'net-worth-history.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const empty = sortedSnapshots.length === 0

  return (
    <div>
      <PageHeader
        title="Net Worth Tracker"
        subtitle="Historical snapshots, rate of return, contributions, and forward projections"
      />

      <SectionCard title="Actions">
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>
            Import .xlsx
          </button>
          <button type="button" className="btn-secondary" onClick={() => recordNetWorthFromAccounts()}>
            Record snapshot today
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => addNetWorthSnapshot(manualDate)}
          >
            Add snapshot date
          </button>
          <input
            type="date"
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
            className="input-field w-auto"
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportCsv}
            disabled={empty}
          >
            Export CSV
          </button>
          <label className="flex items-center gap-2 text-sm text-ledger-muted">
            <input
              type="checkbox"
              checked={showProjection}
              onChange={(e) => setShowProjection(e.target.checked)}
            />
            Show 10-year projection
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImport(file)
              e.target.value = ''
            }}
          />
        </div>
        {importError && <p className="mt-2 text-sm text-ledger-danger">{importError}</p>}
        <p className="mt-3 text-sm text-ledger-muted">
          Import your NW Tracker workbook — the app reads the &quot;Net Worth Tracker&quot; sheet format.
        </p>
      </SectionCard>

      {empty ? (
        <SectionCard title="Get started">
          <p className="text-sm text-ledger-muted">
            Import your Excel file or record a snapshot from your Accounts page to begin tracking net worth over time.
          </p>
        </SectionCard>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {(['1M', '3M', '1Y', 'YTD', 'all'] as RangePreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRangePreset(preset)}
                className={`rounded-xl px-3 py-1.5 text-sm ${
                  rangePreset === preset
                    ? 'bg-ledger-gold/15 font-medium text-ledger-gold'
                    : 'text-ledger-muted hover:bg-ledger-elevated'
                }`}
              >
                {preset === 'all' ? 'All' : preset}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Net Worth"
              value={formatCurrency(latestTotals?.netWorth ?? 0, profile.currency)}
              sub={sortedSnapshots.at(-1)?.date}
            />
            <MetricCard
              label="Period Change"
              value={formatCurrency(periodMetrics?.dollarChange ?? 0, profile.currency)}
              sub={periodMetrics ? `${formatPercent((periodMetrics.percentChange ?? 0) * 100)} over range` : undefined}
              trend={(periodMetrics?.dollarChange ?? 0) >= 0 ? 'up' : 'down'}
            />
            <MetricCard
              label="Investment ROR"
              value={formatPercent((periodMetrics?.investmentRor ?? 0) * 100)}
              sub="Modified Dietz (excl. contributions)"
              trend={(periodMetrics?.investmentRor ?? 0) >= 0 ? 'up' : 'down'}
            />
            <MetricCard
              label="CAGR"
              value={formatPercent((periodMetrics?.cagr ?? 0) * 100)}
              sub={`${periodMetrics?.startDate ?? ''} → ${periodMetrics?.endDate ?? ''}`}
            />
            <MetricCard
              label="Est. Contributions"
              value={formatCurrency(periodMetrics?.estimatedContributions ?? 0, profile.currency)}
              sub="From account monthly contributions"
            />
            <MetricCard
              label="YTD Change"
              value={formatCurrency(periodMetrics?.ytdDollarChange ?? 0, profile.currency)}
              sub={formatPercent((periodMetrics?.ytdPercentChange ?? 0) * 100)}
              trend={(periodMetrics?.ytdDollarChange ?? 0) >= 0 ? 'up' : 'down'}
            />
            <MetricCard
              label="Total Investments"
              value={formatCurrency(latestTotals?.totalInvestments ?? 0, profile.currency)}
            />
            <MetricCard
              label="Cash / Equity"
              value={formatCurrency(latestTotals?.cashEquity ?? 0, profile.currency)}
            />
            <MetricCard
              label="Total Assets"
              value={formatCurrency(latestTotals?.totalAssets ?? 0, profile.currency)}
            />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <SectionCard title="Net worth history">
              <LineTrendChart
                data={chartData}
                xKey="label"
                currency={profile.currency}
                lines={[
                  { key: 'netWorth', color: '#c9a962', label: 'Net worth' },
                  ...(showProjection
                    ? [{ key: 'projected' as const, color: '#6b8fbf', label: 'Projected' }]
                    : []),
                ]}
              />
            </SectionCard>
            <SectionCard title="Assets vs liabilities">
              <LineTrendChart
                data={historySeries}
                xKey="label"
                currency={profile.currency}
                lines={[
                  { key: 'assets', color: '#7d9b8a', label: 'Assets' },
                  { key: 'liabilities', color: '#b85c5c', label: 'Liabilities' },
                ]}
              />
            </SectionCard>
          </div>

          <SectionCard title="Snapshot grid">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ledger-border text-ledger-muted">
                    <th className="sticky left-0 bg-ledger-surface px-3 py-2">Account</th>
                    {sortedSnapshots.map((snapshot) => (
                      <th key={snapshot.id} className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span>{snapshot.date}</span>
                          {sortedSnapshots.length > 1 && (
                            <button
                              type="button"
                              className="text-xs text-ledger-danger hover:underline"
                              onClick={() => removeNetWorthSnapshot(snapshot.id)}
                              aria-label={`Remove snapshot ${snapshot.date}`}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item) => {
                    if (item.kind === 'group') {
                      return (
                        <tr key={item.id} className="border-b border-ledger-border/50 bg-ledger-elevated/40">
                          <td
                            className="sticky left-0 bg-ledger-elevated/40 px-3 py-2 font-medium"
                            style={{ paddingLeft: `${indentLevel(item, netWorthLineItems) * 12 + 12}px` }}
                          >
                            {item.name}
                          </td>
                          {sortedSnapshots.map((snapshot) => (
                            <td key={snapshot.id} className="px-3 py-1.5">
                              <input
                                type="number"
                                className="input-field w-28 py-1 text-right text-sm font-medium"
                                value={snapshot.balances[item.id] ?? ''}
                                onChange={(e) => {
                                  const raw = e.target.value
                                  updateNetWorthBalance(
                                    snapshot.id,
                                    item.id,
                                    raw === '' ? null : Number(raw)
                                  )
                                }}
                              />
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-ledger-muted">—</td>
                        </tr>
                      )
                    }

                    return (
                      <tr key={item.id} className="border-b border-ledger-border/30">
                        <td
                          className="sticky left-0 bg-ledger-surface px-3 py-1.5"
                          style={{ paddingLeft: `${indentLevel(item, netWorthLineItems) * 12 + 12}px` }}
                        >
                          {item.name}
                        </td>
                        {sortedSnapshots.map((snapshot) => (
                          <td key={snapshot.id} className="px-3 py-1.5">
                            <input
                              type="number"
                              className="input-field w-28 py-1 text-right text-sm"
                              value={snapshot.balances[item.id] ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value
                                updateNetWorthBalance(
                                  snapshot.id,
                                  item.id,
                                  raw === '' ? null : Number(raw)
                                )
                              }}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-ledger-muted">—</td>
                      </tr>
                    )
                  })}
                  <tr className="border-t border-ledger-border font-medium">
                    <td className="sticky left-0 bg-ledger-surface px-3 py-2">Net Worth</td>
                    {sortedSnapshots.map((snapshot) => {
                      const totals = computeSnapshotTotals(snapshot, netWorthLineItems)
                      return (
                        <td key={snapshot.id} className="px-3 py-2">
                          {formatCurrency(totals.netWorth, profile.currency)}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}
