import { useMemo } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, SectionCard, InputRow } from '../components/shared/MetricCard'
import { TaxBracketChart, SankeyFlow, WaterfallChart } from '../components/charts/FinanceCharts'
import { useFinanceStore } from '../store/useFinanceStore'
import { US_STATES } from '../types'
import {
  getFederalBracketChartData,
  simulateRetirementTax,
  estimateSocialSecurityBenefit,
} from '../engine/tax'
import { formatCurrency, formatPercent } from '../engine/format'

export function TaxPage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const updateTaxInputs = useFinanceStore((s) => s.updateTaxInputs)
  const updateProfile = useFinanceStore((s) => s.updateProfile)
  const { taxInputs, profile } = scenario

  const stateRate = US_STATES.find((s) => s.code === profile.state)?.flatRate ?? 0

  const taxResult = useMemo(
    () =>
      simulateRetirementTax({
        ...taxInputs,
        filingStatus: profile.filingStatus,
        stateFlatRate: stateRate,
      }),
    [taxInputs, profile.filingStatus, stateRate]
  )

  const bracketData = useMemo(() => {
    const income = taxInputs.traditionalWithdrawal + taxInputs.qualifiedDividends
    return getFederalBracketChartData(income, profile.filingStatus)
  }, [taxInputs, profile.filingStatus])

  const ssEstimate = useMemo(
    () => estimateSocialSecurityBenefit(profile.annualSalary, profile.retirementAge),
    [profile]
  )

  const waterfallData = [
    { name: 'Traditional', value: taxInputs.traditionalWithdrawal },
    { name: 'Roth', value: taxInputs.rothWithdrawal },
    { name: 'Brokerage', value: taxInputs.brokerageWithdrawal },
    { name: 'Social Security', value: taxInputs.socialSecurityBenefit },
    { name: 'Net Spendable', value: taxResult.netSpendable },
  ]

  return (
    <div>
      <PageHeader title="Tax Planning" subtitle="Retirement withdrawal tax simulator with bracket visualization" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Federal Tax" value={formatCurrency(taxResult.federalIncomeTax, profile.currency)} />
        <MetricCard label="State Tax" value={formatCurrency(taxResult.stateTax, profile.currency)} />
        <MetricCard label="Effective Rate" value={formatPercent(taxResult.effectiveRate)} />
        <MetricCard label="Marginal Rate" value={formatPercent(taxResult.marginalRate)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Withdrawal Simulator">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <InputRow label="Filing Status">
              <select
                value={profile.filingStatus}
                onChange={(e) => updateProfile({ filingStatus: e.target.value as typeof profile.filingStatus })}
                className="input-field"
              >
                <option value="single">Single</option>
                <option value="married_joint">Married Filing Jointly</option>
                <option value="married_separate">Married Filing Separately</option>
                <option value="head_of_household">Head of Household</option>
              </select>
            </InputRow>
            <InputRow label="State">
              <select
                value={profile.state}
                onChange={(e) => updateProfile({ state: e.target.value })}
                className="input-field"
              >
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </InputRow>
            <InputRow label="Traditional Withdrawal">
              <input type="number" value={taxInputs.traditionalWithdrawal} onChange={(e) => updateTaxInputs({ traditionalWithdrawal: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="Roth Withdrawal">
              <input type="number" value={taxInputs.rothWithdrawal} onChange={(e) => updateTaxInputs({ rothWithdrawal: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="Brokerage Withdrawal">
              <input type="number" value={taxInputs.brokerageWithdrawal} onChange={(e) => updateTaxInputs({ brokerageWithdrawal: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="Long-Term Capital Gains">
              <input type="number" value={taxInputs.longTermGains} onChange={(e) => updateTaxInputs({ longTermGains: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="Qualified Dividends">
              <input type="number" value={taxInputs.qualifiedDividends} onChange={(e) => updateTaxInputs({ qualifiedDividends: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
            <InputRow label="Social Security Benefit">
              <input type="number" value={taxInputs.socialSecurityBenefit} onChange={(e) => updateTaxInputs({ socialSecurityBenefit: +e.target.value })} className="input-field tabular-nums" />
            </InputRow>
          </div>
          <p className="text-xs text-ledger-muted">
            Estimated SS at retirement: {formatCurrency(ssEstimate, profile.currency)}/yr
          </p>
          <div className="mt-4 rounded-xl bg-ledger-bg/50 p-4 text-sm">
            <div className="flex justify-between font-medium">
              <span>Net Spendable Income</span>
              <span className="tabular-nums text-ledger-success">{formatCurrency(taxResult.netSpendable, profile.currency)}</span>
            </div>
            <div className="mt-2 flex justify-between text-ledger-muted">
              <span>LTCG Tax</span>
              <span className="tabular-nums">{formatCurrency(taxResult.ltcgTax, profile.currency)}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Tax Flow">
          <SankeyFlow
            gross={
              taxInputs.traditionalWithdrawal +
              taxInputs.rothWithdrawal +
              taxInputs.brokerageWithdrawal +
              taxInputs.socialSecurityBenefit
            }
            taxes={taxResult.totalTax}
            net={taxResult.netSpendable}
            currency={profile.currency}
          />
        </SectionCard>

        <SectionCard title="Federal Tax Brackets">
          <TaxBracketChart data={bracketData} currency={profile.currency} />
        </SectionCard>

        <SectionCard title="Retirement Income Waterfall">
          <WaterfallChart data={waterfallData} currency={profile.currency} />
        </SectionCard>
      </div>
    </div>
  )
}
