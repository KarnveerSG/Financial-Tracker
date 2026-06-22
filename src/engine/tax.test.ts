import { describe, expect, it } from 'vitest'
import {
  analyzeRothVsTraditional,
  estimateRMD,
  estimateSocialSecurityBenefit,
  rothConversionAnalysis,
  calculateMedicareTax,
} from './tax'

describe('analyzeRothVsTraditional', () => {
  it('ties when current and retirement tax rates match', () => {
    const result = analyzeRothVsTraditional(6000, 25, 22, 22, 7)
    expect(result.winner).toBe('tie')
  })

  it('favors Roth when retirement tax rate exceeds current', () => {
    const result = analyzeRothVsTraditional(6000, 25, 22, 28, 7)
    expect(result.winner).toBe('roth')
  })

  it('favors Traditional when retirement tax rate is lower than current', () => {
    const result = analyzeRothVsTraditional(6000, 25, 28, 15, 7)
    expect(result.winner).toBe('traditional')
  })
})

describe('estimateRMD', () => {
  it('returns 0 below age 73', () => {
    expect(estimateRMD(100000, 72)).toBe(0)
  })

  it('uses full IRS table for intermediate ages', () => {
    expect(estimateRMD(100000, 76)).toBeCloseTo(100000 / 23.7, 2)
    expect(estimateRMD(100000, 79)).toBeCloseTo(100000 / 21.1, 2)
  })
})

describe('estimateSocialSecurityBenefit', () => {
  it('uses bend-point formula not flat 40%', () => {
    const benefit = estimateSocialSecurityBenefit(80000, 67)
    const naive = (80000 / 12) * 0.4 * 12
    expect(benefit).not.toBeCloseTo(naive, -2)
    expect(benefit).toBeGreaterThan(0)
  })

  it('reduces benefit for early retirement', () => {
    const at67 = estimateSocialSecurityBenefit(100000, 67)
    const at62 = estimateSocialSecurityBenefit(100000, 62)
    expect(at62).toBeLessThan(at67)
  })
})

describe('rothConversionAnalysis', () => {
  it('computes breakeven from tax equation not heuristic', () => {
    const result = rothConversionAnalysis(50000, 22, 20, 7, 18)
    expect(result.breakevenYears).not.toBe(20 * 0.6)
    expect(result.breakevenYears).not.toBe(20 * 1.2)
    expect(result.taxNow).toBeCloseTo(11000, 0)
  })
})

describe('calculateMedicareTax', () => {
  it('uses $250k threshold for married_joint additional tax', () => {
    const single = calculateMedicareTax(260000, 'single')
    const joint = calculateMedicareTax(260000, 'married_joint')
    expect(joint).toBeLessThan(single)
  })
})
