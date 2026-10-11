// Verify: syntax-check every JavaScript file and parse every JSON file. No dependencies.
import { execFileSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const SKIP = new Set([".git", "node_modules", "dist", "reports", "metrics"]);
const failures = [];
async function walk(dir) {
  for (const name of await readdir(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) await walk(p);
    else if (/\.(m?js)$/.test(name)) {
      try {
        execFileSync(process.execPath, ["--check", p], { stdio: "pipe" });
      } catch (e) {
        failures.push(`${p}: ${String(e.stderr).split("\n").find((l) => l.includes("Error")) || "syntax error"}`);
      }
    } else if (name.endsWith(".json")) {
      try {
        JSON.parse(await readFile(p, "utf8"));
      } catch (e) {
        failures.push(`${p}: ${e.message}`);
      }
    }
  }
}
await walk(".");
if (failures.length) {
  console.error(`Lint failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("Lint passed.");
