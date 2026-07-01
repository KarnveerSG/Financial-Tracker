import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, SectionCard } from '../components/shared/MetricCard'
import { useFinanceStore } from '../store/useFinanceStore'
import { todayISO } from '../engine/format'
import type { CreditScoreEntry } from '../types'

const BUREAUS: CreditScoreEntry['bureau'][] = ['equifax', 'experian', 'transunion', 'other']

function scoreBand(s: number) {
  if (s >= 800) return { label: 'Exceptional', color: '#7d9b8a' }
  if (s >= 740) return { label: 'Very Good', color: '#c9a962' }
  if (s >= 670) return { label: 'Good', color: '#6b8fbf' }
  if (s >= 580) return { label: 'Fair', color: '#c48a4a' }
  return { label: 'Poor', color: '#c96555' }
}

export function CreditPage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const { addCreditScore, removeCreditScore } = useFinanceStore()
  const history = scenario.creditScoreHistory ?? []
  const sorted = useMemo(() => [...history].sort((a, b) => a.date.localeCompare(b.date)), [history])
  const latest = sorted.at(-1)
  const first = sorted[0]
  const delta = latest && first ? latest.score - first.score : 0
  const band = latest ? scoreBand(latest.score) : null

  // Interest paid YTD across debt accounts (approx = balance × rate × elapsed fraction of year)
  const now = new Date()
  const startYear = new Date(now.getFullYear(), 0, 1)
  const elapsedFrac = (now.getTime() - startYear.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  const interestYtd = scenario.accounts
    .filter((a) => a.isLiability)
    .reduce((sum, a) => sum + (a.balance * (a.interestRate / 100) * elapsedFrac), 0)

  const [form, setForm] = useState({ date: todayISO(), score: '', bureau: 'experian' as CreditScoreEntry['bureau'], notes: '' })

  const submit = () => {
    const s = parseInt(form.score, 10)
    if (!(s >= 300 && s <= 850)) return
    addCreditScore({ date: form.date, score: s, bureau: form.bureau, notes: form.notes || undefined })
    setForm({ ...form, score: '', notes: '' })
  }

  return (
    <div>
      <PageHeader title="Credit & Interest" subtitle="Track credit score over time and interest paid on debts" />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Latest score" value={latest ? String(latest.score) : '—'} sub={band?.label} />
        <MetricCard label="Trend" value={delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}`} trend={delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral'} sub={first && latest ? `since ${first.date}` : undefined} />
        <MetricCard label="Est. interest paid YTD" value={interestYtd.toLocaleString(undefined, { style: 'currency', currency: scenario.profile.currency, maximumFractionDigits: 0 })} sub="Sum across liability accounts" />
      </div>

      <SectionCard title="Score history">
        {sorted.length === 0 ? (
          <p className="text-sm text-ledger-muted">No entries yet.</p>
        ) : (
          <>
            <svg viewBox="0 0 600 160" className="w-full">
              {(() => {
                const min = Math.min(...sorted.map((s) => s.score)) - 20
                const max = Math.max(...sorted.map((s) => s.score)) + 20
                const range = max - min || 1
                const points = sorted.map((s, i) => {
                  const x = sorted.length === 1 ? 300 : (i / (sorted.length - 1)) * 580 + 10
                  const y = 150 - ((s.score - min) / range) * 130
                  return `${x},${y}`
                }).join(' ')
                return (
                  <>
                    <polyline points={points} fill="none" stroke="#c9a962" strokeWidth="2" />
                    {sorted.map((s, i) => {
                      const x = sorted.length === 1 ? 300 : (i / (sorted.length - 1)) * 580 + 10
                      const y = 150 - ((s.score - min) / range) * 130
                      return <circle key={s.id} cx={x} cy={y} r="3" fill="#c9a962" />
                    })}
                  </>
                )
              })()}
            </svg>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-ledger-muted"><th className="pb-2">Date</th><th className="pb-2">Bureau</th><th className="pb-2 text-right">Score</th><th className="pb-2">Notes</th><th className="pb-2"></th></tr></thead>
              <tbody>
                {[...sorted].reverse().map((s) => (
                  <tr key={s.id} className="border-t border-ledger-border">
                    <td className="py-1.5 tabular-nums">{s.date}</td>
                    <td className="py-1.5 text-ledger-muted">{s.bureau}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.score}</td>
                    <td className="py-1.5 text-ledger-muted">{s.notes ?? ''}</td>
                    <td className="py-1.5 text-right"><button type="button" onClick={() => removeCreditScore(s.id)} className="text-xs text-ledger-muted hover:text-ledger-danger">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </SectionCard>

      <SectionCard title="Log score">
        <div className="grid gap-3 md:grid-cols-5">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" />
          <input type="number" placeholder="Score (300-850)" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} className="input-field" />
          <select value={form.bureau} onChange={(e) => setForm({ ...form, bureau: e.target.value as CreditScoreEntry['bureau'] })} className="input-field">
            {BUREAUS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field md:col-span-2" />
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={submit} className="btn-primary text-sm">Log score</button>
        </div>
      </SectionCard>
    </div>
  )
}
