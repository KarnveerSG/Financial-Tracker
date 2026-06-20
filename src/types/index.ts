export type Currency = 'USD' | 'CAD' | 'EUR' | 'GBP'

export type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_of_household'

export type TaxTreatment = 'pretax' | 'roth' | 'taxable' | 'none'

export type AccountType =
  | '401k'
  | 'roth_401k'
  | 'traditional_ira'
  | 'roth_ira'
  | 'hsa'
  | 'brokerage'
  | 'hysa'
  | 'checking'
  | 'savings'
  | 'espp'
  | 'pension'
  | 'real_estate'
  | 'crypto'
  | 'loan'
  | 'mortgage'
  | 'credit'
  | 'custom'

export type AllocationCategoryId =
  | 'pretax'
  | 'posttax'
  | 'taxable_brokerage'
  | 'cash_hysa'
  | 'other'
  | string

export interface AllocationCategoryDef {
  id: AllocationCategoryId
  label: string
  color: string
}

export interface StockHolding {
  id: string
  ticker: string
  shares: number
  pricePerShare: number
}

export interface Account {
  id: string
  name: string
  accountType: AccountType
  balance: number
  monthlyContribution: number
  expectedAnnualReturn: number
  taxTreatment: TaxTreatment
  employerMatchPercent: number
  contributionIncreaseRate: number
  allocationCategory: AllocationCategoryId
  isLiability: boolean
  interestRate: number
  loanTermMonths: number
  holdings: StockHolding[]
  syncBalanceFromHoldings: boolean
  notes: string
}

export interface BudgetCategory {
  id: string
  label: string
  amount: number
}

export interface BudgetInputs {
  postTaxCategories: BudgetCategory[]
}

export interface UserProfile {
  name: string
  currency: Currency
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  annualSalary: number
  filingStatus: FilingStatus
  state: string
  lightMode: boolean
}

export interface ProjectionAssumptions {
  inflationRate: number
  annualReturnRate: number
  returnStdDev: number
  salaryGrowthRate: number
  contributionGrowthRate: number
}

export interface FireSettings {
  annualSpending: number
  withdrawalRate: number
  desiredRetirementAge: number
}

export interface TaxSimulatorInputs {
  traditionalWithdrawal: number
  rothWithdrawal: number
  brokerageWithdrawal: number
  longTermGains: number
  qualifiedDividends: number
  socialSecurityBenefit: number
}

export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'

export interface PaycheckInputs {
  salary: number
  bonus: number
  pretax401k: number
  roth401k: number
  hsa: number
  espp: number
  healthInsurance: number
  otherDeductions: number
  frequency: PayFrequency
}

export interface StressScenarioInputs {
  marketCrashPercent: number
  returnReduction: number
  inflationIncrease: number
  earlyRetirementYears: number
  spendingIncreasePercent: number
  savingsReductionPercent: number
}

export interface SavingsRateSnapshot {
  id: string
  date: string
  rate: number
  grossIncome: number
  savings: number
}

export type NetWorthLineKind = 'section' | 'group' | 'account' | 'total'
export type NetWorthSide = 'asset' | 'liability'

export interface NetWorthLineItem {
  id: string
  name: string
  parentId: string | null
  kind: NetWorthLineKind
  side: NetWorthSide
  accountType?: AccountType
  sortOrder: number
  /** When true, balance rolls into snapshot totals (matches NW Tracker Excel formulas). */
  includeInTotal?: boolean
}

export interface NetWorthSnapshot {
  id: string
  date: string
  balances: Record<string, number>
}

export interface Scenario {
  id: string
  name: string
  accounts: Account[]
  profile: UserProfile
  assumptions: ProjectionAssumptions
  fireSettings: FireSettings
  taxInputs: TaxSimulatorInputs
  paycheckInputs: PaycheckInputs
  stressInputs: StressScenarioInputs
  allocationCategories: AllocationCategoryDef[]
  savingsHistory: SavingsRateSnapshot[]
  budgetInputs: BudgetInputs
  netWorthLineItems: NetWorthLineItem[]
  netWorthSnapshots: NetWorthSnapshot[]
}

export interface AppState {
  scenarios: Scenario[]
  activeScenarioId: string
  hasOnboarded: boolean
}

export const ACCOUNT_TYPES: { value: AccountType; label: string; defaultTax: TaxTreatment; defaultCategory: AllocationCategoryId; isLiability?: boolean }[] = [
  { value: '401k', label: '401(k)', defaultTax: 'pretax', defaultCategory: 'pretax' },
  { value: 'roth_401k', label: 'Roth 401(k)', defaultTax: 'roth', defaultCategory: 'posttax' },
  { value: 'traditional_ira', label: 'Traditional IRA', defaultTax: 'pretax', defaultCategory: 'pretax' },
  { value: 'roth_ira', label: 'Roth IRA', defaultTax: 'roth', defaultCategory: 'posttax' },
  { value: 'hsa', label: 'HSA', defaultTax: 'roth', defaultCategory: 'posttax' },
  { value: 'brokerage', label: 'Brokerage', defaultTax: 'taxable', defaultCategory: 'taxable_brokerage' },
  { value: 'hysa', label: 'HYSA', defaultTax: 'none', defaultCategory: 'cash_hysa' },
  { value: 'checking', label: 'Checking', defaultTax: 'none', defaultCategory: 'cash_hysa' },
  { value: 'savings', label: 'Savings', defaultTax: 'none', defaultCategory: 'cash_hysa' },
  { value: 'espp', label: 'ESPP', defaultTax: 'taxable', defaultCategory: 'taxable_brokerage' },
  { value: 'pension', label: 'Pension', defaultTax: 'pretax', defaultCategory: 'pretax' },
  { value: 'real_estate', label: 'Real Estate', defaultTax: 'taxable', defaultCategory: 'other' },
  { value: 'crypto', label: 'Crypto', defaultTax: 'taxable', defaultCategory: 'taxable_brokerage' },
  { value: 'loan', label: 'Loan', defaultTax: 'none', defaultCategory: 'other', isLiability: true },
  { value: 'mortgage', label: 'Mortgage', defaultTax: 'none', defaultCategory: 'other', isLiability: true },
  { value: 'credit', label: 'Credit Card', defaultTax: 'none', defaultCategory: 'other', isLiability: true },
  { value: 'custom', label: 'Custom', defaultTax: 'taxable', defaultCategory: 'other' },
]

export const DEFAULT_ALLOCATION_CATEGORIES: AllocationCategoryDef[] = [
  { id: 'pretax', label: 'Pretax Assets', color: '#6b8fbf' },
  { id: 'posttax', label: 'Post-Tax / Roth', color: '#7d9b8a' },
  { id: 'taxable_brokerage', label: 'Taxable Brokerage', color: '#c9a962' },
  { id: 'cash_hysa', label: 'Cash / HYSA', color: '#9aa5b8' },
  { id: 'other', label: 'Other Assets', color: '#8b7aa8' },
]

export const US_STATES: { code: string; name: string; flatRate?: number }[] = [
  { code: 'CA', name: 'California', flatRate: 0.093 },
  { code: 'TX', name: 'Texas', flatRate: 0 },
  { code: 'NY', name: 'New York', flatRate: 0.0685 },
  { code: 'FL', name: 'Florida', flatRate: 0 },
  { code: 'WA', name: 'Washington', flatRate: 0 },
  { code: 'IL', name: 'Illinois', flatRate: 0.0495 },
  { code: 'PA', name: 'Pennsylvania', flatRate: 0.0307 },
  { code: 'NJ', name: 'New Jersey', flatRate: 0.0637 },
  { code: 'CO', name: 'Colorado', flatRate: 0.044 },
  { code: 'NONE', name: 'No state tax (estimate)', flatRate: 0 },
]

export const CURRENCIES: { value: Currency; label: string; locale: string }[] = [
  { value: 'USD', label: 'USD', locale: 'en-US' },
  { value: 'CAD', label: 'CAD', locale: 'en-CA' },
  { value: 'EUR', label: 'EUR', locale: 'de-DE' },
  { value: 'GBP', label: 'GBP', locale: 'en-GB' },
]

export const WITHDRAWAL_PRESETS = [0.03, 0.035, 0.04] as const

export const DEFAULT_BUDGET_CATEGORIES: BudgetCategory[] = [
  { id: 'housing', label: 'Housing', amount: 0 },
  { id: 'food', label: 'Food', amount: 0 },
  { id: 'transport', label: 'Transportation', amount: 0 },
  { id: 'utilities', label: 'Utilities', amount: 0 },
  { id: 'entertainment', label: 'Entertainment', amount: 0 },
  { id: 'personal', label: 'Personal', amount: 0 },
  { id: 'savings', label: 'Savings / Goals', amount: 0 },
  { id: 'other', label: 'Other', amount: 0 },
]

export const HOLDINGS_ACCOUNT_TYPES: AccountType[] = ['brokerage', 'espp', 'crypto']
