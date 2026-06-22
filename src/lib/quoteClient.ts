import { isElectronFile } from '../lib/isElectron'
import type { PriceQuote, QuoteProviderId } from '../types'
import { createQuoteProvider } from '../engine/prices'

declare global {
  interface Window {
    electronAPI?: {
      fetchQuotes: (provider: QuoteProviderId, tickers: string[], keys: { alphaVantageKey?: string; finnhubKey?: string }) => Promise<Record<string, PriceQuote>>
    }
  }
}

export async function fetchQuotes(
  provider: QuoteProviderId,
  tickers: string[],
  keys: { alphaVantageKey?: string; finnhubKey?: string }
): Promise<Record<string, PriceQuote>> {
  const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))]
  if (unique.length === 0) return {}

  if (window.electronAPI?.fetchQuotes) {
    return window.electronAPI.fetchQuotes(provider, unique, keys)
  }

  if (provider === 'yahoo' || provider === 'stooq') {
    if (!import.meta.env.DEV && !isElectronFile) {
      throw new Error('Live Yahoo/Stooq prices require Electron or dev proxy. Use Alpha Vantage or Finnhub with an API key in Settings.')
    }
  }

  if ((provider === 'alphavantage' && !keys.alphaVantageKey) || (provider === 'finnhub' && !keys.finnhubKey)) {
    throw new Error('API key required for selected quote provider')
  }

  const quoteProvider = createQuoteProvider(provider, fetch.bind(window), keys)
  return quoteProvider.fetchQuotes(unique)
}
