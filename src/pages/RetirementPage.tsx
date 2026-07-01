import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, SectionCard } from '../components/shared/MetricCard'
import { useFinanceStore } from '../store/useFinanceStore'
import {
  bucketBalances,
  calculateQuarterlyEstimates,
  compareSsClaimingAges,
  projectPreMedicareCosts,
  projectRmds,
  projectRothLadder,
  suggestWithdrawalSequence,
} from '../engine/retirement'
import { formatCurrency, formatPercent } from '../engine/format'
import { US_STATES } from '../types'

type Tab = 'rmd' | 'roth' | 'quarterly' | 'ss' | 'healthcare' | 'sequence'

const TABS: { id: Tab; label: string }[] = [
  { id: 'rmd', label: 'RMDs' },
  { id: 'roth', label: 'Roth Ladder' },
  { id: 'quarterly', label: 'Quarterly Tax' },
  { id: 'ss', label: 'Social Security' },
  { id: 'healthcare', label: 'Healthcare Bridge' },
  { id: 'sequence', label: 'Withdrawal Sequence' },
]

export function RetirementPage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const { profile, accounts, assumptions, fireSettings, taxInputs } = scenario
  const currency = profile.currency
  const stateRate = US_STATES.find((st) => st.code === profile.state)?.flatRate ?? 0
  const [tab, setTab] = useState<Tab>('rmd')
  const buckets = useMemo(() => bucketBalances(accounts), [accounts])
  const realReturn = (assumptions.annualReturnRate - assumptions.inflationRate) / 100

  return (
    <div>
      <PageHeader title="Retirement Toolkit" subtitle="RMDs, Roth conversion ladder, quarterly taxes, SS claiming, healthcare bridge, and withdrawal sequencing" />

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-3 py-1.5 text-sm ${tab === t.id ? 'bg-ledger-gold/20 text-ledger-gold' : 'bg-ledger-elevated text-ledger-muted'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rmd' && <RmdSection traditionalBalance={buckets.traditional} currentAge={profile.currentAge} lifeExpectancy={profile.lifeExpectancy} realReturn={realReturn} currency={currency} />}
      {tab === 'roth' && <RothLadderSection currentAge={profile.currentAge} otherIncomeDefault={fireSettings.annualSpending} filingStatus={profile.filingStatus} stateRate={stateRate} currency={currency} />}
      {tab === 'quarterly' && <QuarterlySection filingStatus={profile.filingStatus} stateRate={stateRate} salary={profile.annualSalary} seNetIncome={scenario.paycheckInputs.selfEmployedNetIncome} currency={currency} />}
      {tab === 'ss' && <SocialSecuritySection fraDefault={taxInputs.socialSecurityBenefit / 12} lifeExpectancy={profile.lifeExpectancy} currency={currency} />}
      {tab === 'healthcare' && <HealthcareSection retireAgeDefault={fireSettings.desiredRetirementAge} currency={currency} />}
      {tab === 'sequence' && <SequenceSection annualSpending={fireSettings.annualSpending} buckets={buckets} filingStatus={profile.filingStatus} stateRate={stateRate} currency={currency} />}
    </div>
  )
}

function RmdSection({ traditionalBalance, currentAge, lifeExpectancy, realReturn, currency }: any) {
  const [balance, setBalance] = useState(traditionalBalance)
  const rows = useMemo(() => projectRmds(balance, currentAge, lifeExpectancy, realReturn), [balance, currentAge, lifeExpectancy, realReturn])
  const totalRmd = rows.reduce((s, r) => s + r.rmd, 0)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Traditional balance" value={formatCurrency(balance, currency)} />
        <MetricCard label="First RMD (age 73)" value={rows.length > 0 ? formatCurrency(rows[0].rmd, currency) : '—'} />
        <MetricCard label="Total lifetime RMDs" value={formatCurrency(totalRmd, currency)} sub="Real dollars" />
      </div>
      <SectionCard title="Assumptions">
        <label className="text-sm block max-w-xs">
          <span className="label">Traditional balance today</span>
          <input type="number" value={balance} onChange={(e) => setBalance(+e.target.value)} className="input-field" />
        </label>
        <p className="mt-2 text-xs text-ledger-muted">
          RMD age 73 (SECURE 2.0). Divisors use the IRS Uniform Lifetime Table. Residual balance grows at real return {formatPercent(realReturn * 100)}.
        </p>
      </SectionCard>
      <SectionCard title="Projected RMDs">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-ledger-muted"><th className="pb-2">Age</th><th className="pb-2">Year</th><th className="pb-2 text-right">Balance start</th><th className="pb-2 text-right">RMD</th><th className="pb-2 text-right">Balance end</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.age} className="border-t border-ledger-border">
                <td className="py-1 tabular-nums">{r.age}</td>
                <td className="py-1 tabular-nums text-ledger-muted">{r.year}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrency(r.balanceStart, currency)}</td>
                <td className="py-1 text-right tabular-nums text-ledger-gold">{formatCurrency(r.rmd, currency)}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrency(r.balanceEnd, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  )
}

function RothLadderSection({ currentAge, otherIncomeDefault, filingStatus, stateRate, currency }: any) {
  const [conversion, setConversion] = useState(25000)
  const [years, setYears] = useState(5)
  const [otherIncome, setOtherIncome] = useState(otherIncomeDefault)
  const rows = useMemo(() => projectRothLadder(conversion, years, currentAge, otherIncome, filingStatus, stateRate), [conversion, years, currentAge, otherIncome, filingStatus, stateRate])
  const totalTax = rows.reduce((s, r) => s + r.taxOwed, 0)
  const totalConverted = rows.reduce((s, r) => s + r.conversionAmount, 0)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total converted" value={formatCurrency(totalConverted, currency)} />
        <MetricCard label="Total tax owed" value={formatCurrency(totalTax, currency)} trend="down" />
        <MetricCard label="Effective rate" value={totalConverted > 0 ? formatPercent((totalTax / totalConverted) * 100) : '—'} />
      </div>
      <SectionCard title="Plan">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm"><span className="label">Annual conversion</span><input type="number" value={conversion} onChange={(e) => setConversion(+e.target.value)} className="input-field" /></label>
          <label className="text-sm"><span className="label">Years</span><input type="number" value={years} onChange={(e) => setYears(+e.target.value)} className="input-field" /></label>
          <label className="text-sm"><span className="label">Other taxable income</span><input type="number" value={otherIncome} onChange={(e) => setOtherIncome(+e.target.value)} className="input-field" /></label>
        </div>
        <p className="mt-2 text-xs text-ledger-muted">Converts Traditional → Roth in the low-income window between early retirement and age-72 RMDs. Each conversion is taxed as ordinary income; converted Roth principal is available penalty-free after 5 years.</p>
      </SectionCard>
      <SectionCard title="Yearly ladder">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-ledger-muted"><th className="pb-2">Year</th><th className="pb-2">Age</th><th className="pb-2 text-right">Convert</th><th className="pb-2 text-right">Tax</th><th className="pb-2 text-right">Net to Roth</th><th className="pb-2 text-right">Running</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year} className="border-t border-ledger-border">
                <td className="py-1 tabular-nums">{r.year}</td>
                <td className="py-1 tabular-nums">{r.age}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrency(r.conversionAmount, currency)}</td>
                <td className="py-1 text-right tabular-nums text-ledger-danger">{formatCurrency(r.taxOwed, currency)}</td>
                <td className="py-1 text-right tabular-nums text-ledger-success">{formatCurrency(r.netAfterTax, currency)}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrency(r.runningConverted, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  )
}

function QuarterlySection({ filingStatus, stateRate, salary, seNetIncome, currency }: any) {
  const [income, setIncome] = useState(salary)
  const [seIncome, setSeIncome] = useState(seNetIncome)
  const result = useMemo(() => calculateQuarterlyEstimates(income, filingStatus, stateRate, seIncome), [income, filingStatus, stateRate, seIncome])
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Annual tax estimate" value={formatCurrency(result.annualTax, currency)} />
        <MetricCard label="Per-quarter payment" value={formatCurrency(result.annualTax / 4, currency)} />
        <MetricCard label="Effective rate" value={formatPercent(result.effectiveRate * 100)} />
      </div>
      <SectionCard title="Inputs">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm"><span className="label">Expected annual income</span><input type="number" value={income} onChange={(e) => setIncome(+e.target.value)} className="input-field" /></label>
          <label className="text-sm"><span className="label">Self-employed net income</span><input type="number" value={seIncome} onChange={(e) => setSeIncome(+e.target.value)} className="input-field" /></label>
        </div>
        <p className="mt-2 text-xs text-ledger-muted">Straight-line quarterly split. Self-employment tax = 15.3% on 92.35% of SE net income (simplified, ignores SS wage-base cap).</p>
      </SectionCard>
      <SectionCard title="Quarterly schedule">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-ledger-muted"><th className="pb-2">Quarter</th><th className="pb-2">Due</th><th className="pb-2 text-right">Payment</th></tr></thead>
          <tbody>
            {result.estimates.map((q) => (
              <tr key={q.quarter} className="border-t border-ledger-border">
                <td className="py-1.5">{q.quarter}</td>
                <td className="py-1.5 tabular-nums text-ledger-muted">{q.dueDate}</td>
                <td className="py-1.5 text-right tabular-nums">{formatCurrency(q.paymentEstimate, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  )
}

function SocialSecuritySection({ fraDefault, lifeExpectancy, currency }: any) {
  const [fraMonthly, setFraMonthly] = useState(Math.round(fraDefault || 2000))
  const [horizon, setHorizon] = useState(lifeExpectancy)
  const scenarios = useMemo(() => compareSsClaimingAges(fraMonthly, horizon), [fraMonthly, horizon])
  const best = [...scenarios].sort((a, b) => b.lifetimeBenefit - a.lifetimeBenefit)[0]
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="FRA (age 67) monthly" value={formatCurrency(fraMonthly, currency)} />
        <MetricCard label="Best claim age" value={String(best.claimAge)} sub={`Lifetime: ${formatCurrency(best.lifetimeBenefit, currency)}`} trend="up" />
        <MetricCard label="Horizon" value={`age ${horizon}`} />
      </div>
      <SectionCard title="Inputs">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm"><span className="label">FRA monthly benefit (from SSA statement)</span><input type="number" value={fraMonthly} onChange={(e) => setFraMonthly(+e.target.value)} className="input-field" /></label>
          <label className="text-sm"><span className="label">Life expectancy</span><input type="number" value={horizon} onChange={(e) => setHorizon(+e.target.value)} className="input-field" /></label>
        </div>
      </SectionCard>
      <SectionCard title="Compare claim ages">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-ledger-muted"><th className="pb-2">Claim age</th><th className="pb-2 text-right">Monthly</th><th className="pb-2 text-right">Annual</th><th className="pb-2 text-right">Lifetime (to {horizon})</th><th className="pb-2 text-right">Δ vs 67</th></tr></thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.claimAge} className="border-t border-ledger-border">
                <td className="py-1.5">{s.claimAge}{s.claimAge === 67 && ' (FRA)'}</td>
                <td className="py-1.5 text-right tabular-nums">{formatCurrency(s.monthlyBenefit, currency)}</td>
                <td className="py-1.5 text-right tabular-nums">{formatCurrency(s.annualBenefit, currency)}</td>
                <td className="py-1.5 text-right tabular-nums">{formatCurrency(s.lifetimeBenefit, currency)}</td>
                <td className={`py-1.5 text-right tabular-nums ${s.vsAge67 > 0 ? 'text-ledger-success' : s.vsAge67 < 0 ? 'text-ledger-danger' : 'text-ledger-muted'}`}>
                  {s.vsAge67 === 0 ? '—' : `${s.vsAge67 > 0 ? '+' : ''}${formatCurrency(s.vsAge67, currency)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-ledger-muted">Simplified 62=70%, 67=100%, 70=124% of PIA. Actual formulas vary by birth year and factor in spousal / survivor benefits.</p>
      </SectionCard>
    </>
  )
}

function HealthcareSection({ retireAgeDefault, currency }: any) {
  const [retireAge, setRetireAge] = useState(retireAgeDefault)
  const [premium, setPremium] = useState(650)
  const [oop, setOop] = useState(200)
  const [inflation, setInflation] = useState(5.5)
  const projection = useMemo(() => projectPreMedicareCosts(retireAge, premium, oop, inflation / 100), [retireAge, premium, oop, inflation])
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Years to Medicare" value={String(Math.max(0, 65 - retireAge))} />
        <MetricCard label="First-year cost" value={projection.rows[0] ? formatCurrency(projection.rows[0].annualCost, currency) : '—'} />
        <MetricCard label="Total bridge cost" value={formatCurrency(projection.totalCost, currency)} sub={`Retire at ${retireAge} → 65`} trend="down" />
      </div>
      <SectionCard title="Inputs">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm"><span className="label">Retire age</span><input type="number" value={retireAge} onChange={(e) => setRetireAge(+e.target.value)} className="input-field" /></label>
          <label className="text-sm"><span className="label">Monthly premium</span><input type="number" value={premium} onChange={(e) => setPremium(+e.target.value)} className="input-field" /></label>
          <label className="text-sm"><span className="label">Monthly out-of-pocket</span><input type="number" value={oop} onChange={(e) => setOop(+e.target.value)} className="input-field" /></label>
          <label className="text-sm"><span className="label">Medical inflation %</span><input type="number" value={inflation} onChange={(e) => setInflation(+e.target.value)} className="input-field" /></label>
        </div>
        <p className="mt-2 text-xs text-ledger-muted">Bridges from early retirement to Medicare eligibility at 65. Real ACA silver-plan premiums for a 55-year-old can run $600–$1,000+/mo depending on state and income (subsidies not modeled).</p>
      </SectionCard>
      <SectionCard title="Year-by-year cost">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-ledger-muted"><th className="pb-2">Age</th><th className="pb-2">Year</th><th className="pb-2 text-right">Annual cost</th></tr></thead>
          <tbody>
            {projection.rows.map((r) => (
              <tr key={r.age} className="border-t border-ledger-border">
                <td className="py-1 tabular-nums">{r.age}</td>
                <td className="py-1 tabular-nums text-ledger-muted">{r.year}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrency(r.annualCost, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  )
}

function SequenceSection({ annualSpending, buckets, filingStatus, stateRate, currency }: any) {
  const [spend, setSpend] = useState(annualSpending)
  const result = useMemo(
    () => suggestWithdrawalSequence(spend, buckets.taxable, buckets.traditional, buckets.roth, filingStatus, stateRate),
    [spend, buckets, filingStatus, stateRate]
  )
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Target spending" value={formatCurrency(spend, currency)} />
        <MetricCard label="Total gross withdrawal" value={formatCurrency(result.totalGross, currency)} />
        <MetricCard label="Total tax" value={formatCurrency(result.totalTax, currency)} trend="down" />
        <MetricCard label="Effective rate" value={result.totalGross > 0 ? formatPercent((result.totalTax / result.totalGross) * 100) : '—'} />
      </div>
      <SectionCard title="Bucket balances">
        <div className="grid gap-4 sm:grid-cols-3 text-sm">
          <div><p className="text-ledger-muted">Taxable</p><p className="font-serif text-xl tabular-nums">{formatCurrency(buckets.taxable, currency)}</p></div>
          <div><p className="text-ledger-muted">Traditional</p><p className="font-serif text-xl tabular-nums">{formatCurrency(buckets.traditional, currency)}</p></div>
          <div><p className="text-ledger-muted">Roth</p><p className="font-serif text-xl tabular-nums">{formatCurrency(buckets.roth, currency)}</p></div>
        </div>
        <label className="mt-4 block max-w-xs text-sm">
          <span className="label">Annual spending target</span>
          <input type="number" value={spend} onChange={(e) => setSpend(+e.target.value)} className="input-field" />
        </label>
      </SectionCard>
      <SectionCard title="Suggested withdrawal order">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-ledger-muted"><th className="pb-2">Bucket</th><th className="pb-2 text-right">Gross</th><th className="pb-2 text-right">Tax</th><th className="pb-2 text-right">Net</th></tr></thead>
          <tbody>
            {result.slices.map((s) => (
              <tr key={s.bucket} className="border-t border-ledger-border">
                <td className="py-1.5 uppercase">{s.bucket}</td>
                <td className="py-1.5 text-right tabular-nums">{formatCurrency(s.amount, currency)}</td>
                <td className="py-1.5 text-right tabular-nums text-ledger-danger">{formatCurrency(s.taxOwed, currency)}</td>
                <td className="py-1.5 text-right tabular-nums text-ledger-success">{formatCurrency(s.netReceived, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-ledger-muted">
          Convention: taxable → traditional → Roth. Preserves Roth's tax-free growth longest and takes advantage of standard deduction against ordinary-income traditional withdrawals. Actual sequencing should also weigh RMDs, Roth conversion opportunities, and Medicare IRMAA thresholds.
        </p>
      </SectionCard>
    </>
  )
}
