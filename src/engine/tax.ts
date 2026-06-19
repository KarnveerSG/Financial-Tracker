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

export function calculateMedicareTax(wages: number, status: FilingStatus): number {
  const base = wages * 0.0145
  const additional =
    status !== 'married_separate' && wages > 200000
      ? (wages - 200000) * 0.009
      : status === 'married_separate' && wages > 125000
        ? (wages - 125000) * 0.009
        : 0
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

export function estimateSocialSecurityBenefit(
  annualSalary: number,
  retirementAge: number
): number {
  const aime = Math.min(annualSalary, 168600) / 12
  const pia = aime * 0.4 * 12
  const earlyReduction = retirementAge < 67 ? (67 - retirementAge) * 0.05 : 0
  return Math.max(0, pia * (1 - earlyReduction))
}

export function analyzeRothVsTraditional(
  annualContribution: number,
  years: number,
  _currentTaxRate: number,
  retirementTaxRate: number,
  returnRate: number
): { rothFuture: number; traditionalFuture: number; traditionalAfterTax: number; winner: 'roth' | 'traditional' | 'tie' } {
  const r = returnRate / 100
  const rothFuture = annualContribution * ((Math.pow(1 + r, years) - 1) / r) * (1 + r)
  const traditionalFuture = annualContribution * ((Math.pow(1 + r, years) - 1) / r) * (1 + r)
  const traditionalAfterTax = traditionalFuture * (1 - retirementTaxRate / 100)
  const rothNet = rothFuture
  const tradNet = traditionalAfterTax

  return {
    rothFuture: rothNet,
    traditionalFuture,
    traditionalAfterTax,
    winner: Math.abs(rothNet - tradNet) < 100 ? 'tie' : rothNet > tradNet ? 'roth' : 'traditional',
  }
}

export function estimateRMD(TraditionalBalance: number, age: number): number {
  if (age < 73) return 0
  const factors: Record<number, number> = {
    73: 26.5, 74: 25.5, 75: 24.6, 80: 20.2, 85: 16.0, 90: 12.2, 95: 8.9,
  }
  const factor = factors[age] ?? factors[95] ?? 10
  return TraditionalBalance / factor
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
  const breakevenYears = currentTaxRate > futureTaxRate ? yearsToGrow * 0.6 : yearsToGrow * 1.2
  return { taxNow, rothFutureValue, breakevenYears }
}
