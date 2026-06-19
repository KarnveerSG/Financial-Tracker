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
})
