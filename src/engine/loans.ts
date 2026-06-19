import type { Account } from '../types'
import { resolveAccountBalance } from './accounts'

export interface LoanInterestSummary {
  annualInterest: number
  totalInterestRemaining: number
  totalCost: number
  monthlyPayment: number
}

export function calculateLoanInterest(account: Account): LoanInterestSummary {
  const balance = resolveAccountBalance(account)
  const monthlyPayment = account.monthlyContribution
  const annualInterest = balance * (account.interestRate / 100)

  if (
    account.interestRate <= 0 ||
    account.loanTermMonths <= 0 ||
    monthlyPayment <= 0 ||
    balance <= 0
  ) {
    return {
      annualInterest,
      totalInterestRemaining: 0,
      totalCost: balance,
      monthlyPayment,
    }
  }

  const monthlyRate = account.interestRate / 100 / 12
  let remaining = balance
  let totalInterest = 0
  let payment = monthlyPayment

  for (let month = 0; month < account.loanTermMonths && remaining > 0.01; month++) {
    const interestPortion = remaining * monthlyRate
    const principalPortion = Math.min(payment - interestPortion, remaining)
    if (principalPortion <= 0) break
    totalInterest += interestPortion
    remaining -= principalPortion
    if (month > 0 && month % 12 === 0 && account.contributionIncreaseRate > 0) {
      payment *= 1 + account.contributionIncreaseRate / 100
    }
  }

  return {
    annualInterest,
    totalInterestRemaining: totalInterest,
    totalCost: balance + totalInterest,
    monthlyPayment,
  }
}

export function sumDebtInterest(accounts: Account[]): number {
  return accounts
    .filter((a) => a.isLiability)
    .reduce((sum, a) => sum + calculateLoanInterest(a).annualInterest, 0)
}
