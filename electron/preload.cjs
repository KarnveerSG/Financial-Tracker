const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  fetchQuotes: (provider, tickers, keys) =>
    ipcRenderer.invoke('quotes:fetch', provider, tickers, keys),
})
