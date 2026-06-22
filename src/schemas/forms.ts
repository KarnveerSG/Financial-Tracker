import { z } from 'zod'

export const taxLotSchema = z.object({
  id: z.string(),
  shares: z.coerce.number().min(0),
  costPerShare: z.coerce.number().min(0),
  acquiredDate: z.string(),
  notes: z.string().optional(),
})

export const stockHoldingSchema = z.object({
  id: z.string(),
  ticker: z.string().min(1, 'Ticker is required'),
  shares: z.coerce.number().min(0),
  pricePerShare: z.coerce.number().min(0),
  lots: z.array(taxLotSchema).optional(),
  costBasisMethod: z.enum(['fifo', 'lifo', 'avg', 'specific_id', 'hifo']).optional(),
})

export const accountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  accountType: z.string(),
  balance: z.coerce.number().min(0),
  monthlyContribution: z.coerce.number().min(0),
  expectedAnnualReturn: z.coerce.number().min(-50).max(50),
  taxTreatment: z.enum(['pretax', 'roth', 'taxable', 'none']),
  employerMatchPercent: z.coerce.number().min(0).max(100),
  contributionIncreaseRate: z.coerce.number().min(0).max(50),
  allocationCategory: z.string(),
  isLiability: z.boolean(),
  interestRate: z.coerce.number().min(0).max(100),
  loanTermMonths: z.coerce.number().min(0).max(600),
  holdings: z.array(stockHoldingSchema),
  syncBalanceFromHoldings: z.boolean(),
  notes: z.string(),
})

export type AccountFormValues = z.infer<typeof accountSchema>

export const profileSchema = z.object({
  name: z.string(),
  currentAge: z.coerce.number().min(18).max(100),
  retirementAge: z.coerce.number().min(40).max(100),
  lifeExpectancy: z.coerce.number().min(70).max(110),
  annualSalary: z.coerce.number().min(0),
  filingStatus: z.enum(['single', 'married_joint', 'married_separate', 'head_of_household']),
  state: z.string(),
})

export const assumptionsSchema = z.object({
  inflationRate: z.coerce.number().min(0).max(20),
  annualReturnRate: z.coerce.number().min(-10).max(30),
  returnStdDev: z.coerce.number().min(0).max(40),
  salaryGrowthRate: z.coerce.number().min(0).max(20),
  contributionGrowthRate: z.coerce.number().min(0).max(20),
})

export const fireSettingsSchema = z.object({
  annualSpending: z.coerce.number().min(0),
  withdrawalRate: z.coerce.number().min(0.01).max(0.1),
  desiredRetirementAge: z.coerce.number().min(30).max(100),
})
