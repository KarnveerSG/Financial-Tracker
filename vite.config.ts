import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Vite adds crossorigin to bundled assets; that breaks Electron file:// loads. */
function electronHtml(): Plugin {
  return {
    name: 'electron-html',
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin /g, '<script type="module" ')
        .replace(/<link rel="stylesheet" crossorigin /g, '<link rel="stylesheet" ')
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), electronHtml()],
  build: {
    modulePreload: false,
  },
  server: {
    proxy: {
      '/api/quote/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/quote\/yahoo/, '/v7/finance/quote'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const url = new URL(req.url ?? '', 'http://localhost')
            const symbols = url.searchParams.get('symbols')
            if (symbols) {
              proxyReq.path = `/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`
            }
          })
        },
      },
      '/api/quote/stooq': {
        target: 'https://stooq.com',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const url = new URL(req.url ?? '', 'http://localhost')
            const symbols = url.searchParams.get('symbols')
            if (symbols) {
              proxyReq.path = `/q/l/?s=${symbols}&f=sd2t2ohlcv&h&e=csv`
            }
          })
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
