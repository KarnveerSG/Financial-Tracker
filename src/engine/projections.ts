import type { Account, ProjectionAssumptions, UserProfile } from '../types'
import { percentile, randomNormal } from './format'

export interface ProjectionYear {
  age: number
  year: number
  median: number
  best: number
  worst: number
  medianReal: number
  bestReal: number
  worstReal: number
}

export interface MonteCarloResult {
  years: ProjectionYear[]
  successRate: number
  simulations: number
}

function getStartingBalance(accounts: Account[]): number {
  return accounts
    .filter((a) => !a.isLiability)
    .reduce((s, a) => s + a.balance, 0)
}

function getMonthlyContributions(accounts: Account[]): number {
  return accounts
    .filter((a) => !a.isLiability)
    .reduce((s, a) => s + a.monthlyContribution * (1 + a.employerMatchPercent / 100), 0)
}

export function runMonteCarloProjection(
  accounts: Account[],
  profile: UserProfile,
  assumptions: ProjectionAssumptions,
  simulations = 500
): MonteCarloResult {
  const startBalance = getStartingBalance(accounts)
  const startMonthlyContrib = getMonthlyContributions(accounts)
  const horizon = profile.lifeExpectancy - profile.currentAge
  const meanReturn = assumptions.annualReturnRate / 100
  const stdReturn = assumptions.returnStdDev / 100
  const inflation = assumptions.inflationRate / 100
  const contribGrowth = assumptions.contributionGrowthRate / 100

  const yearlyBalances: number[][] = Array.from({ length: horizon + 1 }, () => [])

  for (let sim = 0; sim < simulations; sim++) {
    let balance = startBalance
    let monthlyContrib = startMonthlyContrib

    for (let y = 0; y <= horizon; y++) {
      yearlyBalances[y].push(balance)
      if (y < horizon) {
        const annualReturn = randomNormal(meanReturn, stdReturn)
        balance = balance * (1 + annualReturn) + monthlyContrib * 12
        monthlyContrib *= 1 + contribGrowth
      }
    }
  }

  const years: ProjectionYear[] = []

  for (let y = 0; y <= horizon; y++) {
    const sorted = [...yearlyBalances[y]].sort((a, b) => a - b)
    const median = percentile(sorted, 50)
    const best = percentile(sorted, 90)
    const worst = percentile(sorted, 10)
    const inflationFactor = Math.pow(1 + inflation, y)

    years.push({
      age: profile.currentAge + y,
      year: new Date().getFullYear() + y,
      median,
      best,
      worst,
      medianReal: median / inflationFactor,
      bestReal: best / inflationFactor,
      worstReal: worst / inflationFactor,
    })
  }

  const retirementYearIndex = profile.retirementAge - profile.currentAge
  const atRetirement = yearlyBalances[Math.min(retirementYearIndex, horizon)] ?? []
  const successRate =
    atRetirement.length > 0
      ? (atRetirement.filter((b) => b > startBalance).length / atRetirement.length) * 100
      : 0

  return { years, successRate, simulations }
}

export function runDeterministicProjection(
  accounts: Account[],
  profile: UserProfile,
  assumptions: ProjectionAssumptions
): ProjectionYear[] {
  const startBalance = getStartingBalance(accounts)
  let balance = startBalance
  let monthlyContrib = getMonthlyContributions(accounts)
  const horizon = profile.lifeExpectancy - profile.currentAge
  const nominalReturn = assumptions.annualReturnRate / 100
  const inflation = assumptions.inflationRate / 100
  const points: ProjectionYear[] = []

  for (let y = 0; y <= horizon; y++) {
    const inflationFactor = Math.pow(1 + inflation, y)
    points.push({
      age: profile.currentAge + y,
      year: new Date().getFullYear() + y,
      median: balance,
      best: balance * 1.15,
      worst: balance * 0.85,
      medianReal: balance / inflationFactor,
      bestReal: (balance * 1.15) / inflationFactor,
      worstReal: (balance * 0.85) / inflationFactor,
    })

    if (y < horizon) {
      balance = balance * (1 + nominalReturn) + monthlyContrib * 12
      monthlyContrib *= 1 + assumptions.contributionGrowthRate / 100
    }
  }

  return points
}

export interface NetWorthGrowthPoint {
  age: number
  nominal: number
  real: number
}

export function buildNetWorthGrowthSeries(
  accounts: Account[],
  profile: UserProfile,
  assumptions: ProjectionAssumptions
): NetWorthGrowthPoint[] {
  return runDeterministicProjection(accounts, profile, assumptions).map((p) => ({
    age: p.age,
    nominal: p.median,
    real: p.medianReal,
  }))
}

export { getStartingBalance, getMonthlyContributions }
