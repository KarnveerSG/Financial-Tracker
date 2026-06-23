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
  selfEmploymentTax: number
  pretax401k: number
  roth401k: number
  solo401k: number
  hsa: number
  espp: number
  healthInsurance: number
  otherDeductions: number
  netPay: number
  annualGross: number
  annualNet: number
  chartData: { name: string; value: number; color: string }[]
}

export function calculateSelfEmploymentTax(netIncome: number): number {
  const seTaxable = Math.max(0, netIncome) * 0.9235
  return seTaxable * 0.153
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
  const w2Gross = inputs.salary + inputs.bonus
  const seNet = inputs.selfEmployedEnabled ? inputs.selfEmployedNetIncome : 0
  const solo401kAnnual = inputs.selfEmployedEnabled ? inputs.solo401k : 0
  const annualGross = w2Gross + seNet
  const grossPerPeriod = annualGross / periods

  const annual401k = inputs.pretax401k + inputs.roth401k
  const annualHsa = inputs.hsa
  const annualEspp = inputs.espp
  const annualHealth = inputs.healthInsurance
  const annualOther = inputs.otherDeductions

  const seTaxAnnual = inputs.selfEmployedEnabled ? calculateSelfEmploymentTax(seNet) : 0
  const seDeduction = seTaxAnnual * 0.5

  const taxableAnnual =
    w2Gross +
    seNet -
    inputs.pretax401k -
    solo401kAnnual -
    inputs.hsa -
    annualHealth -
    annualOther -
    seDeduction

  const federalAnnual = calculateFederalIncomeTax(Math.max(0, taxableAnnual), filingStatus)
  const stateAnnual = calculateStateTax(Math.max(0, taxableAnnual), stateFlatRate)
  const ssAnnual = calculateSocialSecurityTax(w2Gross)
  const medicareAnnual = calculateMedicareTax(w2Gross, filingStatus)

  const totalDeductionsAnnual =
    federalAnnual +
    stateAnnual +
    ssAnnual +
    medicareAnnual +
    seTaxAnnual +
    annual401k +
    solo401kAnnual +
    annualHsa +
    annualEspp +
    annualHealth +
    annualOther

  const netAnnual = annualGross - totalDeductionsAnnual

  const federalPer = federalAnnual / periods
  const statePer = stateAnnual / periods
  const ssPer = ssAnnual / periods
  const medicarePer = medicareAnnual / periods
  const sePer = seTaxAnnual / periods
  const pretax401kPer = inputs.pretax401k / periods
  const roth401kPer = inputs.roth401k / periods
  const solo401kPer = solo401kAnnual / periods
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
    sePer -
    pretax401kPer -
    roth401kPer -
    solo401kPer -
    hsaPer -
    esppPer -
    healthPer -
    otherPer

  const chartData = [
    { name: 'Net Pay', value: netPer, color: '#7d9b8a' },
    { name: 'Federal Tax', value: federalPer, color: '#6b8fbf' },
    { name: 'State Tax', value: statePer, color: '#8b7aa8' },
    { name: 'FICA', value: ssPer + medicarePer, color: '#c96b6b' },
    ...(sePer > 0 ? [{ name: 'SE Tax', value: sePer, color: '#b85c5c' }] : []),
    { name: '401(k)', value: pretax401kPer + roth401kPer + solo401kPer, color: '#c9a962' },
    { name: 'Other', value: hsaPer + esppPer + healthPer + otherPer, color: '#9aa5b8' },
  ].filter((d) => d.value > 0)

  return {
    grossPay: grossPerPeriod,
    federalTax: federalPer,
    stateTax: statePer,
    socialSecurity: ssPer,
    medicare: medicarePer,
    selfEmploymentTax: sePer,
    pretax401k: pretax401kPer,
    roth401k: roth401kPer,
    solo401k: solo401kPer,
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

export function getAnnualCashFlowSummary(breakdown: PaycheckBreakdown, frequency: PayFrequency) {
  const periods = PERIODS[frequency]
  const annualTaxes =
    (breakdown.federalTax +
      breakdown.stateTax +
      breakdown.socialSecurity +
      breakdown.medicare +
      breakdown.selfEmploymentTax) *
    periods
  const annualRetirement = (breakdown.pretax401k + breakdown.roth401k + breakdown.solo401k) * periods
  return [
    { category: 'Gross Income', amount: breakdown.annualGross },
    { category: 'Taxes & FICA', amount: annualTaxes },
    { category: 'Retirement', amount: annualRetirement },
    { category: 'Net Take-Home', amount: breakdown.annualNet },
  ]
}

export { PERIODS }
