import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = join(root, "build", "icon.svg");
const destPath = join(root, "build", "icon.png");

const svg = readFileSync(svgPath);
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1024 },
  background: "#1a2332",
});
const png = resvg.render().asPng();
writeFileSync(destPath, png);
console.log(`Wrote ${destPath} (${png.length} bytes) from ${svgPath}`);
