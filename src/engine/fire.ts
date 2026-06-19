import type { Account, FireSettings, Scenario } from '../types'
import { clamp } from './format'

export interface FireResults {
  fireNumber: number
  currentPortfolio: number
  progressPercent: number
  gapRemaining: number
  yearsUntilFi: number | null
  targetFireAge: number | null
  additionalMonthlySavings: number
  safeWithdrawalEstimate: number
  requiredPortfolioSize: number
  portfolioShortfall: number
}

export interface CoastFiResults {
  coastFiNumber: number
  progressPercent: number
  coastFiAge: number | null
  yearsUntilCoast: number | null
  additionalSavingsNeeded: number
  requiredFutureReturn: number
}

export interface WithdrawalResults {
  withdrawalRate: number
  annualSpending: number
  requiredPortfolio: number
  safeWithdrawal: number
  yearsUntilFi: number | null
  shortfall: number
}

function getInvestableAssets(accounts: Account[]): number {
  return accounts.filter((a) => !a.isLiability).reduce((s, a) => s + a.balance, 0)
}

function getAnnualContributions(accounts: Account[]): number {
  return accounts
    .filter((a) => !a.isLiability)
    .reduce((s, a) => s + a.monthlyContribution * 12 * (1 + a.employerMatchPercent / 100), 0)
}

export function calculateFireNumber(annualSpending: number, withdrawalRate: number): number {
  if (withdrawalRate <= 0) return 0
  return annualSpending / withdrawalRate
}

export function calculateFireResults(scenario: Scenario): FireResults {
  const { accounts, profile, assumptions, fireSettings } = scenario
  const portfolio = getInvestableAssets(accounts)
  const annualContrib = getAnnualContributions(accounts)
  const fireNumber = calculateFireNumber(fireSettings.annualSpending, fireSettings.withdrawalRate)
  const progressPercent = fireNumber > 0 ? (portfolio / fireNumber) * 100 : 0
  const gapRemaining = Math.max(0, fireNumber - portfolio)
  const realReturn = assumptions.annualReturnRate - assumptions.inflationRate

  let yearsUntilFi: number | null = null
  let targetFireAge: number | null = null

  if (portfolio >= fireNumber) {
    yearsUntilFi = 0
    targetFireAge = profile.currentAge
  } else if (realReturn > -1) {
    let balance = portfolio
    let years = 0
    let contrib = annualContrib
    const maxYears = 60

    while (balance < fireNumber && years < maxYears) {
      balance = balance * (1 + realReturn / 100) + contrib
      contrib *= 1 + assumptions.contributionGrowthRate / 100
      years++
    }

    if (balance >= fireNumber) {
      yearsUntilFi = years
      targetFireAge = profile.currentAge + years
    }
  }

  let additionalMonthlySavings = 0
  if (yearsUntilFi !== null && yearsUntilFi > 0 && realReturn > -1) {
    const n = yearsUntilFi
    const r = realReturn / 100
    const fv = fireNumber - portfolio * Math.pow(1 + r, n)
    if (fv > 0 && r !== 0) {
      additionalMonthlySavings = (fv * r) / (12 * (Math.pow(1 + r, n) - 1))
    } else if (fv > 0) {
      additionalMonthlySavings = fv / (n * 12)
    }
  }

  return {
    fireNumber,
    currentPortfolio: portfolio,
    progressPercent: clamp(progressPercent, 0, 999),
    gapRemaining,
    yearsUntilFi,
    targetFireAge,
    additionalMonthlySavings: Math.max(0, additionalMonthlySavings),
    safeWithdrawalEstimate: portfolio * fireSettings.withdrawalRate,
    requiredPortfolioSize: fireNumber,
    portfolioShortfall: gapRemaining,
  }
}

export function calculateCoastFiResults(scenario: Scenario): CoastFiResults {
  const { accounts, profile, assumptions, fireSettings } = scenario
  const portfolio = getInvestableAssets(accounts)
  const fireNumber = calculateFireNumber(fireSettings.annualSpending, fireSettings.withdrawalRate)
  const yearsToRetirement = Math.max(0, profile.retirementAge - profile.currentAge)
  const realReturn = (assumptions.annualReturnRate - assumptions.inflationRate) / 100

  const coastFiNumber =
    yearsToRetirement > 0 && realReturn > -1
      ? fireNumber / Math.pow(1 + realReturn, yearsToRetirement)
      : fireNumber

  const progressPercent = coastFiNumber > 0 ? (portfolio / coastFiNumber) * 100 : 0
  const additionalSavingsNeeded = Math.max(0, coastFiNumber - portfolio)

  let coastFiAge: number | null = null
  let yearsUntilCoast: number | null = null

  if (portfolio >= coastFiNumber) {
    coastFiAge = profile.currentAge
    yearsUntilCoast = 0
  } else {
    const annualContrib = getAnnualContributions(accounts)
    let balance = portfolio
    let years = 0
    let contrib = annualContrib

    while (balance < coastFiNumber && years < 50) {
      balance = balance * (1 + realReturn) + contrib
      contrib *= 1 + assumptions.contributionGrowthRate / 100
      years++
    }

    if (balance >= coastFiNumber) {
      yearsUntilCoast = years
      coastFiAge = profile.currentAge + years
    }
  }

  const requiredFutureReturn =
    portfolio > 0 && yearsToRetirement > 0
      ? (Math.pow(fireNumber / portfolio, 1 / yearsToRetirement) - 1) * 100
      : 0

  return {
    coastFiNumber,
    progressPercent: clamp(progressPercent, 0, 999),
    coastFiAge,
    yearsUntilCoast,
    additionalSavingsNeeded,
    requiredFutureReturn,
  }
}

export function calculateWithdrawalResults(
  scenario: Scenario,
  settings?: Partial<FireSettings>
): WithdrawalResults {
  const fs = { ...scenario.fireSettings, ...settings }
  const portfolio = getInvestableAssets(scenario.accounts)
  const fireNumber = calculateFireNumber(fs.annualSpending, fs.withdrawalRate)
  const fire = calculateFireResults({ ...scenario, fireSettings: fs })

  return {
    withdrawalRate: fs.withdrawalRate,
    annualSpending: fs.annualSpending,
    requiredPortfolio: fireNumber,
    safeWithdrawal: portfolio * fs.withdrawalRate,
    yearsUntilFi: fire.yearsUntilFi,
    shortfall: fire.gapRemaining,
  }
}

export interface CoastFiTimelinePoint {
  age: number
  portfolio: number
  coastTarget: number
  fireTarget: number
}

export function buildCoastFiTimeline(scenario: Scenario): CoastFiTimelinePoint[] {
  const { accounts, profile, assumptions, fireSettings } = scenario
  const fireNumber = calculateFireNumber(fireSettings.annualSpending, fireSettings.withdrawalRate)
  const realReturn = (assumptions.annualReturnRate - assumptions.inflationRate) / 100
  const annualContrib = getAnnualContributions(accounts)

  let balance = getInvestableAssets(accounts)
  let contrib = annualContrib
  const points: CoastFiTimelinePoint[] = []

  for (let age = profile.currentAge; age <= profile.lifeExpectancy; age++) {
    const yearsToRet = Math.max(0, profile.retirementAge - age)
    const coastTarget =
      yearsToRet > 0 ? fireNumber / Math.pow(1 + realReturn, yearsToRet) : fireNumber

    points.push({ age, portfolio: balance, coastTarget, fireTarget: fireNumber })

    balance = balance * (1 + realReturn) + contrib
    contrib *= 1 + assumptions.contributionGrowthRate / 100
  }

  return points
}

export function estimateFireProbability(
  scenario: Scenario,
  simulations = 500
): number {
  const fire = calculateFireResults(scenario)
  if (fire.yearsUntilFi === null) return 0
  if (fire.yearsUntilFi === 0) return 100

  const { assumptions, fireSettings } = scenario
  const targetYears = fire.yearsUntilFi
  const annualContrib = getAnnualContributions(scenario.accounts)
  let successes = 0
  const mean = assumptions.annualReturnRate / 100
  const std = assumptions.returnStdDev / 100

  for (let sim = 0; sim < simulations; sim++) {
    let balance = getInvestableAssets(scenario.accounts)
    let contrib = annualContrib
    let reached = false

    for (let y = 0; y < targetYears; y++) {
      const u1 = Math.random()
      const u2 = Math.random()
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      const ret = mean + z * std
      balance = balance * (1 + ret) + contrib
      contrib *= 1 + assumptions.contributionGrowthRate / 100
      if (balance >= fireSettings.annualSpending / fireSettings.withdrawalRate) {
        reached = true
        break
      }
    }
    if (reached) successes++
  }

  return (successes / simulations) * 100
}

export function contributionImpact(
  scenario: Scenario,
  extraMonthly: number
): { yearsSaved: number; newYearsUntilFi: number | null } {
  const base = calculateFireResults(scenario)
  const modified = calculateFireResults({
    ...scenario,
    accounts: scenario.accounts.map((a) =>
      !a.isLiability
        ? { ...a, monthlyContribution: a.monthlyContribution + extraMonthly / scenario.accounts.filter((x) => !x.isLiability).length }
        : a
    ),
  })

  const baseYears = base.yearsUntilFi ?? 999
  const newYears = modified.yearsUntilFi ?? 999

  return {
    yearsSaved: Math.max(0, baseYears - newYears),
    newYearsUntilFi: modified.yearsUntilFi,
  }
}
