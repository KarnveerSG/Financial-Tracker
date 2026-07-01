import { useState } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, ProgressGauge, SectionCard } from '../components/shared/MetricCard'
import { useFinanceStore } from '../store/useFinanceStore'
import { formatCurrency } from '../engine/format'
import { summarizeCashFlow } from '../engine/cashFlow'
import type { GoalKind } from '../types'

const GOAL_KINDS: { value: GoalKind; label: string }[] = [
  { value: 'emergency_fund', label: 'Emergency Fund' },
  { value: 'down_payment', label: 'Down Payment' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'car', label: 'Car' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'other', label: 'Other' },
]

export function GoalsPage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const { addGoal, updateGoal, removeGoal, addSinkingFund, updateSinkingFund, removeSinkingFund } = useFinanceStore()
  const currency = scenario.profile.currency
  const goals = scenario.goals ?? []
  const funds = scenario.sinkingFunds ?? []

  // Emergency-fund health check: uses last month's expenses (if cash flow exists)
  const cashFlow = scenario.cashFlowEntries ?? []
  const now = new Date()
  const lastMonthSummary = summarizeCashFlow(cashFlow, new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0))
  const monthlyExpenses = lastMonthSummary.expenses
  const emergencyGoal = goals.find((g) => g.kind === 'emergency_fund')
  const monthsCovered = monthlyExpenses > 0 && emergencyGoal ? emergencyGoal.currentAmount / monthlyExpenses : 0

  const [goalForm, setGoalForm] = useState({ name: '', kind: 'other' as GoalKind, targetAmount: '', currentAmount: '', targetDate: '', monthlyContribution: '' })
  const [fundForm, setFundForm] = useState({ name: '', targetAmount: '', currentAmount: '', dueDate: '', monthlyContribution: '' })

  const submitGoal = () => {
    const target = parseFloat(goalForm.targetAmount)
    if (!goalForm.name.trim() || !(target > 0)) return
    addGoal({
      name: goalForm.name.trim(),
      kind: goalForm.kind,
      targetAmount: target,
      currentAmount: parseFloat(goalForm.currentAmount) || 0,
      targetDate: goalForm.targetDate || undefined,
      monthlyContribution: parseFloat(goalForm.monthlyContribution) || 0,
    })
    setGoalForm({ name: '', kind: 'other', targetAmount: '', currentAmount: '', targetDate: '', monthlyContribution: '' })
  }

  const submitFund = () => {
    const target = parseFloat(fundForm.targetAmount)
    if (!fundForm.name.trim() || !(target > 0)) return
    addSinkingFund({
      name: fundForm.name.trim(),
      targetAmount: target,
      currentAmount: parseFloat(fundForm.currentAmount) || 0,
      dueDate: fundForm.dueDate || undefined,
      monthlyContribution: parseFloat(fundForm.monthlyContribution) || 0,
    })
    setFundForm({ name: '', targetAmount: '', currentAmount: '', dueDate: '', monthlyContribution: '' })
  }

  return (
    <div>
      <PageHeader title="Goals & Sinking Funds" subtitle="Track progress toward specific savings targets and known future expenses" />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Active goals" value={String(goals.length)} />
        <MetricCard
          label="Total saved toward goals"
          value={formatCurrency(goals.reduce((s, g) => s + g.currentAmount, 0), currency)}
        />
        <MetricCard
          label="Emergency fund coverage"
          value={monthsCovered > 0 ? `${monthsCovered.toFixed(1)} mo` : '—'}
          sub={monthsCovered >= 6 ? 'Healthy (6+ months)' : monthsCovered >= 3 ? 'Building (3-6 months)' : 'Below target'}
          trend={monthsCovered >= 6 ? 'up' : monthsCovered >= 3 ? 'neutral' : 'down'}
        />
      </div>

      <SectionCard title="Financial goals">
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0
            const remaining = Math.max(0, g.targetAmount - g.currentAmount)
            const monthsLeft = g.monthlyContribution && g.monthlyContribution > 0 ? Math.ceil(remaining / g.monthlyContribution) : null
            return (
              <div key={g.id} className="rounded-xl border border-ledger-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{g.name}</p>
                    <p className="text-xs text-ledger-muted">{GOAL_KINDS.find((k) => k.value === g.kind)?.label}</p>
                  </div>
                  <button type="button" onClick={() => removeGoal(g.id)} className="text-xs text-ledger-muted hover:text-ledger-danger">Remove</button>
                </div>
                <ProgressGauge label="Progress" percent={pct} detail={`${formatCurrency(g.currentAmount, currency)} of ${formatCurrency(g.targetAmount, currency)}`} />
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <label>
                    <span className="label">Current</span>
                    <input type="number" value={g.currentAmount} onChange={(e) => updateGoal(g.id, { currentAmount: +e.target.value })} className="input-field" />
                  </label>
                  <label>
                    <span className="label">Monthly</span>
                    <input type="number" value={g.monthlyContribution ?? 0} onChange={(e) => updateGoal(g.id, { monthlyContribution: +e.target.value })} className="input-field" />
                  </label>
                </div>
                {monthsLeft !== null && (
                  <p className="mt-2 text-xs text-ledger-muted">≈ {monthsLeft} months to complete at current pace</p>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-6">
          <input placeholder="Goal name" value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} className="input-field md:col-span-2" />
          <select value={goalForm.kind} onChange={(e) => setGoalForm({ ...goalForm, kind: e.target.value as GoalKind })} className="input-field">
            {GOAL_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <input placeholder="Target" type="number" value={goalForm.targetAmount} onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })} className="input-field" />
          <input placeholder="Current" type="number" value={goalForm.currentAmount} onChange={(e) => setGoalForm({ ...goalForm, currentAmount: e.target.value })} className="input-field" />
          <input placeholder="Monthly" type="number" value={goalForm.monthlyContribution} onChange={(e) => setGoalForm({ ...goalForm, monthlyContribution: e.target.value })} className="input-field" />
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={submitGoal} className="btn-primary text-sm">Add goal</button>
        </div>
      </SectionCard>

      <SectionCard title="Sinking funds">
        <p className="mb-3 text-xs text-ledger-muted">Small pots you're filling toward known future expenses (annual insurance, holiday gifts, subscriptions).</p>
        <div className="grid gap-3 md:grid-cols-2">
          {funds.map((f) => {
            const pct = f.targetAmount > 0 ? (f.currentAmount / f.targetAmount) * 100 : 0
            return (
              <div key={f.id} className="rounded-xl border border-ledger-border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{f.name}</p>
                  <button type="button" onClick={() => removeSinkingFund(f.id)} className="text-xs text-ledger-muted hover:text-ledger-danger">Remove</button>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-ledger-border overflow-hidden">
                  <div className="h-full bg-ledger-gold" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-ledger-muted tabular-nums">
                  <span>{formatCurrency(f.currentAmount, currency)}</span>
                  <span>{formatCurrency(f.targetAmount, currency)}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <label>
                    <span className="label">Current</span>
                    <input type="number" value={f.currentAmount} onChange={(e) => updateSinkingFund(f.id, { currentAmount: +e.target.value })} className="input-field" />
                  </label>
                  <label>
                    <span className="label">Monthly</span>
                    <input type="number" value={f.monthlyContribution} onChange={(e) => updateSinkingFund(f.id, { monthlyContribution: +e.target.value })} className="input-field" />
                  </label>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <input placeholder="Fund name" value={fundForm.name} onChange={(e) => setFundForm({ ...fundForm, name: e.target.value })} className="input-field md:col-span-2" />
          <input placeholder="Target" type="number" value={fundForm.targetAmount} onChange={(e) => setFundForm({ ...fundForm, targetAmount: e.target.value })} className="input-field" />
          <input placeholder="Current" type="number" value={fundForm.currentAmount} onChange={(e) => setFundForm({ ...fundForm, currentAmount: e.target.value })} className="input-field" />
          <input placeholder="Monthly" type="number" value={fundForm.monthlyContribution} onChange={(e) => setFundForm({ ...fundForm, monthlyContribution: e.target.value })} className="input-field" />
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={submitFund} className="btn-primary text-sm">Add sinking fund</button>
        </div>
      </SectionCard>
    </div>
  )
}
