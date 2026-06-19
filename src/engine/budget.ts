import type { BudgetCategory, PayFrequency, Scenario } from '../types'
import { US_STATES } from '../types'
import { sumContributions } from './accounts'
import { calculatePaycheck, PERIODS } from './paycheck'

export interface BudgetLineItem {
  label: string
  amount: number
  color: string
}

export interface PreTaxBudget {
  items: BudgetLineItem[]
  grossAnnual: number
}

export interface PostTaxBudget {
  netMonthly: number
  categories: BudgetCategory[]
  totalSpending: number
  remainder: number
  chartData: BudgetLineItem[]
}

function annualize(perPeriod: number, frequency: PayFrequency): number {
  return perPeriod * PERIODS[frequency]
}

export function buildPreTaxBudget(scenario: Scenario): PreTaxBudget {
  const { paycheckInputs, profile, accounts } = scenario
  const stateRate = US_STATES.find((s) => s.code === profile.state)?.flatRate ?? 0
  const paycheck = calculatePaycheck(paycheckInputs, profile.filingStatus, stateRate)
  const { frequency } = paycheckInputs
  const grossAnnual = paycheck.annualGross

  const accountContributions = sumContributions(accounts) * 12
  const paycheckRetirement =
    paycheckInputs.pretax401k + paycheckInputs.roth401k + paycheckInputs.hsa
  const extraAccountSavings = Math.max(0, accountContributions - paycheckRetirement)

  const items: BudgetLineItem[] = [
    { label: '401(k) Pretax', amount: paycheckInputs.pretax401k, color: '#6b8fbf' },
    { label: '401(k) Roth', amount: paycheckInputs.roth401k, color: '#7d9b8a' },
    { label: 'HSA', amount: paycheckInputs.hsa, color: '#8b7aa8' },
    { label: 'ESPP', amount: paycheckInputs.espp, color: '#c9a962' },
    { label: 'Health Insurance', amount: paycheckInputs.healthInsurance, color: '#9aa5b8' },
    { label: 'Other Deductions', amount: paycheckInputs.otherDeductions, color: '#5a6578' },
    { label: 'Federal Tax', amount: annualize(paycheck.federalTax, frequency), color: '#c96b6b' },
    { label: 'State Tax', amount: annualize(paycheck.stateTax, frequency), color: '#a85555' },
    {
      label: 'FICA',
      amount: annualize(paycheck.socialSecurity + paycheck.medicare, frequency),
      color: '#d48484',
    },
    { label: 'Extra Account Savings', amount: extraAccountSavings, color: '#b8943a' },
    { label: 'Net Take-Home', amount: paycheck.annualNet, color: '#7d9b8a' },
  ].filter((i) => i.amount > 0)

  return { items, grossAnnual }
}

export function buildPostTaxBudget(scenario: Scenario): PostTaxBudget {
  const { budgetInputs, paycheckInputs, profile } = scenario
  const stateRate = US_STATES.find((s) => s.code === profile.state)?.flatRate ?? 0
  const paycheck = calculatePaycheck(paycheckInputs, profile.filingStatus, stateRate)
  const netMonthly = paycheck.annualNet / 12
  const categories = budgetInputs.postTaxCategories
  const totalSpending = categories.reduce((s, c) => s + c.amount, 0)
  const remainder = netMonthly - totalSpending

  const palette = ['#6b8fbf', '#7d9b8a', '#c9a962', '#8b7aa8', '#9aa5b8', '#c96b6b', '#5a6578', '#d48484']
  const chartData: BudgetLineItem[] = [
    ...categories
      .filter((c) => c.amount > 0)
      .map((c, i) => ({
        label: c.label,
        amount: c.amount,
        color: palette[i % palette.length],
      })),
    ...(remainder !== 0
      ? [{
          label: remainder > 0 ? 'Unallocated' : 'Over Budget',
          amount: Math.abs(remainder),
          color: remainder > 0 ? '#7d9b8a' : '#c96b6b',
        }]
      : []),
  ]

  return { netMonthly, categories, totalSpending, remainder, chartData }
}
