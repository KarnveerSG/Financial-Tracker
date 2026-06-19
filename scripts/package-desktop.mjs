import { execSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifactName = "Midnight Ledger.exe";
const projectLogDir = join(root, "logs");
const projectLogPath = join(projectLogDir, "package-desktop.log");

const log = (message) => {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  mkdirSync(projectLogDir, { recursive: true });
  appendFileSync(projectLogPath, `${line}\n`);
};

const run = (command, label) => {
  log(`START ${label}`);
  execSync(command, { stdio: "inherit", cwd: root, shell: true });
  log(`DONE ${label}`);
};

try {
  run("node scripts/make-icon.mjs", "make-icon");
  run("npm run build:win", "build:win");
  run("npx electron scripts/electron-smoke-test.cjs", "smoke-test");

  const src = join(root, "release", artifactName);
  if (!existsSync(src)) {
    log(`ERROR artifact missing: ${src}`);
    process.exit(1);
  }

  const dest = join(os.homedir(), "Desktop", artifactName);
  copyFileSync(src, dest);
  log(`COPIED ${dest}`);
  log("PASS package:desktop");
} catch (err) {
  log(`FAIL package:desktop: ${err.message}`);
  process.exit(1);
}
