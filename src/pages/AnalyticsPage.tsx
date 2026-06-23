import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, SectionCard, InputRow } from '../components/shared/MetricCard'
import { LineTrendChart } from '../components/charts/FinanceCharts'
import { useFinanceStore } from '../store/useFinanceStore'
import {
  runStressTest,
  sequenceOfReturnsRisk,
  investmentFeeImpact,
} from '../engine/analytics'
import {
  analyzeRothVsTraditional,
  estimateRMD,
  rothConversionAnalysis,
} from '../engine/tax'
import { computeDashboardMetrics } from '../engine/accounts'
import { calculateFireResults, calculateCoastFiResults } from '../engine/fire'
import { formatCurrency, formatPercent } from '../engine/format'

export function AnalyticsPage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const updateStressInputs = useFinanceStore((s) => s.updateStressInputs)
  const { stressInputs, profile, accounts, assumptions } = scenario

  const fire = useMemo(() => calculateFireResults(scenario), [scenario])
  const coast = useMemo(() => calculateCoastFiResults(scenario), [scenario])
  const metrics = useMemo(() => computeDashboardMetrics(scenario, fire.fireNumber, coast.coastFiNumber), [scenario, fire, coast])
  const stress = useMemo(() => runStressTest(scenario), [scenario])

  const [feePercent, setFeePercent] = useState(0.5)
  const [feeYears, setFeeYears] = useState(30)
  const balance = accounts.filter((a) => !a.isLiability).reduce((s, a) => s + a.balance, 0)
  const annualContrib = accounts.filter((a) => !a.isLiability).reduce((s, a) => s + a.monthlyContribution * 12, 0)

  const feeImpact = useMemo(
    () => investmentFeeImpact(balance, annualContrib, feeYears, assumptions.annualReturnRate, feePercent),
    [balance, annualContrib, feeYears, assumptions.annualReturnRate, feePercent]
  )

  const rothVsTrad = useMemo(
    () => analyzeRothVsTraditional(6000, 25, 22, 18, assumptions.annualReturnRate),
    [assumptions.annualReturnRate]
  )

  // Pretax only; Roth IRAs and Roth 401(k)s excluded (SECURE 2.0 dropped Roth 401(k) RMDs from 2024).
  const tradBalance = accounts.filter((a) => a.taxTreatment === 'pretax').reduce((s, a) => s + a.balance, 0)
  const rmd = estimateRMD(tradBalance, Math.max(73, profile.retirementAge))

  const seqRisk = useMemo(
    () =>
      sequenceOfReturnsRisk(
        fire.fireNumber,
        scenario.fireSettings.annualSpending,
        25,
        assumptions.annualReturnRate,
        true
      ),
    [fire.fireNumber, scenario.fireSettings, assumptions.annualReturnRate]
  )

  const rothConv = rothConversionAnalysis(50000, 22, 20, assumptions.annualReturnRate, 18)

  return (
    <div>
      <PageHeader title="Advanced Analytics" subtitle="Stress testing, fee impact, Roth analysis, and sequence-of-returns risk" />
      <p className="-mt-4 mb-6 text-sm">
        <Link to="/analytics/compare" className="text-ledger-gold hover:underline">
          Compare all scenarios side-by-side →
        </Link>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Savings Rate" value={formatPercent(metrics.savingsRate)} />
        <MetricCard label="Baseline FIRE Years" value={String(stress.baseline.fireYears ?? '—')} />
        <MetricCard label="Stressed FIRE Years" value={String(stress.stressed.fireYears ?? '—')} />
        <MetricCard label="Success Rate Δ" value={`${stress.successRateChange >= 0 ? '+' : ''}${stress.successRateChange.toFixed(1)}%`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Financial Independence Stress Testing">
          <div className="grid gap-4 sm:grid-cols-2">
            <InputRow label="Market Crash (%)">
              <input type="number" value={stressInputs.marketCrashPercent} onChange={(e) => updateStressInputs({ marketCrashPercent: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="Return Reduction (%)">
              <input type="number" value={stressInputs.returnReduction} onChange={(e) => updateStressInputs({ returnReduction: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="Inflation Increase (%)">
              <input type="number" value={stressInputs.inflationIncrease} onChange={(e) => updateStressInputs({ inflationIncrease: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="Early Retirement (years)">
              <input type="number" value={stressInputs.earlyRetirementYears} onChange={(e) => updateStressInputs({ earlyRetirementYears: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="Spending Increase (%)">
              <input type="number" value={stressInputs.spendingIncreasePercent} onChange={(e) => updateStressInputs({ spendingIncreasePercent: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="Savings Reduction (%)">
              <input type="number" value={stressInputs.savingsReductionPercent} onChange={(e) => updateStressInputs({ savingsReductionPercent: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
          </div>
          <div className="mt-4 rounded-xl bg-ledger-bg/50 p-4 text-sm space-y-2">
            <div className="flex justify-between"><span>FIRE date shift</span><span className="tabular-nums">{stress.fireDateShift >= 0 ? '+' : ''}{stress.fireDateShift} years</span></div>
            <div className="flex justify-between"><span>CoastFI date shift</span><span className="tabular-nums">{stress.coastDateShift >= 0 ? '+' : ''}{stress.coastDateShift} years</span></div>
            <div className="flex justify-between"><span>Baseline success</span><span>{formatPercent(stress.baseline.successRate, 0)}</span></div>
            <div className="flex justify-between"><span>Stressed success</span><span>{formatPercent(stress.stressed.successRate, 0)}</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Sequence of Returns Risk">
          <p className="mb-4 text-sm text-ledger-muted">Portfolio balance with bad returns in first 3 years of retirement</p>
          <LineTrendChart
            data={seqRisk}
            xKey="age"
            currency={profile.currency}
            lines={[{ key: 'balance', color: '#c96b6b', label: 'Portfolio' }]}
          />
        </SectionCard>

        <SectionCard title="Investment Fee Impact">
          <div className="grid gap-4 sm:grid-cols-2">
            <InputRow label="Fee (%)">
              <input type="number" step="0.1" value={feePercent} onChange={(e) => setFeePercent(+e.target.value)} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="Years">
              <input type="number" value={feeYears} onChange={(e) => setFeeYears(+e.target.value)} className="input-field tabular-nums" />
            </InputRow>
          </div>
          <div className="mt-4 rounded-xl bg-ledger-bg/50 p-4 text-sm space-y-2">
            <div className="flex justify-between"><span>Without fees</span><span className="tabular-nums">{formatCurrency(feeImpact.withoutFees, profile.currency)}</span></div>
            <div className="flex justify-between"><span>With fees</span><span className="tabular-nums">{formatCurrency(feeImpact.withFees, profile.currency)}</span></div>
            <div className="flex justify-between text-ledger-danger"><span>Lost to fees</span><span className="tabular-nums">{formatCurrency(feeImpact.lostToFees, profile.currency)}</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Roth vs Traditional Analyzer">
          <div className="rounded-xl bg-ledger-bg/50 p-4 text-sm space-y-2">
            <div className="flex justify-between"><span>Roth (after-tax)</span><span className="tabular-nums">{formatCurrency(rothVsTrad.rothFuture, profile.currency)}</span></div>
            <div className="flex justify-between"><span>Traditional (after-tax)</span><span className="tabular-nums">{formatCurrency(rothVsTrad.traditionalAfterTax, profile.currency)}</span></div>
            <div className="flex justify-between font-medium"><span>Winner</span><span className="capitalize text-ledger-gold">{rothVsTrad.winner}</span></div>
          </div>
        </SectionCard>

        <SectionCard title="RMD Estimator">
          <div className="rounded-xl bg-ledger-bg/50 p-4 text-sm space-y-2">
            <div className="flex justify-between"><span>Traditional balance</span><span className="tabular-nums">{formatCurrency(tradBalance, profile.currency)}</span></div>
            <div className="flex justify-between"><span>Est. RMD (age {Math.max(73, profile.retirementAge)})</span><span className="tabular-nums">{formatCurrency(rmd, profile.currency)}</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Roth Conversion Planner">
          <div className="rounded-xl bg-ledger-bg/50 p-4 text-sm space-y-2">
            <div className="flex justify-between"><span>Tax on $50k conversion</span><span className="tabular-nums">{formatCurrency(rothConv.taxNow, profile.currency)}</span></div>
            <div className="flex justify-between"><span>Future Roth value (20yr)</span><span className="tabular-nums">{formatCurrency(rothConv.rothFutureValue, profile.currency)}</span></div>
            <div className="flex justify-between"><span>Est. breakeven</span><span>{rothConv.breakevenYears.toFixed(0)} years</span></div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
