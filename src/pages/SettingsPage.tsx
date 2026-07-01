import { useRef, useState } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { SectionCard, InputRow } from '../components/shared/MetricCard'
import {
  useFinanceStore,
  exportAppState,
  parseAppState,
} from '../store/useFinanceStore'
import { accountsToCsv, parseAccountsCsv, resolveAccountBalance } from '../engine/accounts'
import { computeSnapshotTotals, getLatestEffectiveSnapshot } from '../engine/networth'
import { formatCurrency } from '../engine/format'
import { CURRENCIES, DEFAULT_ALLOCATION_CATEGORIES } from '../types'

export function SettingsPage() {
  const state = useFinanceStore()
  const {
    scenarios,
    activeScenarioId,
    setActiveScenario,
    addScenario,
    duplicateScenario,
    deleteScenario,
    updateProfile,
    updateAllocationCategories,
    loadDemo,
    resetAll,
    importState,
    getActiveScenario,
  } = state

  const scenario = getActiveScenario()
  const [importError, setImportError] = useState('')
  const [resetConfirm, setResetConfirm] = useState(false)
  const jsonRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)

  const handleExportJson = () => {
    const json = exportAppState({ scenarios, activeScenarioId, hasOnboarded: true, priceCache: state.priceCache })
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `midnight-ledger-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        importState(parseAppState(reader.result as string))
        setImportError('')
      } catch {
        setImportError('Invalid JSON export file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleExportCsv = () => {
    const csv = accountsToCsv(scenario.accounts)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `accounts-${scenario.name.replace(/\s+/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const accounts = parseAccountsCsv(reader.result as string)
        state.setAccounts(accounts)
        setImportError('')
      } catch {
        setImportError('Invalid CSV file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleReset = () => {
    if (resetConfirm) {
      resetAll()
      setResetConfirm(false)
    } else {
      setResetConfirm(true)
    }
  }

  const addCustomCategory = () => {
    const id = `custom_${Date.now()}`
    updateAllocationCategories([
      ...scenario.allocationCategories,
      { id, label: 'Custom Category', color: '#a68b4b' },
    ])
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Scenarios, data management, and customization" />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Profile">
          <div className="space-y-4">
            <InputRow label="Name">
              <input value={scenario.profile.name} onChange={(e) => updateProfile({ name: e.target.value })} className="input-field" />
            </InputRow>
            <InputRow label="Currency">
              <select value={scenario.profile.currency} onChange={(e) => updateProfile({ currency: e.target.value as typeof scenario.profile.currency })} className="input-field">
                {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </InputRow>
            <InputRow label="Annual Salary">
              <input type="number" value={scenario.profile.annualSalary} onChange={(e) => updateProfile({ annualSalary: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
          </div>
        </SectionCard>

        <SectionCard
          title="Scenarios"
          action={
            <button type="button" onClick={() => addScenario()} className="btn-ghost text-sm text-ledger-gold">
              + New
            </button>
          }
        >
          <div className="space-y-2">
            {scenarios.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl bg-ledger-bg/50 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setActiveScenario(s.id)}
                  className={`text-sm ${s.id === activeScenarioId ? 'font-medium text-ledger-gold' : 'text-ledger-muted'}`}
                >
                  {s.name}
                </button>
                <div className="flex gap-1">
                  <button type="button" onClick={() => duplicateScenario(s.id)} className="btn-ghost text-xs">Copy</button>
                  {scenarios.length > 1 && (
                    <button type="button" onClick={() => deleteScenario(s.id)} className="btn-ghost text-xs text-ledger-danger">Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Allocation Categories">
          <div className="space-y-2">
            {scenario.allocationCategories.map((cat, i) => (
              <div key={cat.id} className="flex items-center gap-2">
                <input
                  type="color"
                  value={cat.color}
                  onChange={(e) => {
                    const next = [...scenario.allocationCategories]
                    next[i] = { ...cat, color: e.target.value }
                    updateAllocationCategories(next)
                  }}
                  className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
                />
                <input
                  value={cat.label}
                  onChange={(e) => {
                    const next = [...scenario.allocationCategories]
                    next[i] = { ...cat, label: e.target.value }
                    updateAllocationCategories(next)
                  }}
                  className="input-field flex-1"
                />
              </div>
            ))}
          </div>
          <button type="button" onClick={addCustomCategory} className="btn-ghost mt-3 text-sm">
            + Add category
          </button>
          <button
            type="button"
            onClick={() => updateAllocationCategories([...DEFAULT_ALLOCATION_CATEGORIES])}
            className="btn-ghost mt-2 text-sm"
          >
            Reset to defaults
          </button>
        </SectionCard>

        <SectionCard title="Data Management">
          <p className="mb-4 text-sm text-ledger-muted">
            Data persists in localStorage. Export regularly. Supabase backend hook available in store for future sync.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleExportJson} className="btn-secondary">Export JSON</button>
            <button type="button" onClick={() => jsonRef.current?.click()} className="btn-secondary">Import JSON</button>
            <button type="button" onClick={handleExportCsv} className="btn-secondary">Export CSV</button>
            <button type="button" onClick={() => csvRef.current?.click()} className="btn-secondary">Import CSV</button>
            <input ref={jsonRef} type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            <input ref={csvRef} type="file" accept=".csv" onChange={handleImportCsv} className="hidden" />
          </div>
          {importError && <p className="mt-2 text-sm text-ledger-danger">{importError}</p>}
        </SectionCard>

        <SectionCard title="Market data">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={scenario.profile.marketData.livePricesEnabled}
                onChange={(e) => state.updateMarketData({ livePricesEnabled: e.target.checked })}
                className="rounded"
              />
              Fetch live stock prices
            </label>
            <InputRow label="Quote provider">
              <select
                value={scenario.profile.marketData.quoteProvider}
                onChange={(e) => state.updateMarketData({ quoteProvider: e.target.value as typeof scenario.profile.marketData.quoteProvider })}
                className="input-field"
              >
                <option value="yahoo">Yahoo Finance (Electron / dev proxy)</option>
                <option value="stooq">Stooq (Electron / dev proxy)</option>
                <option value="alphavantage">Alpha Vantage (API key)</option>
                <option value="finnhub">Finnhub (API key)</option>
              </select>
            </InputRow>
            {scenario.profile.marketData.quoteProvider === 'alphavantage' && (
              <InputRow label="Alpha Vantage API key">
                <input
                  type="password"
                  value={scenario.profile.marketData.alphaVantageKey}
                  onChange={(e) => state.updateMarketData({ alphaVantageKey: e.target.value })}
                  className="input-field"
                />
              </InputRow>
            )}
            {scenario.profile.marketData.quoteProvider === 'finnhub' && (
              <InputRow label="Finnhub API key">
                <input
                  type="password"
                  value={scenario.profile.marketData.finnhubKey}
                  onChange={(e) => state.updateMarketData({ finnhubKey: e.target.value })}
                  className="input-field"
                />
              </InputRow>
            )}
            <InputRow label="Default cost basis method">
              <select
                value={scenario.profile.defaultLotMethod}
                onChange={(e) => updateProfile({ defaultLotMethod: e.target.value as typeof scenario.profile.defaultLotMethod })}
                className="input-field"
              >
                <option value="fifo">FIFO</option>
                <option value="lifo">LIFO</option>
                <option value="avg">Average</option>
                <option value="hifo">HIFO</option>
                <option value="specific_id">Specific ID</option>
              </select>
            </InputRow>
            {scenario.profile.marketData.lastPriceRefresh && (
              <p className="text-sm text-ledger-muted">
                Last refresh: {new Date(scenario.profile.marketData.lastPriceRefresh).toLocaleString()}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void state.refreshPrices()} className="btn-secondary text-sm">
                Refresh prices now
              </button>
              <button type="button" onClick={() => state.clearPriceCache()} className="btn-secondary text-sm">
                Clear price cache
              </button>
            </div>
            <p className="text-xs text-ledger-muted">
              Yahoo/Stooq need Electron or the Vite dev proxy. Web builds use Alpha Vantage or Finnhub keys.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Data reconciliation">
          {(() => {
            const accountsAssets = scenario.accounts.filter((a) => !a.isLiability).reduce((s, a) => s + resolveAccountBalance(a), 0)
            const accountsLiabs = scenario.accounts.filter((a) => a.isLiability).reduce((s, a) => s + resolveAccountBalance(a), 0)
            const accountsNw = accountsAssets - accountsLiabs
            const latestSnap = getLatestEffectiveSnapshot(scenario.netWorthSnapshots, scenario.netWorthLineItems)
            const snapshotTotals = latestSnap ? computeSnapshotTotals(latestSnap, scenario.netWorthLineItems) : null
            const diff = snapshotTotals ? accountsNw - snapshotTotals.netWorth : 0
            const mismatch = Math.abs(diff) > 100
            return (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-ledger-muted">Sum of account balances (net):</span><span className="tabular-nums">{formatCurrency(accountsNw, scenario.profile.currency)}</span></div>
                <div className="flex justify-between"><span className="text-ledger-muted">Latest snapshot net worth {latestSnap ? `(${latestSnap.date})` : ''}:</span><span className="tabular-nums">{snapshotTotals ? formatCurrency(snapshotTotals.netWorth, scenario.profile.currency) : '—'}</span></div>
                <div className={`flex justify-between font-medium ${mismatch ? 'text-ledger-danger' : 'text-emerald-400'}`}>
                  <span>Difference:</span><span className="tabular-nums">{formatCurrency(diff, scenario.profile.currency)}</span>
                </div>
                {mismatch && <p className="text-xs text-ledger-muted">Snapshots are user-owned history; account balances reflect current live state. Large gaps are normal after months without recording a snapshot.</p>}
              </div>
            )
          })()}
        </SectionCard>

        <SectionCard title="Testing">
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => state.loadNwTrackerSeed()} className="btn-secondary">Load my NW Tracker</button>
            <button type="button" onClick={loadDemo} className="btn-secondary">Load demo data</button>
            <button
              type="button"
              onClick={handleReset}
              className={`btn-secondary ${resetConfirm ? 'border-ledger-danger text-ledger-danger' : ''}`}
            >
              {resetConfirm ? 'Confirm reset' : 'Reset all data'}
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
