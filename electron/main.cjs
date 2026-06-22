const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const appData =
  process.env.APPDATA ||
  path.join(process.env.USERPROFILE || process.env.HOME || "", "AppData", "Roaming");
const midnightBase = path.join(appData, "MidnightLedger");
const runtimeDir = path.join(midnightBase, "Runtime");
const logDir = path.join(midnightBase, "Logs");
const logPath = path.join(logDir, "app.log");

process.env.PORTABLE_EXECUTABLE_DIR = runtimeDir;

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

ensureDir(runtimeDir);
ensureDir(path.join(midnightBase, "User Data"));
ensureDir(path.join(midnightBase, "Temp"));
ensureDir(path.join(midnightBase, "Cache"));
ensureDir(logDir);
ensureDir(path.join(midnightBase, "CrashDumps"));

app.setPath("userData", path.join(midnightBase, "User Data"));
app.setPath("temp", path.join(midnightBase, "Temp"));
app.setPath("cache", path.join(midnightBase, "Cache"));
app.setPath("logs", logDir);
app.setPath("crashDumps", path.join(midnightBase, "CrashDumps"));

const writeLog = (level, message) => {
  const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
  try {
    fs.appendFileSync(logPath, line);
  } catch {
    // ignore log write failures
  }
  if (level === "ERROR") console.error(message);
  else console.log(message);
};

async function fetchQuotesFromProvider(provider, tickers, keys) {
  const unique = [...new Set((tickers || []).map((t) => String(t).trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return {};

  if (provider === "yahoo") {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(unique.join(","))}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const data = await res.json();
    const quotes = {};
    for (const row of data?.quoteResponse?.result ?? []) {
      if (!row?.symbol || row.regularMarketPrice == null) continue;
      const ticker = row.symbol.toUpperCase();
      quotes[ticker] = {
        ticker,
        price: row.regularMarketPrice,
        currency: row.currency || "USD",
        asOf: row.regularMarketTime
          ? new Date(row.regularMarketTime * 1000).toISOString()
          : new Date().toISOString(),
        source: "yahoo",
      };
    }
    return quotes;
  }

  if (provider === "stooq") {
    const symbols = unique.map((t) => `${t.toLowerCase()}.us`).join(",");
    const url = `https://stooq.com/q/l/?s=${symbols}&f=sd2t2ohlcv&h&e=csv`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Stooq ${res.status}`);
    const text = await res.text();
    const quotes = {};
    const lines = text.trim().split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",");
      const symbol = parts[0]?.replace(".US", "").toUpperCase();
      const close = parseFloat(parts[6]);
      if (!symbol || !Number.isFinite(close)) continue;
      quotes[symbol] = {
        ticker: symbol,
        price: close,
        currency: "USD",
        asOf: new Date().toISOString(),
        source: "stooq",
      };
    }
    return quotes;
  }

  if (provider === "alphavantage" && keys?.alphaVantageKey) {
    const quotes = {};
    for (const ticker of unique) {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(keys.alphaVantageKey)}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const price = parseFloat(data?.["Global Quote"]?.["05. price"] ?? "");
      if (!Number.isFinite(price)) continue;
      quotes[ticker] = {
        ticker,
        price,
        currency: "USD",
        asOf: new Date().toISOString(),
        source: "alphavantage",
      };
    }
    return quotes;
  }

  if (provider === "finnhub" && keys?.finnhubKey) {
    const quotes = {};
    for (const ticker of unique) {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(keys.finnhubKey)}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.c == null || !Number.isFinite(data.c)) continue;
      quotes[ticker] = {
        ticker,
        price: data.c,
        currency: "USD",
        asOf: data.t ? new Date(data.t * 1000).toISOString() : new Date().toISOString(),
        source: "finnhub",
      };
    }
    return quotes;
  }

  throw new Error(`Unsupported provider or missing API key: ${provider}`);
}

ipcMain.handle("quotes:fetch", async (_event, provider, tickers, keys) => {
  try {
    return await fetchQuotesFromProvider(provider, tickers, keys);
  } catch (err) {
    writeLog("ERROR", `quotes:fetch failed: ${err?.stack || err}`);
    throw err;
  }
});

const createWindow = () => {
  writeLog("INFO", "Creating main window");

  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    writeLog("RENDERER", `${level} ${sourceId}:${line} ${message}`);
  });

  win.webContents.on("did-finish-load", () => {
    writeLog("INFO", `Page loaded: ${win.webContents.getURL()}`);
  });

  win.webContents.on("did-fail-load", (_event, code, desc, url) => {
    writeLog("ERROR", `Page load failed: ${code} ${desc} ${url}`);
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    writeLog("ERROR", `Render process gone: ${details.reason}`);
  });

  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  writeLog("INFO", `Loading ${indexPath}`);

  win.loadFile(indexPath).catch((err) => {
    writeLog("ERROR", `Failed to load index.html: ${indexPath} ${err.stack || err}`);
  });
};

app.whenReady().then(() => {
  writeLog("INFO", `App ready (electron ${process.versions.electron})`);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  writeLog("INFO", "All windows closed");
  if (process.platform !== "darwin") app.quit();
});

process.on("uncaughtException", (err) => {
  writeLog("ERROR", `uncaughtException: ${err.stack || err}`);
});

process.on("unhandledRejection", (reason) => {
  writeLog("ERROR", `unhandledRejection: ${reason?.stack || reason}`);
});
