import { useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, SectionCard } from '../components/shared/MetricCard'
import { LineTrendChart } from '../components/charts/FinanceCharts'
import { PortfolioBreakdown } from '../components/networth/PortfolioBreakdown'
import { LineItemTaxControls } from '../components/networth/LineItemTaxControls'
import { SnapshotBalanceInput } from '../components/networth/SnapshotBalanceInput'
import { useFinanceStore } from '../store/useFinanceStore'
import {
  buildNetWorthHistorySeries,
  buildNetWorthProjectionOverlay,
  computePeriodMetrics,
  computeRetirementTaxSplit,
  computeSnapshotTotals,
  filterSnapshotsForWindow,
  getDataThroughDate,
  getDateRangePresets,
  getEffectiveSnapshots,
  getLatestSnapshotTotals,
  netWorthSnapshotsToCsv,
} from '../engine/networth'
import { formatCurrency, formatPercent, todayISO } from '../engine/format'
import type { NetWorthLineItem, NetWorthRangePreset, SnapshotWindow } from '../types'

type NetWorthChartRow = {
  label: string
  date?: string
  netWorth?: number
  assets?: number
  liabilities?: number
  projected?: number
}

const WINDOW_OPTIONS: { value: SnapshotWindow; label: string }[] = [
  { value: 6, label: '6 most recent' },
  { value: 12, label: '12 months' },
  { value: 'ytd', label: 'This year' },
  { value: 'all', label: 'All' },
]

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
    updateNetWorthLineItem,
    removeNetWorthSnapshot,
    updateUiState,
  } = useFinanceStore()

  const fileRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLTableElement>(null)
  const [importError, setImportError] = useState('')

  const { profile, netWorthLineItems, netWorthSnapshots, accounts, assumptions } = scenario
  const uiState = scenario.uiState ?? {
    netWorthExpandedGroups: {} as Record<string, boolean>,
    netWorthSnapshotWindow: 6 as const,
    netWorthRangePreset: 'all' as const,
    netWorthShowProjection: true,
    netWorthManualDate: todayISO(),
  }
  const expandedGroups: Record<string, boolean> = uiState.netWorthExpandedGroups ?? {}
  const snapshotWindow = uiState.netWorthSnapshotWindow
  const rangePreset: NetWorthRangePreset = uiState.netWorthRangePreset ?? 'all'
  const showProjection = uiState.netWorthShowProjection ?? true
  const manualDate = uiState.netWorthManualDate ?? todayISO()

  const effectiveSnapshots = useMemo(
    () => getEffectiveSnapshots(netWorthSnapshots, netWorthLineItems),
    [netWorthSnapshots, netWorthLineItems]
  )

  const visibleSnapshots = useMemo(
    () => filterSnapshotsForWindow(effectiveSnapshots, snapshotWindow),
    [effectiveSnapshots, snapshotWindow]
  )

  const dataThroughDate = useMemo(
    () => getDataThroughDate(netWorthSnapshots, netWorthLineItems),
    [netWorthSnapshots, netWorthLineItems]
  )

  const latestTotals = useMemo(() => getLatestSnapshotTotals(scenario), [scenario])

  const latestSnapshot = effectiveSnapshots.at(-1) ?? null
  const retirementTaxSplit = useMemo(
    () => (latestSnapshot ? computeRetirementTaxSplit(latestSnapshot, netWorthLineItems) : null),
    [latestSnapshot, netWorthLineItems]
  )

  const rangePresets = useMemo(
    () => getDateRangePresets(netWorthSnapshots, netWorthLineItems),
    [netWorthSnapshots, netWorthLineItems]
  )

  const selectedRange = rangePresets[rangePreset] ?? rangePresets.all

  const periodMetrics = useMemo(
    () =>
      computePeriodMetrics(
        netWorthSnapshots,
        netWorthLineItems,
        accounts,
        selectedRange.start,
        selectedRange.end,
        assumptions
      ),
    [netWorthSnapshots, netWorthLineItems, accounts, selectedRange, assumptions]
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

  const groupIds = useMemo(
    () => displayItems.filter((i) => i.kind === 'group').map((i) => i.id),
    [displayItems]
  )

  const visibleRows = useMemo(() => {
    const hiddenChildIds = new Set<string>()
    for (const group of displayItems) {
      if (group.kind === 'group' && !expandedGroups[group.id]) {
        for (const child of displayItems) {
          if (child.kind === 'account' && child.parentId === group.id) {
            hiddenChildIds.add(child.id)
          }
        }
      }
    }
    return displayItems.filter((item) => !hiddenChildIds.has(item.id))
  }, [displayItems, expandedGroups])

  const toggleGroup = (groupId: string) => {
    updateUiState({
      netWorthExpandedGroups: {
        ...expandedGroups,
        [groupId]: !expandedGroups[groupId],
      },
    })
  }

  const expandAllGroups = () => {
    const next: Record<string, boolean> = {}
    for (const id of groupIds) next[id] = true
    updateUiState({ netWorthExpandedGroups: next })
  }

  const collapseAllGroups = () => {
    updateUiState({ netWorthExpandedGroups: {} })
  }

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
    const csv = netWorthSnapshotsToCsv(netWorthLineItems, effectiveSnapshots)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'net-worth-history.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const empty = effectiveSnapshots.length === 0

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
            max={todayISO()}
            onChange={(e) => updateUiState({ netWorthManualDate: e.target.value })}
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
              onChange={(e) => updateUiState({ netWorthShowProjection: e.target.checked })}
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
          {dataThroughDate && (
            <> Empty or future month columns are ignored. Data through <strong>{dataThroughDate}</strong>.</>
          )}
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
            {(['1M', '3M', '1Y', 'YTD', 'all'] as NetWorthRangePreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => updateUiState({ netWorthRangePreset: preset })}
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
              sub={dataThroughDate ? `As of ${dataThroughDate}` : undefined}
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
              sub="Modified Dietz (adj. contributions & distributions)"
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
            {retirementTaxSplit && retirementTaxSplit.pretax + retirementTaxSplit.roth > 0 && (
              <>
                <MetricCard
                  label="Pre-tax Retirement"
                  value={formatCurrency(retirementTaxSplit.pretax, profile.currency)}
                  sub={formatPercent(retirementTaxSplit.pretaxPercent * 100)}
                />
                <MetricCard
                  label="Roth / Post-tax Retirement"
                  value={formatCurrency(retirementTaxSplit.roth, profile.currency)}
                  sub={formatPercent(retirementTaxSplit.rothPercent * 100)}
                />
              </>
            )}
          </div>

          <div className="mt-8">
            <SectionCard title="Portfolio breakdown">
              <PortfolioBreakdown />
            </SectionCard>
          </div>

          <div className={`mt-8 grid gap-6 ${showProjection ? '' : 'lg:grid-cols-2'}`}>
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
            {!showProjection && (
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
            )}
          </div>

          <SectionCard
            title="Snapshot grid"
            action={
              <div className="flex gap-2">
                <button type="button" className="btn-ghost text-xs" onClick={expandAllGroups}>
                  Expand all
                </button>
                <button type="button" className="btn-ghost text-xs" onClick={collapseAllGroups}>
                  Collapse all
                </button>
              </div>
            }
          >
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ledger-muted">Show:</span>
              {WINDOW_OPTIONS.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => updateUiState({ netWorthSnapshotWindow: opt.value })}
                  className={`rounded-xl px-3 py-1 text-sm ${
                    snapshotWindow === opt.value
                      ? 'bg-ledger-gold/15 font-medium text-ledger-gold'
                      : 'text-ledger-muted hover:bg-ledger-elevated'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <table ref={gridRef} className="w-full min-w-[640px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-ledger-surface">
                  <tr className="border-b border-ledger-border text-ledger-muted">
                    <th className="sticky left-0 z-20 bg-ledger-surface px-3 py-2">Account</th>
                    {visibleSnapshots.map((snapshot) => (
                      <th key={snapshot.id} className="px-3 py-2 whitespace-nowrap bg-ledger-surface">
                        <div className="flex items-center gap-1">
                          <span>{snapshot.date}</span>
                          {effectiveSnapshots.length > 1 && (
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
                    <th className="px-3 py-2 bg-ledger-surface">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((item, rowIndex) => {
                    if (item.kind === 'group') {
                      const isExpanded = !!expandedGroups[item.id]
                      return (
                        <tr key={item.id} className="border-b border-ledger-border/50 bg-ledger-elevated/40">
                          <td
                            className="sticky left-0 z-10 bg-ledger-elevated/40 px-3 py-2 font-medium cursor-pointer select-none"
                            style={{ paddingLeft: `${indentLevel(item, netWorthLineItems) * 12 + 12}px` }}
                            onClick={() => toggleGroup(item.id)}
                          >
                            <span className="mr-1 text-ledger-muted">{isExpanded ? '▾' : '▸'}</span>
                            {item.name}
                          </td>
                          {visibleSnapshots.map((snapshot, colIndex) => (
                            <td key={snapshot.id} className="px-3 py-1.5">
                              <SnapshotBalanceInput
                                gridRef={gridRef}
                                rowIndex={rowIndex}
                                colIndex={colIndex}
                                className="input-field w-28 py-1 text-right text-sm font-medium"
                                value={snapshot.balances[item.id] ?? ''}
                                onChange={(val) => updateNetWorthBalance(snapshot.id, item.id, val)}
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
                          className="sticky left-0 z-10 bg-ledger-surface px-3 py-1.5"
                          style={{ paddingLeft: `${indentLevel(item, netWorthLineItems) * 12 + 12}px` }}
                        >
                          <div>{item.name}</div>
                          <LineItemTaxControls
                            item={item}
                            onUpdate={(partial) => updateNetWorthLineItem(item.id, partial)}
                          />
                        </td>
                        {visibleSnapshots.map((snapshot, colIndex) => (
                          <td key={snapshot.id} className="px-3 py-1.5">
                            <SnapshotBalanceInput
                              gridRef={gridRef}
                              rowIndex={rowIndex}
                              colIndex={colIndex}
                              className="input-field w-28 py-1 text-right text-sm"
                              value={snapshot.balances[item.id] ?? ''}
                              onChange={(val) => updateNetWorthBalance(snapshot.id, item.id, val)}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-ledger-muted">—</td>
                      </tr>
                    )
                  })}
                  <tr className="border-t border-ledger-border font-medium">
                    <td className="sticky left-0 z-10 bg-ledger-surface px-3 py-2">Net Worth</td>
                    {visibleSnapshots.map((snapshot) => {
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
