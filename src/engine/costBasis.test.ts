import { describe, expect, it } from 'vitest'
import type { Account } from '../types'
import { createDefaultAccount } from './accounts'
import {
  computeHoldingGainLoss,
  aggregateGainLoss,
} from './costBasis'

describe('computeHoldingGainLoss', () => {
  it('splits short-term and long-term for multiple lots', () => {
    const holding = {
      id: 'h1',
      ticker: 'AAPL',
      shares: 15,
      pricePerShare: 200,
      lots: [
        { id: 'l1', shares: 10, costPerShare: 150, acquiredDate: '2023-01-01' },
        { id: 'l2', shares: 5, costPerShare: 180, acquiredDate: '2025-03-01' },
      ],
    }

    const gl = computeHoldingGainLoss(holding, 200, '2025-06-01')

    expect(gl.totalCost).toBeCloseTo(2400)
    expect(gl.marketValue).toBeCloseTo(3000)
    expect(gl.unrealizedGain).toBeCloseTo(600)
    expect(gl.unrealizedGainPct).toBeCloseTo(0.25)
    expect(gl.shortTermShares).toBeCloseTo(5)
    expect(gl.longTermShares).toBeCloseTo(10)
    expect(gl.shortTermGain).toBeCloseTo(100)
    expect(gl.longTermGain).toBeCloseTo(500)
  })

  it('buckets lots without acquiredDate as unknown term', () => {
    const holding = {
      id: 'h1',
      ticker: 'VTI',
      shares: 10,
      pricePerShare: 100,
      lots: [{ id: 'l1', shares: 10, costPerShare: 90, acquiredDate: '' }],
    }
    const gl = computeHoldingGainLoss(holding, 100)
    expect(gl.unknownTermShares).toBe(10)
    expect(gl.shortTermShares).toBe(0)
    expect(gl.longTermShares).toBe(0)
  })

  it('defaults implicit single lot to today for term classification', () => {
    const holding = {
      id: 'h1',
      ticker: 'VTI',
      shares: 10,
      pricePerShare: 100,
    }
    const gl = computeHoldingGainLoss(holding, 110, '2025-06-01')
    expect(gl.shortTermShares).toBe(10)
    expect(gl.unknownTermShares).toBe(0)
  })
})

describe('aggregateGainLoss', () => {
  it('aggregates per ticker across accounts', () => {
    const accounts: Account[] = [
      createDefaultAccount({
        name: 'Brokerage',
        accountType: 'brokerage',
        balance: 10000,
        holdings: [{ id: 'h1', ticker: 'AAPL', shares: 10, pricePerShare: 200 }],
      }),
      createDefaultAccount({
        name: 'IRA',
        accountType: 'roth_ira',
        balance: 5000,
        holdings: [{ id: 'h2', ticker: 'AAPL', shares: 5, pricePerShare: 200 }],
      }),
    ]

    const result = aggregateGainLoss(accounts)
    expect(result.perTicker).toHaveLength(1)
    expect(result.perTicker[0].totalShares).toBe(15)
    expect(result.perTicker[0].marketValue).toBe(3000)
  })
})
