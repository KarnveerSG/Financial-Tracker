/// <reference types="vite/client" />

interface ElectronAPI {
  fetchQuotes: (
    provider: string,
    tickers: string[],
    keys: { alphaVantageKey?: string; finnhubKey?: string }
  ) => Promise<Record<string, import('./types').PriceQuote>>
}

interface Window {
  electronAPI?: ElectronAPI
}

export {}
