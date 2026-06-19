const { app, BrowserWindow } = require("electron");
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

const createWindow = () => {
  writeLog("INFO", "Creating main window");

  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
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
