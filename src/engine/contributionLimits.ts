import type { Account, PaycheckInputs } from '../types'

/** 2026 IRS contribution limits (best-effort defaults, editable in UI). */
export interface ContributionLimits {
  employee401k: number
  employee401kCatchUp50: number
  iraTotal: number
  iraCatchUp50: number
  hsaSelf: number
  hsaFamily: number
  hsaCatchUp55: number
  sepIraPercent: number
  soloEmployee: number
}

export const IRS_LIMITS_2026: ContributionLimits = {
  employee401k: 24500,
  employee401kCatchUp50: 8000,
  iraTotal: 7500,
  iraCatchUp50: 1100,
  hsaSelf: 4400,
  hsaFamily: 8750,
  hsaCatchUp55: 1000,
  sepIraPercent: 0.25,
  soloEmployee: 24500,
}

export interface ContributionUsage {
  bucket: '401k' | 'ira' | 'hsa'
  contributedYtd: number
  limit: number
  remaining: number
  percentUsed: number
  status: 'ok' | 'warn' | 'exceeded'
}

/** YTD-projected contributions from paycheck + monthly account contributions. */
export function estimateContributionUsage(
  paycheck: PaycheckInputs,
  accounts: Account[],
  age: number,
  hsaFamilyCoverage = false,
  limits: ContributionLimits = IRS_LIMITS_2026
): ContributionUsage[] {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const msElapsed = now.getTime() - startOfYear.getTime()
  const monthsElapsed = Math.max(1, msElapsed / (1000 * 60 * 60 * 24 * 30.44))

  // From paycheck (annual figures — pro-rate to YTD)
  const paycheck401k = (paycheck.pretax401k + paycheck.roth401k) * (monthsElapsed / 12)
  const paycheckHsa = paycheck.hsa * (monthsElapsed / 12)

  // From account monthly contributions × months elapsed
  const iraContrib = accounts
    .filter((a) => a.accountType === 'traditional_ira' || a.accountType === 'roth_ira')
    .reduce((sum, a) => sum + a.monthlyContribution * monthsElapsed, 0)
  const acctHsa = accounts
    .filter((a) => a.accountType === 'hsa')
    .reduce((sum, a) => sum + a.monthlyContribution * monthsElapsed, 0)

  const limit401k = limits.employee401k + (age >= 50 ? limits.employee401kCatchUp50 : 0)
  const limitIra = limits.iraTotal + (age >= 50 ? limits.iraCatchUp50 : 0)
  const limitHsa = (hsaFamilyCoverage ? limits.hsaFamily : limits.hsaSelf) + (age >= 55 ? limits.hsaCatchUp55 : 0)

  return [
    makeUsage('401k', paycheck401k, limit401k),
    makeUsage('ira', iraContrib, limitIra),
    makeUsage('hsa', paycheckHsa + acctHsa, limitHsa),
  ]
}

function makeUsage(bucket: ContributionUsage['bucket'], contributed: number, limit: number): ContributionUsage {
  const percentUsed = limit > 0 ? (contributed / limit) * 100 : 0
  const status: ContributionUsage['status'] = percentUsed >= 100 ? 'exceeded' : percentUsed >= 85 ? 'warn' : 'ok'
  return {
    bucket,
    contributedYtd: Math.round(contributed),
    limit,
    remaining: Math.max(0, limit - contributed),
    percentUsed,
    status,
  }
}
