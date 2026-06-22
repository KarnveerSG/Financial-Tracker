import type { PriceQuote, QuoteProviderId } from '../types'

export interface QuoteProvider {
  id: QuoteProviderId
  fetchQuotes(tickers: string[]): Promise<Record<string, PriceQuote>>
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

export class YahooQuoteProvider implements QuoteProvider {
  id: QuoteProviderId = 'yahoo'

  constructor(private fetchFn: typeof fetch) {}

  async fetchQuotes(tickers: string[]): Promise<Record<string, PriceQuote>> {
    const symbols = tickers.map(normalizeTicker).filter(Boolean)
    if (symbols.length === 0) return {}

    const url = `/api/quote/yahoo?symbols=${encodeURIComponent(symbols.join(','))}`
    const res = await this.fetchFn(url)
    if (!res.ok) throw new Error(`Yahoo quote failed: ${res.status}`)

    const data = (await res.json()) as {
      quoteResponse?: {
        result?: Array<{
          symbol?: string
          regularMarketPrice?: number
          currency?: string
          regularMarketTime?: number
        }>
      }
    }

    const quotes: Record<string, PriceQuote> = {}
    for (const row of data.quoteResponse?.result ?? []) {
      if (!row.symbol || row.regularMarketPrice == null) continue
      const ticker = normalizeTicker(row.symbol)
      quotes[ticker] = {
        ticker,
        price: row.regularMarketPrice,
        currency: row.currency ?? 'USD',
        asOf: row.regularMarketTime
          ? new Date(row.regularMarketTime * 1000).toISOString()
          : new Date().toISOString(),
        source: 'yahoo',
      }
    }
    return quotes
  }
}

export class StooqQuoteProvider implements QuoteProvider {
  id: QuoteProviderId = 'stooq'

  constructor(private fetchFn: typeof fetch) {}

  async fetchQuotes(tickers: string[]): Promise<Record<string, PriceQuote>> {
    const symbols = tickers.map((t) => `${normalizeTicker(t).toLowerCase()}.us`).filter(Boolean)
    if (symbols.length === 0) return {}

    const url = `/api/quote/stooq?symbols=${encodeURIComponent(symbols.join(','))}`
    const res = await this.fetchFn(url)
    if (!res.ok) throw new Error(`Stooq quote failed: ${res.status}`)

    const text = await res.text()
    const quotes: Record<string, PriceQuote> = {}
    const lines = text.trim().split(/\r?\n/)
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',')
      if (parts.length < 7) continue
      const symbol = parts[0]?.replace('.US', '').toUpperCase()
      const close = parseFloat(parts[6])
      if (!symbol || !Number.isFinite(close)) continue
      quotes[symbol] = {
        ticker: symbol,
        price: close,
        currency: 'USD',
        asOf: new Date().toISOString(),
        source: 'stooq',
      }
    }
    return quotes
  }
}

export class AlphaVantageQuoteProvider implements QuoteProvider {
  id: QuoteProviderId = 'alphavantage'

  constructor(
    private apiKey: string,
    private fetchFn: typeof fetch
  ) {}

  async fetchQuotes(tickers: string[]): Promise<Record<string, PriceQuote>> {
    const quotes: Record<string, PriceQuote> = {}
    for (const ticker of tickers.map(normalizeTicker).filter(Boolean)) {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(this.apiKey)}`
      const res = await this.fetchFn(url)
      if (!res.ok) continue
      const data = (await res.json()) as { 'Global Quote'?: Record<string, string> }
      const gq = data['Global Quote']
      const price = parseFloat(gq?.['05. price'] ?? '')
      if (!Number.isFinite(price)) continue
      quotes[ticker] = {
        ticker,
        price,
        currency: 'USD',
        asOf: new Date().toISOString(),
        source: 'alphavantage',
      }
    }
    return quotes
  }
}

export class FinnhubQuoteProvider implements QuoteProvider {
  id: QuoteProviderId = 'finnhub'

  constructor(
    private apiKey: string,
    private fetchFn: typeof fetch
  ) {}

  async fetchQuotes(tickers: string[]): Promise<Record<string, PriceQuote>> {
    const quotes: Record<string, PriceQuote> = {}
    for (const ticker of tickers.map(normalizeTicker).filter(Boolean)) {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(this.apiKey)}`
      const res = await this.fetchFn(url)
      if (!res.ok) continue
      const data = (await res.json()) as { c?: number; t?: number }
      if (data.c == null || !Number.isFinite(data.c)) continue
      quotes[ticker] = {
        ticker,
        price: data.c,
        currency: 'USD',
        asOf: data.t ? new Date(data.t * 1000).toISOString() : new Date().toISOString(),
        source: 'finnhub',
      }
    }
    return quotes
  }
}

export function createQuoteProvider(
  id: QuoteProviderId,
  fetchFn: typeof fetch,
  keys: { alphaVantageKey?: string; finnhubKey?: string }
): QuoteProvider {
  switch (id) {
    case 'yahoo':
      return new YahooQuoteProvider(fetchFn)
    case 'stooq':
      return new StooqQuoteProvider(fetchFn)
    case 'alphavantage':
      return new AlphaVantageQuoteProvider(keys.alphaVantageKey ?? '', fetchFn)
    case 'finnhub':
      return new FinnhubQuoteProvider(keys.finnhubKey ?? '', fetchFn)
  }
}

export function isMarketHours(): boolean {
  const now = new Date()
  const day = now.getUTCDay()
  if (day === 0 || day === 6) return false
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const open = 14 * 60 + 30
  const close = 21 * 60
  return minutes >= open && minutes < close
}

export function getQuoteCacheTtlMs(): number {
  return isMarketHours() ? 15 * 60 * 1000 : 12 * 60 * 60 * 1000
}

export function isQuoteStale(asOf: string, now = Date.now()): boolean {
  const age = now - new Date(asOf).getTime()
  return age > 24 * 60 * 60 * 1000
}
