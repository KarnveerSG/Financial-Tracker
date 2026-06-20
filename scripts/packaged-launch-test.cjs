const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const EXE = process.env.MIDNIGHT_LEDGER_EXE ?? "E:\\Applications\\Midnight Ledger.exe";
const logPath = path.join(os.homedir(), "AppData", "Roaming", "MidnightLedger", "Logs", "app.log");

if (!fs.existsSync(EXE)) {
  console.error(`FAIL  missing exe: ${EXE}`);
  process.exit(1);
}

const beforeSize = fs.statSync(EXE).size;
console.log(`INFO  exe ${EXE} (${beforeSize} bytes)`);

const child = spawn(EXE, [], {
  detached: false,
  stdio: "ignore",
  windowsHide: true,
});

let exited = false;
child.on("exit", (code) => {
  exited = true;
  if (code !== 0) console.error(`FAIL  packaged exe exited early code=${code}`);
});

setTimeout(() => {
  if (exited) {
    process.exit(1);
    return;
  }

  const logTail = fs.existsSync(logPath)
    ? fs.readFileSync(logPath, "utf8").split("\n").slice(-20).join("\n")
    : "";

  if (logTail.includes("App ready") || logTail.includes("Page loaded")) {
    console.log("PASS  packaged exe launched and logged ready");
  } else {
    console.log("PASS  packaged exe process running");
    if (logTail) console.log(logTail);
  }

  child.kill();
  setTimeout(() => process.exit(0), 500);
}, 8000);

child.on("error", (err) => {
  console.error(`FAIL  spawn: ${err.message}`);
  process.exit(1);
});
