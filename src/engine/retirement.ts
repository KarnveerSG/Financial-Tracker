import type { Account, FilingStatus } from '../types'
import { calculateFederalIncomeTax, calculateStateTax } from './tax'

/**
 * IRS Uniform Lifetime Table divisors (age → divisor). Used for RMDs on
 * traditional IRAs / 401(k)s starting at age 73 (SECURE 2.0).
 */
const UNIFORM_LIFETIME_DIVISORS: Record<number, number> = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
  80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2,
  87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1,
  94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4,
}

export function rmdDivisor(age: number): number {
  if (age < 73) return 0
  if (age > 100) return 6.4
  return UNIFORM_LIFETIME_DIVISORS[age] ?? 26.5
}

export interface RmdRow {
  age: number
  year: number
  balanceStart: number
  rmd: number
  balanceEnd: number
}

/** Projects RMDs for a traditional/401k balance from RMD age through life expectancy.
 *  Assumes real return net of inflation applied to residual balance. */
export function projectRmds(
  traditionalBalance: number,
  currentAge: number,
  lifeExpectancy: number,
  realReturnRate: number
): RmdRow[] {
  const rows: RmdRow[] = []
  const now = new Date().getFullYear()
  let balance = traditionalBalance
  for (let age = Math.max(currentAge, 73); age <= lifeExpectancy; age++) {
    const start = balance
    const div = rmdDivisor(age)
    const rmd = div > 0 ? balance / div : 0
    balance = Math.max(0, (balance - rmd) * (1 + realReturnRate))
    rows.push({ age, year: now + (age - currentAge), balanceStart: start, rmd, balanceEnd: balance })
  }
  return rows
}

// --- Roth conversion ladder ---

export interface RothLadderYear {
  year: number
  age: number
  conversionAmount: number
  taxOwed: number
  netAfterTax: number
  runningConverted: number
}

/** Compute a multi-year Roth conversion ladder. Each year, `conversionAmount`
 *  is moved from Traditional → Roth, taxed at ordinary income rates. */
export function projectRothLadder(
  yearlyConversion: number,
  years: number,
  currentAge: number,
  otherIncome: number,
  filingStatus: FilingStatus,
  stateFlatRate: number
): RothLadderYear[] {
  const rows: RothLadderYear[] = []
  const nowYear = new Date().getFullYear()
  let running = 0
  for (let i = 0; i < years; i++) {
    const income = otherIncome + yearlyConversion
    const fed = calculateFederalIncomeTax(income, filingStatus)
    const fedBase = calculateFederalIncomeTax(otherIncome, filingStatus)
    const stateTax = calculateStateTax(yearlyConversion, stateFlatRate)
    const tax = (fed - fedBase) + stateTax
    running += yearlyConversion
    rows.push({
      year: nowYear + i,
      age: currentAge + i,
      conversionAmount: yearlyConversion,
      taxOwed: tax,
      netAfterTax: yearlyConversion - tax,
      runningConverted: running,
    })
  }
  return rows
}

// --- Quarterly estimated taxes ---

export interface QuarterlyEstimate {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  dueDate: string
  paymentEstimate: number
  cumulativeIncome: number
}

/** Straight-line quarterly estimates: annual tax / 4, with standard IRS due dates. */
export function calculateQuarterlyEstimates(
  expectedAnnualIncome: number,
  filingStatus: FilingStatus,
  stateFlatRate: number,
  selfEmployedNetIncome = 0
): { estimates: QuarterlyEstimate[]; annualTax: number; effectiveRate: number } {
  const federal = calculateFederalIncomeTax(expectedAnnualIncome, filingStatus)
  const state = calculateStateTax(expectedAnnualIncome, stateFlatRate)
  // Self-employment tax = 15.3% on 92.35% of SE income (up to SS wage base, simplified)
  const seTax = selfEmployedNetIncome * 0.9235 * 0.153
  const annualTax = federal + state + seTax
  const perQuarter = annualTax / 4
  const year = new Date().getFullYear()
  const estimates: QuarterlyEstimate[] = [
    { quarter: 'Q1', dueDate: `${year}-04-15`, paymentEstimate: perQuarter, cumulativeIncome: expectedAnnualIncome * 0.25 },
    { quarter: 'Q2', dueDate: `${year}-06-15`, paymentEstimate: perQuarter, cumulativeIncome: expectedAnnualIncome * 0.5 },
    { quarter: 'Q3', dueDate: `${year}-09-15`, paymentEstimate: perQuarter, cumulativeIncome: expectedAnnualIncome * 0.75 },
    { quarter: 'Q4', dueDate: `${year + 1}-01-15`, paymentEstimate: perQuarter, cumulativeIncome: expectedAnnualIncome },
  ]
  return { estimates, annualTax, effectiveRate: expectedAnnualIncome > 0 ? annualTax / expectedAnnualIncome : 0 }
}

// --- Social Security claiming strategy ---

export interface SsClaimingScenario {
  claimAge: 62 | 67 | 70
  monthlyBenefit: number
  annualBenefit: number
  lifetimeBenefit: number
  vsAge67: number
}

/**
 * Compare claiming SS at 62 vs 67 (FRA) vs 70. Uses PIA (age-67 benefit) as
 * baseline. 62 → 70% of PIA; 70 → 124% of PIA (roughly, actual formula slightly
 * varies by birth year). Lifetime benefit projected to age 90.
 */
export function compareSsClaimingAges(fraMonthlyBenefit: number, lifeExpectancy = 90): SsClaimingScenario[] {
  const scenarios: SsClaimingScenario[] = [
    makeScenario(62, fraMonthlyBenefit * 0.70, lifeExpectancy),
    makeScenario(67, fraMonthlyBenefit, lifeExpectancy),
    makeScenario(70, fraMonthlyBenefit * 1.24, lifeExpectancy),
  ]
  const baseline = scenarios[1].lifetimeBenefit
  for (const s of scenarios) s.vsAge67 = s.lifetimeBenefit - baseline
  return scenarios
}

function makeScenario(claimAge: 62 | 67 | 70, monthly: number, lifeExpectancy: number): SsClaimingScenario {
  const years = Math.max(0, lifeExpectancy - claimAge)
  return {
    claimAge,
    monthlyBenefit: monthly,
    annualBenefit: monthly * 12,
    lifetimeBenefit: monthly * 12 * years,
    vsAge67: 0,
  }
}

// --- Healthcare pre-Medicare (age 65) ---

export interface HealthcareBridgeYear {
  age: number
  year: number
  annualCost: number
}

/** Estimate pre-Medicare healthcare cost bridge for early retirees.
 *  Uses a base cost that grows with medical inflation. */
export function projectPreMedicareCosts(
  retireAge: number,
  monthlyPremium: number,
  monthlyOutOfPocket: number,
  medicalInflation = 0.055
): { rows: HealthcareBridgeYear[]; totalCost: number } {
  const rows: HealthcareBridgeYear[] = []
  const now = new Date().getFullYear()
  let cost = (monthlyPremium + monthlyOutOfPocket) * 12
  for (let age = retireAge; age < 65; age++) {
    rows.push({ age, year: now + (age - retireAge), annualCost: cost })
    cost *= 1 + medicalInflation
  }
  return { rows, totalCost: rows.reduce((s, r) => s + r.annualCost, 0) }
}

// --- Withdrawal sequencing ---

export interface WithdrawalSlice {
  bucket: 'taxable' | 'traditional' | 'roth'
  amount: number
  taxOwed: number
  netReceived: number
}

/** Suggests conventional order: taxable first (basis + LTCG), then traditional
 *  (ordinary income), then Roth (tax-free). Given an annual spending target and
 *  bucket balances, returns the recommended slice from each source. */
export function suggestWithdrawalSequence(
  annualSpending: number,
  taxable: number,
  traditional: number,
  roth: number,
  filingStatus: FilingStatus,
  stateFlatRate: number
): { slices: WithdrawalSlice[]; totalTax: number; totalGross: number } {
  const slices: WithdrawalSlice[] = []
  let remaining = annualSpending
  let totalTax = 0

  // Slice 1: taxable — approximate 15% LTCG blended
  const t1 = Math.min(remaining, taxable)
  if (t1 > 0) {
    const tax = t1 * 0.15 * 0.5 // half assumed gains, 15% LTCG
    slices.push({ bucket: 'taxable', amount: t1, taxOwed: tax, netReceived: t1 - tax })
    totalTax += tax
    remaining -= (t1 - tax)
  }

  // Slice 2: traditional — ordinary income
  if (remaining > 0 && traditional > 0) {
    const t2 = Math.min(remaining / 0.8, traditional) // gross-up ~20% tax
    const fed = calculateFederalIncomeTax(t2, filingStatus)
    const st = calculateStateTax(t2, stateFlatRate)
    const tax = fed + st
    slices.push({ bucket: 'traditional', amount: t2, taxOwed: tax, netReceived: t2 - tax })
    totalTax += tax
    remaining -= (t2 - tax)
  }

  // Slice 3: roth — tax-free
  if (remaining > 0 && roth > 0) {
    const t3 = Math.min(remaining, roth)
    slices.push({ bucket: 'roth', amount: t3, taxOwed: 0, netReceived: t3 })
    remaining -= t3
  }

  const totalGross = slices.reduce((s, x) => s + x.amount, 0)
  return { slices, totalTax, totalGross }
}

// --- Helper: bucket balances from accounts ---

export function bucketBalances(accounts: Account[]): { traditional: number; roth: number; taxable: number } {
  let traditional = 0, roth = 0, taxable = 0
  for (const a of accounts) {
    if (a.isLiability) continue
    if (a.taxTreatment === 'pretax') traditional += a.balance
    else if (a.taxTreatment === 'roth') roth += a.balance
    else if (a.taxTreatment === 'taxable') taxable += a.balance
  }
  return { traditional, roth, taxable }
}
