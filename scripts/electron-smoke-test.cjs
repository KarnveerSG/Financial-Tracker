const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const appData =
  process.env.APPDATA ||
  path.join(process.env.USERPROFILE || process.env.HOME || "", "AppData", "Roaming");
const logDir = path.join(appData, "MidnightLedger", "Logs");
const logPath = path.join(logDir, "smoke-test.log");
const lines = [];

const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}`;
  lines.push(line);
  console.log(line);
};

const flush = () => {
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(logPath, `${lines.join("\n")}\n\n`);
};

const fail = (reason) => {
  log(`FAIL: ${reason}`);
  flush();
  throw new Error(reason);
};

const pass = () => {
  log("PASS: onboarding -> dashboard");
  flush();
  app.exit(0);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readBody = async (win, max = 800) =>
  win.webContents.executeJavaScript(`document.body?.innerText?.slice(0, ${max}) ?? ""`);

const waitFor = async (win, check, label, timeoutMs = 10000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return true;
    await wait(250);
  }
  log(`${label} timeout. body=${await readBody(win)}`);
  return false;
};

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });

    win.webContents.on("console-message", (_event, level, message) => {
      log(`renderer console ${level}: ${message}`);
    });

    win.webContents.on("did-fail-load", (_event, code, desc, url) => {
      log(`did-fail-load ${code} ${desc} ${url}`);
    });

    const indexPath = path.join(__dirname, "..", "dist", "index.html");
    log(`load ${indexPath}`);

    await win.loadFile(indexPath);

    const onboardingOk = await waitFor(
      win,
      async () => (await readBody(win)).includes("Get started"),
      "onboarding"
    );
    if (!onboardingOk) fail("onboarding screen never appeared");

    log("click Get started");
    await win.webContents.executeJavaScript(`
      [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Get started"))?.click()
    `);

    const dashboardOk = await waitFor(
      win,
      async () => {
        const text = await readBody(win, 1200);
        return (
          text.includes("Financial overview") ||
          text.includes("Net worth") ||
          text.includes("Dashboard")
        );
      },
      "dashboard"
    );
    if (!dashboardOk) fail("dashboard never appeared after Get started");

    pass();
  } catch (err) {
    if (!String(err.message).startsWith("FAIL:")) log(`ERROR: ${err.stack || err}`);
    app.exit(1);
  }
});

process.on("uncaughtException", (err) => {
  log(`uncaughtException: ${err.stack || err}`);
  flush();
  app.exit(1);
});
process.on("unhandledRejection", (err) => {
  log(`unhandledRejection: ${err?.stack || err}`);
  flush();
  app.exit(1);
});
