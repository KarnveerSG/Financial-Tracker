import type { FilingStatus } from '../types'

export interface TaxBracket {
  upTo: number
  rate: number
}

const FEDERAL_BRACKETS_2024: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { upTo: 11600, rate: 0.1 },
    { upTo: 47150, rate: 0.12 },
    { upTo: 100525, rate: 0.22 },
    { upTo: 191950, rate: 0.24 },
    { upTo: 243725, rate: 0.32 },
    { upTo: 609350, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  married_joint: [
    { upTo: 23200, rate: 0.1 },
    { upTo: 94300, rate: 0.12 },
    { upTo: 201050, rate: 0.22 },
    { upTo: 383900, rate: 0.24 },
    { upTo: 487450, rate: 0.32 },
    { upTo: 731200, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  married_separate: [
    { upTo: 11600, rate: 0.1 },
    { upTo: 47150, rate: 0.12 },
    { upTo: 100525, rate: 0.22 },
    { upTo: 191950, rate: 0.24 },
    { upTo: 243725, rate: 0.32 },
    { upTo: 365600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  head_of_household: [
    { upTo: 16550, rate: 0.1 },
    { upTo: 63100, rate: 0.12 },
    { upTo: 100500, rate: 0.22 },
    { upTo: 191950, rate: 0.24 },
    { upTo: 243700, rate: 0.32 },
    { upTo: 609350, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
}

const LTCG_BRACKETS_2024: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { upTo: 47025, rate: 0 },
    { upTo: 518900, rate: 0.15 },
    { upTo: Infinity, rate: 0.2 },
  ],
  married_joint: [
    { upTo: 94050, rate: 0 },
    { upTo: 583750, rate: 0.15 },
    { upTo: Infinity, rate: 0.2 },
  ],
  married_separate: [
    { upTo: 47025, rate: 0 },
    { upTo: 291850, rate: 0.15 },
    { upTo: Infinity, rate: 0.2 },
  ],
  head_of_household: [
    { upTo: 63000, rate: 0 },
    { upTo: 551350, rate: 0.15 },
    { upTo: Infinity, rate: 0.2 },
  ],
}

export interface TaxBreakdown {
  federalIncomeTax: number
  stateTax: number
  ltcgTax: number
  socialSecurityTax: number
  medicareTax: number
  totalTax: number
  effectiveRate: number
  marginalRate: number
  netSpendable: number
  bracketDetails: { bracket: string; amount: number; tax: number }[]
}

function computeBracketTax(income: number, brackets: TaxBracket[]): {
  tax: number
  marginalRate: number
  details: { bracket: string; amount: number; tax: number }[]
} {
  let remaining = income
  let tax = 0
  let prev = 0
  let marginalRate = 0
  const details: { bracket: string; amount: number; tax: number }[] = []

  for (const b of brackets) {
    const width = b.upTo === Infinity ? remaining : b.upTo - prev
    const taxable = Math.min(remaining, width)
    if (taxable <= 0) break
    const bracketTax = taxable * b.rate
    tax += bracketTax
    marginalRate = b.rate
    details.push({
      bracket: `${(b.rate * 100).toFixed(0)}%`,
      amount: taxable,
      tax: bracketTax,
    })
    remaining -= taxable
    prev = b.upTo
    if (remaining <= 0) break
  }

  return { tax, marginalRate, details: details.filter((d) => d.amount > 0) }
}

export function calculateFederalIncomeTax(income: number, status: FilingStatus): number {
  return computeBracketTax(income, FEDERAL_BRACKETS_2024[status]).tax
}

export function calculateLtcgTax(gains: number, status: FilingStatus): number {
  return computeBracketTax(gains, LTCG_BRACKETS_2024[status]).tax
}

export function calculateSocialSecurityTax(wages: number): number {
  return Math.min(wages, 168600) * 0.062
}

const ADDITIONAL_MEDICARE_THRESHOLD: Record<FilingStatus, number> = {
  single: 200000,
  married_joint: 250000,
  married_separate: 125000,
  head_of_household: 200000,
}

export function calculateMedicareTax(wages: number, status: FilingStatus): number {
  const base = wages * 0.0145
  const threshold = ADDITIONAL_MEDICARE_THRESHOLD[status]
  const additional = wages > threshold ? (wages - threshold) * 0.009 : 0
  return base + additional
}

export function calculateStateTax(taxableIncome: number, flatRate: number): number {
  return Math.max(0, taxableIncome * flatRate)
}

export interface RetirementTaxInputs {
  traditionalWithdrawal: number
  rothWithdrawal: number
  brokerageWithdrawal: number
  longTermGains: number
  qualifiedDividends: number
  socialSecurityBenefit: number
  filingStatus: FilingStatus
  stateFlatRate: number
}

export function simulateRetirementTax(inputs: RetirementTaxInputs): TaxBreakdown {
  const taxableIncome =
    inputs.traditionalWithdrawal +
    inputs.brokerageWithdrawal * 0.5 +
    inputs.socialSecurityBenefit * 0.85

  const ordinaryIncome = inputs.traditionalWithdrawal + inputs.qualifiedDividends
  const federalOrdinary = computeBracketTax(ordinaryIncome, FEDERAL_BRACKETS_2024[inputs.filingStatus])
  const ltcgTax = calculateLtcgTax(inputs.longTermGains, inputs.filingStatus)
  const stateTax = calculateStateTax(taxableIncome, inputs.stateFlatRate)

  const grossWithdrawals =
    inputs.traditionalWithdrawal +
    inputs.rothWithdrawal +
    inputs.brokerageWithdrawal +
    inputs.socialSecurityBenefit

  const totalTax = federalOrdinary.tax + ltcgTax + stateTax
  const netSpendable = grossWithdrawals - totalTax
  const effectiveRate = grossWithdrawals > 0 ? (totalTax / grossWithdrawals) * 100 : 0

  return {
    federalIncomeTax: federalOrdinary.tax,
    stateTax,
    ltcgTax,
    socialSecurityTax: 0,
    medicareTax: 0,
    totalTax,
    effectiveRate,
    marginalRate: federalOrdinary.marginalRate * 100,
    netSpendable,
    bracketDetails: federalOrdinary.details,
  }
}

export function getFederalBracketChartData(income: number, status: FilingStatus) {
  return computeBracketTax(income, FEDERAL_BRACKETS_2024[status]).details
}

/** 2024 SSA bend points (monthly AIME). */
const SSA_BEND_1 = 1174
const SSA_BEND_2 = 7078
const SSA_MAX_TAXABLE_EARNINGS = 168600

function computePiaFromAime(aime: number): number {
  return (
    Math.min(aime, SSA_BEND_1) * 0.9 +
    Math.max(0, Math.min(aime, SSA_BEND_2) - SSA_BEND_1) * 0.32 +
    Math.max(0, aime - SSA_BEND_2) * 0.15
  )
}

function earlyClaimReduction(monthsEarly: number): number {
  if (monthsEarly <= 0) return 0
  const first = Math.min(monthsEarly, 36)
  const rest = Math.max(0, monthsEarly - 36)
  return first * (5 / 9 / 100) + rest * (5 / 12 / 100)
}

export function estimateSocialSecurityBenefit(
  annualSalary: number,
  retirementAge: number,
  fullRetirementAge = 67
): number {
  const aime = Math.min(annualSalary, SSA_MAX_TAXABLE_EARNINGS) / 12
  const monthlyPia = computePiaFromAime(aime)
  const monthsEarly = Math.max(0, Math.round((fullRetirementAge - retirementAge) * 12))
  const reduction = earlyClaimReduction(monthsEarly)
  return Math.max(0, monthlyPia * 12 * (1 - reduction))
}

function futureValueOfAnnuity(annualPayment: number, years: number, rate: number): number {
  if (years <= 0) return 0
  if (rate === 0) return annualPayment * years
  return annualPayment * ((Math.pow(1 + rate, years) - 1) / rate) * (1 + rate)
}

export function analyzeRothVsTraditional(
  annualContribution: number,
  years: number,
  currentTaxRate: number,
  retirementTaxRate: number,
  returnRate: number
): { rothFuture: number; traditionalFuture: number; traditionalAfterTax: number; winner: 'roth' | 'traditional' | 'tie' } {
  const r = returnRate / 100
  const preTaxContribution = annualContribution
  const postTaxContribution = annualContribution * (1 - currentTaxRate / 100)

  const traditionalFuture = futureValueOfAnnuity(preTaxContribution, years, r)
  const rothFuture = futureValueOfAnnuity(postTaxContribution, years, r)
  const traditionalAfterTax = traditionalFuture * (1 - retirementTaxRate / 100)

  return {
    rothFuture,
    traditionalFuture,
    traditionalAfterTax,
    winner:
      Math.abs(rothFuture - traditionalAfterTax) < 100
        ? 'tie'
        : rothFuture > traditionalAfterTax
          ? 'roth'
          : 'traditional',
  }
}

/** IRS Uniform Lifetime Table (SECURE 2.0, ages 73–120). */
const RMD_DISTRIBUTION_PERIOD: Record<number, number> = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2,
  81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7,
  89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4,
  97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9,
  105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3,
  113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
}

export function estimateRMD(traditionalBalance: number, age: number): number {
  if (age < 73) return 0
  const clampedAge = Math.min(Math.max(age, 73), 120)
  const factor = RMD_DISTRIBUTION_PERIOD[clampedAge] ?? RMD_DISTRIBUTION_PERIOD[120]
  return traditionalBalance / factor
}

function computeConversionBreakevenYears(
  conversionAmount: number,
  taxNow: number,
  growthRate: number,
  futureTaxRate: number
): number {
  const futureRate = futureTaxRate / 100
  if (futureRate <= 0 || conversionAmount <= 0) return 0

  if (growthRate === 0) {
    return taxNow <= conversionAmount * futureRate ? 0 : Infinity
  }

  const target = taxNow / (conversionAmount * futureRate)
  if (target <= 1) return 0
  return Math.log(target) / Math.log(1 + growthRate)
}

export function rothConversionAnalysis(
  conversionAmount: number,
  currentTaxRate: number,
  yearsToGrow: number,
  returnRate: number,
  futureTaxRate: number
): { taxNow: number; rothFutureValue: number; breakevenYears: number } {
  const taxNow = conversionAmount * (currentTaxRate / 100)
  const r = returnRate / 100
  const rothFutureValue = conversionAmount * Math.pow(1 + r, yearsToGrow)
  const breakevenYears = computeConversionBreakevenYears(conversionAmount, taxNow, r, futureTaxRate)
  return { taxNow, rothFutureValue, breakevenYears }
}
