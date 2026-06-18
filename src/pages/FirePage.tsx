import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, ProgressGauge, SectionCard, InputRow } from '../components/shared/MetricCard'
import { LineTrendChart } from '../components/charts/FinanceCharts'
import { useFinanceStore } from '../store/useFinanceStore'
import {
  buildCoastFiTimeline,
  calculateCoastFiResults,
  calculateFireResults,
  calculateWithdrawalResults,
  contributionImpact,
  estimateFireProbability,
} from '../engine/fire'
import { WITHDRAWAL_PRESETS } from '../types'
import { formatCurrency, formatPercent } from '../engine/format'

export function FirePage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const updateFireSettings = useFinanceStore((s) => s.updateFireSettings)
  const { fireSettings, profile } = scenario
  const [extraContrib, setExtraContrib] = useState(500)

  const fire = useMemo(() => calculateFireResults(scenario), [scenario])
  const coast = useMemo(() => calculateCoastFiResults(scenario), [scenario])
  const withdrawal = useMemo(() => calculateWithdrawalResults(scenario), [scenario])
  const probability = useMemo(() => estimateFireProbability(scenario, 300), [scenario])
  const impact = useMemo(() => contributionImpact(scenario, extraContrib), [scenario, extraContrib])
  const timeline = useMemo(() => buildCoastFiTimeline(scenario).filter((_, i) => i % 3 === 0), [scenario])

  return (
    <div>
      <PageHeader title="FIRE & CoastFI" subtitle="Financial independence, withdrawal planning, and coast calculations" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="FIRE Number" value={formatCurrency(fire.fireNumber, profile.currency)} />
        <MetricCard label="CoastFI Number" value={formatCurrency(coast.coastFiNumber, profile.currency)} />
        <MetricCard
          label="Years Until FI"
          value={fire.yearsUntilFi !== null ? String(fire.yearsUntilFi) : '—'}
          sub={fire.targetFireAge ? `Target age ${fire.targetFireAge}` : undefined}
        />
        <MetricCard label="Success Probability" value={formatPercent(probability, 0)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ProgressGauge label="FIRE Progress" percent={fire.progressPercent} color="#c9a962" />
        <ProgressGauge label="CoastFI Progress" percent={coast.progressPercent} color="#7d9b8a" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionCard title="FIRE Calculator">
          <div className="space-y-4">
            <InputRow label="Annual Spending Goal">
              <input
                type="number"
                value={fireSettings.annualSpending}
                onChange={(e) => updateFireSettings({ annualSpending: +e.target.value })}
                className="input-field tabular-nums"
              />
            </InputRow>
            <InputRow label="Withdrawal Rate">
              <div className="flex flex-wrap gap-2">
                {WITHDRAWAL_PRESETS.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => updateFireSettings({ withdrawalRate: rate })}
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      fireSettings.withdrawalRate === rate
                        ? 'bg-ledger-gold/20 text-ledger-gold'
                        : 'bg-ledger-elevated text-ledger-muted'
                    }`}
                  >
                    {(rate * 100).toFixed(1)}%
                  </button>
                ))}
                <input
                  type="number"
                  step="0.001"
                  value={fireSettings.withdrawalRate}
                  onChange={(e) => updateFireSettings({ withdrawalRate: +e.target.value })}
                  className="input-field w-24 tabular-nums"
                />
              </div>
            </InputRow>
            <div className="rounded-xl bg-ledger-bg/50 p-4 text-sm space-y-2">
              <div className="flex justify-between"><span>Gap remaining</span><span className="tabular-nums">{formatCurrency(fire.gapRemaining, profile.currency)}</span></div>
              <div className="flex justify-between"><span>Additional monthly savings</span><span className="tabular-nums">{formatCurrency(fire.additionalMonthlySavings, profile.currency)}</span></div>
              <div className="flex justify-between"><span>Safe withdrawal (today)</span><span className="tabular-nums">{formatCurrency(fire.safeWithdrawalEstimate, profile.currency)}</span></div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Retirement Withdrawal Calculator">
          <div className="space-y-4">
            <InputRow label="Desired Retirement Age">
              <input
                type="number"
                value={fireSettings.desiredRetirementAge}
                onChange={(e) => updateFireSettings({ desiredRetirementAge: +e.target.value })}
                className="input-field tabular-nums"
              />
            </InputRow>
            <div className="rounded-xl bg-ledger-bg/50 p-4 text-sm space-y-2">
              <div className="flex justify-between"><span>Required portfolio</span><span className="tabular-nums">{formatCurrency(withdrawal.requiredPortfolio, profile.currency)}</span></div>
              <div className="flex justify-between"><span>Safe withdrawal estimate</span><span className="tabular-nums">{formatCurrency(withdrawal.safeWithdrawal, profile.currency)}</span></div>
              <div className="flex justify-between"><span>Portfolio shortfall</span><span className="tabular-nums text-ledger-danger">{formatCurrency(withdrawal.shortfall, profile.currency)}</span></div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="CoastFI Calculator">
          <div className="rounded-xl bg-ledger-bg/50 p-4 text-sm space-y-2">
            <div className="flex justify-between"><span>CoastFI number</span><span className="tabular-nums">{formatCurrency(coast.coastFiNumber, profile.currency)}</span></div>
            <div className="flex justify-between"><span>Additional savings needed</span><span className="tabular-nums">{formatCurrency(coast.additionalSavingsNeeded, profile.currency)}</span></div>
            <div className="flex justify-between"><span>Required future return</span><span className="tabular-nums">{formatPercent(coast.requiredFutureReturn)}</span></div>
            <div className="flex justify-between"><span>CoastFI age</span><span>{coast.coastFiAge ?? '—'}</span></div>
          </div>
          <div className="mt-4">
            <LineTrendChart
              data={timeline}
              xKey="age"
              currency={profile.currency}
              lines={[
                { key: 'portfolio', color: '#c9a962', label: 'Portfolio' },
                { key: 'coastTarget', color: '#7d9b8a', label: 'CoastFI Target' },
                { key: 'fireTarget', color: '#6b8fbf', label: 'FIRE Target' },
              ]}
            />
          </div>
        </SectionCard>

        <SectionCard title="Contribution Impact">
          <InputRow label="Extra monthly savings">
            <input
              type="number"
              value={extraContrib}
              onChange={(e) => setExtraContrib(+e.target.value)}
              className="input-field tabular-nums"
            />
          </InputRow>
          <div className="mt-4 rounded-xl bg-ledger-bg/50 p-4 text-sm space-y-2">
            <div className="flex justify-between"><span>Years saved</span><span className="tabular-nums text-ledger-success">{impact.yearsSaved.toFixed(1)}</span></div>
            <div className="flex justify-between"><span>New years until FI</span><span>{impact.newYearsUntilFi ?? '—'}</span></div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
