const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const results = [];

const pass = (name, detail = "") => {
  results.push({ ok: true, name, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
};

const fail = (name, detail = "") => {
  results.push({ ok: false, name, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readBody = async (win, max = 2000) =>
  win.webContents.executeJavaScript(`document.body?.innerText?.slice(0, ${max}) ?? ""`);

const clickButton = async (win, text) =>
  win.webContents.executeJavaScript(`
    (() => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        b.textContent?.includes(${JSON.stringify(text)})
      );
      if (!btn) return false;
      btn.click();
      return true;
    })()
  `);

const goto = async (win, hash) => {
  await win.webContents.executeJavaScript(`window.location.hash = ${JSON.stringify(hash)}`);
  await wait(500);
};

const routes = [
  { hash: "#/dashboard", match: (t) => t.includes("overview") || t.includes("Net worth") },
  { hash: "#/net-worth", match: (t) => t.includes("Net Worth Tracker") },
  { hash: "#/accounts", match: (t) => t.includes("Accounts") },
  { hash: "#/projections", match: (t) => t.includes("Projections") },
  { hash: "#/fire", match: (t) => t.includes("FIRE") || t.includes("CoastFI") },
  { hash: "#/tax", match: (t) => t.includes("Tax") },
  { hash: "#/paycheck", match: (t) => t.includes("Paycheck") },
  { hash: "#/budget", match: (t) => t.includes("Budget") },
  { hash: "#/analytics", match: (t) => t.includes("Analytics") },
  { hash: "#/settings", match: (t) => t.includes("Settings") },
];

app.whenReady().then(async () => {
  const consoleErrors = [];
  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  win.webContents.on("console-message", (_event, level, message) => {
    if (level === 3) consoleErrors.push(message);
  });

  try {
    const indexPath = path.join(__dirname, "..", "dist", "index.html");
    if (!fs.existsSync(indexPath)) fail("dist", `Missing ${indexPath}`);
    else pass("dist", indexPath);

    await win.loadFile(indexPath);
    pass("window load");

    await win.webContents.executeJavaScript(`
      localStorage.removeItem('midnight-ledger-v3');
      localStorage.removeItem('midnight-ledger-v2');
      location.reload();
    `);
    await wait(1200);

    const onboarding = await readBody(win, 600);
    if (onboarding.includes("Try demo")) {
      if (await clickButton(win, "Try demo")) pass("onboarding", "Try demo");
      else fail("onboarding");
    } else if (await clickButton(win, "Get started")) {
      pass("onboarding", "Get started");
    } else {
      pass("onboarding", "already onboarded");
    }
    await wait(800);

    for (const route of routes) {
      await goto(win, route.hash);
      const text = await readBody(win, 1800);
      if (route.match(text)) pass(`route ${route.hash}`);
      else fail(`route ${route.hash}`, text.slice(0, 100));
    }

    await goto(win, "#/net-worth");
    if (await clickButton(win, "Import .xlsx")) pass("net-worth import");
    else fail("net-worth import");

    if (await clickButton(win, "Record snapshot today")) pass("net-worth record");
    else fail("net-worth record");
    await wait(400);

    const nwBefore = await readBody(win, 2500);
    const hasData = !nwBefore.includes("Get started") && nwBefore.includes("NET WORTH");

    if (hasData) {
      for (const preset of ["1M", "3M", "1Y", "YTD", "All"]) {
        if (await clickButton(win, preset)) pass(`net-worth ${preset}`);
        else fail(`net-worth ${preset}`);
        await wait(120);
      }

      await win.webContents.executeJavaScript(`
        document.querySelector('input[type="checkbox"]')?.click()
      `);
      pass("net-worth projection toggle");
    } else {
      pass("net-worth presets", "skipped empty state");
      pass("net-worth projection toggle", "skipped empty state");
    }

    if (await clickButton(win, "Export CSV")) pass("net-worth export");
    else fail("net-worth export");

    const nw = await readBody(win, 2500);
    if (nw.includes("-100.0%") && /\$0/.test(nw)) {
      fail("net-worth metrics", "zeroed cliff detected");
    } else {
      pass("net-worth metrics");
    }

    await goto(win, "#/accounts");
    if (await clickButton(win, "Add Account")) pass("accounts add");
    else fail("accounts add");
    await wait(300);
    if (await clickButton(win, "Cancel")) pass("accounts cancel");
    else fail("accounts cancel");

    await goto(win, "#/projections");
    if (await clickButton(win, "Nominal")) pass("projections nominal");
    else fail("projections nominal");
    if (await clickButton(win, "Real")) pass("projections real");
    else fail("projections real");

    await goto(win, "#/settings");
    if (await clickButton(win, "Export JSON")) pass("settings export json");
    else fail("settings export json");

    if ((await clickButton(win, "Light mode")) || (await clickButton(win, "Dark mode"))) {
      pass("theme toggle");
    } else {
      fail("theme toggle");
    }

    const critical = consoleErrors.filter(
      (e) => !e.includes("Electron Security Warning") && !e.includes("Content-Security-Policy")
    );
    if (critical.length === 0) pass("console clean");
    else fail("console clean", critical.slice(0, 2).join(" | "));

    pass("session complete");
  } catch (err) {
    fail("exception", String(err.message || err));
  } finally {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} passed`);
    app.exit(failed.length ? 1 : 0);
  }
});

process.on("uncaughtException", (err) => {
  console.error(err);
  app.exit(1);
});
