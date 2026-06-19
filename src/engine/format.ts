import type { Currency } from '../types'

export function createId(): string {
  return crypto.randomUUID()
}

export function formatCurrency(value: number, currency: Currency = 'USD'): string {
  const locales: Record<Currency, string> = {
    USD: 'en-US',
    CAD: 'en-CA',
    EUR: 'de-DE',
    GBP: 'en-GB',
  }
  return new Intl.NumberFormat(locales[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCurrencyPrecise(value: number, currency: Currency = 'USD'): string {
  const locales: Record<Currency, string> = {
    USD: 'en-US',
    CAD: 'en-CA',
    EUR: 'de-DE',
    GBP: 'en-GB',
  }
  return new Intl.NumberFormat(locales[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function randomNormal(mean: number, stdDev: number): number {
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z * stdDev
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}
