import type { FilingStatus, PayFrequency, PaycheckInputs } from '../types'
import {
  calculateFederalIncomeTax,
  calculateMedicareTax,
  calculateSocialSecurityTax,
  calculateStateTax,
} from './tax'

export interface PaycheckBreakdown {
  grossPay: number
  federalTax: number
  stateTax: number
  socialSecurity: number
  medicare: number
  pretax401k: number
  roth401k: number
  hsa: number
  espp: number
  healthInsurance: number
  otherDeductions: number
  netPay: number
  annualGross: number
  annualNet: number
  chartData: { name: string; value: number; color: string }[]
}

const PERIODS: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
}

export function calculatePaycheck(
  inputs: PaycheckInputs,
  filingStatus: FilingStatus,
  stateFlatRate: number
): PaycheckBreakdown {
  const periods = PERIODS[inputs.frequency]
  const annualGross = inputs.salary + inputs.bonus
  const grossPerPeriod = annualGross / periods

  const annual401k = inputs.pretax401k + inputs.roth401k
  const annualHsa = inputs.hsa
  const annualEspp = inputs.espp
  const annualHealth = inputs.healthInsurance
  const annualOther = inputs.otherDeductions

  const taxableAnnual =
    annualGross - inputs.pretax401k - inputs.hsa - annualHealth - annualOther

  const federalAnnual = calculateFederalIncomeTax(Math.max(0, taxableAnnual), filingStatus)
  const stateAnnual = calculateStateTax(Math.max(0, taxableAnnual), stateFlatRate)
  const ssAnnual = calculateSocialSecurityTax(annualGross)
  const medicareAnnual = calculateMedicareTax(annualGross, filingStatus)

  const totalDeductionsAnnual =
    federalAnnual +
    stateAnnual +
    ssAnnual +
    medicareAnnual +
    annual401k +
    annualHsa +
    annualEspp +
    annualHealth +
    annualOther

  const netAnnual = annualGross - totalDeductionsAnnual

  const federalPer = federalAnnual / periods
  const statePer = stateAnnual / periods
  const ssPer = ssAnnual / periods
  const medicarePer = medicareAnnual / periods
  const pretax401kPer = inputs.pretax401k / periods
  const roth401kPer = inputs.roth401k / periods
  const hsaPer = inputs.hsa / periods
  const esppPer = inputs.espp / periods
  const healthPer = inputs.healthInsurance / periods
  const otherPer = inputs.otherDeductions / periods

  const netPer =
    grossPerPeriod -
    federalPer -
    statePer -
    ssPer -
    medicarePer -
    pretax401kPer -
    roth401kPer -
    hsaPer -
    esppPer -
    healthPer -
    otherPer

  const chartData = [
    { name: 'Net Pay', value: netPer, color: '#7d9b8a' },
    { name: 'Federal Tax', value: federalPer, color: '#6b8fbf' },
    { name: 'State Tax', value: statePer, color: '#8b7aa8' },
    { name: 'FICA', value: ssPer + medicarePer, color: '#c96b6b' },
    { name: '401(k)', value: pretax401kPer + roth401kPer, color: '#c9a962' },
    { name: 'Other', value: hsaPer + esppPer + healthPer + otherPer, color: '#9aa5b8' },
  ].filter((d) => d.value > 0)

  return {
    grossPay: grossPerPeriod,
    federalTax: federalPer,
    stateTax: statePer,
    socialSecurity: ssPer,
    medicare: medicarePer,
    pretax401k: pretax401kPer,
    roth401k: roth401kPer,
    hsa: hsaPer,
    espp: esppPer,
    healthInsurance: healthPer,
    otherDeductions: otherPer,
    netPay: netPer,
    annualGross,
    annualNet: netAnnual,
    chartData,
  }
}

export function getAnnualCashFlowSummary(breakdown: PaycheckBreakdown) {
  return [
    { category: 'Gross Income', amount: breakdown.annualGross },
    { category: 'Taxes & FICA', amount: breakdown.federalTax * PERIODS.monthly * 12 / 12 + breakdown.stateTax * 12 + breakdown.socialSecurity * 12 + breakdown.medicare * 12 },
    { category: 'Retirement', amount: (breakdown.pretax401k + breakdown.roth401k) * PERIODS.monthly * 12 },
    { category: 'Net Take-Home', amount: breakdown.annualNet },
  ]
}

export { PERIODS }
