import type { Scenario, StressScenarioInputs } from '../types'
import { calculateCoastFiResults, calculateFireResults } from './fire'
import { estimateFireProbability } from './fire'

export interface StressTestResults {
  baseline: {
    fireYears: number | null
    coastYears: number | null
    successRate: number
  }
  stressed: {
    fireYears: number | null
    coastYears: number | null
    successRate: number
  }
  fireDateShift: number
  coastDateShift: number
  successRateChange: number
}

function applyStress(scenario: Scenario, stress: StressScenarioInputs): Scenario {
  const crashMultiplier = 1 - stress.marketCrashPercent / 100
  const returnReduction = stress.returnReduction
  const inflationIncrease = stress.inflationIncrease
  const savingsMultiplier = 1 - stress.savingsReductionPercent / 100
  const spendingMultiplier = 1 + stress.spendingIncreasePercent / 100

  return {
    ...scenario,
    profile: {
      ...scenario.profile,
      retirementAge: Math.max(
        scenario.profile.currentAge,
        scenario.profile.retirementAge - stress.earlyRetirementYears
      ),
    },
    accounts: scenario.accounts.map((a) => ({
      ...a,
      balance: a.isLiability ? a.balance : a.balance * crashMultiplier,
      monthlyContribution: a.isLiability
        ? a.monthlyContribution
        : a.monthlyContribution * savingsMultiplier,
    })),
    assumptions: {
      ...scenario.assumptions,
      annualReturnRate: scenario.assumptions.annualReturnRate - returnReduction,
      inflationRate: scenario.assumptions.inflationRate + inflationIncrease,
    },
    fireSettings: {
      ...scenario.fireSettings,
      annualSpending: scenario.fireSettings.annualSpending * spendingMultiplier,
    },
  }
}

export function runStressTest(scenario: Scenario): StressTestResults {
  const baselineFire = calculateFireResults(scenario)
  const baselineCoast = calculateCoastFiResults(scenario)

  const stressedScenario = applyStress(scenario, scenario.stressInputs)
  const stressedFire = calculateFireResults(stressedScenario)
  const stressedCoast = calculateCoastFiResults(stressedScenario)

  return {
    baseline: {
      fireYears: baselineFire.yearsUntilFi,
      coastYears: baselineCoast.yearsUntilCoast,
      successRate: estimateFireProbability(scenario, 200),
    },
    stressed: {
      fireYears: stressedFire.yearsUntilFi,
      coastYears: stressedCoast.yearsUntilCoast,
      successRate: estimateFireProbability(stressedScenario, 200),
    },
    fireDateShift: (stressedFire.yearsUntilFi ?? 0) - (baselineFire.yearsUntilFi ?? 0),
    coastDateShift: (stressedCoast.yearsUntilCoast ?? 0) - (baselineCoast.yearsUntilCoast ?? 0),
    successRateChange:
      estimateFireProbability(stressedScenario, 200) - estimateFireProbability(scenario, 200),
  }
}

export function sequenceOfReturnsRisk(
  initialBalance: number,
  annualWithdrawal: number,
  years: number,
  meanReturn: number,
  badYearsFirst: boolean
): { age: number; balance: number }[] {
  const goodReturn = (meanReturn + 4) / 100
  const badReturn = (meanReturn - 15) / 100
  const returns = badYearsFirst
    ? Array.from({ length: years }, (_, i) => (i < 3 ? badReturn : goodReturn))
    : Array.from({ length: years }, (_, i) => (i >= years - 3 ? badReturn : goodReturn))

  let balance = initialBalance
  const points = [{ age: 0, balance }]

  for (let i = 0; i < years; i++) {
    balance = balance * (1 + returns[i]) - annualWithdrawal
    points.push({ age: i + 1, balance: Math.max(0, balance) })
  }

  return points
}

export function investmentFeeImpact(
  balance: number,
  annualContribution: number,
  years: number,
  grossReturn: number,
  feePercent: number
): { withFees: number; withoutFees: number; lostToFees: number } {
  const r = grossReturn / 100
  const f = feePercent / 100

  let withFees = balance
  let withoutFees = balance

  for (let y = 0; y < years; y++) {
    withFees = withFees * (1 + r - f) + annualContribution
    withoutFees = withoutFees * (1 + r) + annualContribution
  }

  return {
    withFees,
    withoutFees,
    lostToFees: withoutFees - withFees,
  }
}

export function calculateSavingsRate(grossIncome: number, totalSavings: number): number {
  if (grossIncome <= 0) return 0
  return (totalSavings / grossIncome) * 100
}
