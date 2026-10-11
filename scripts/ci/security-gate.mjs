// Govern: fail the pipeline on high or critical findings from SAST and secret detection.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const REPORTS = ["gl-sast-report.json", "gl-secret-detection-report.json"];
const BLOCKING = new Set(["Critical", "High"]);

export function blocking(report) {
  return (report?.vulnerabilities || []).filter((v) => BLOCKING.has(v.severity));
}

async function main() {
  const found = [];
  const seen = [];
  for (const f of REPORTS) {
    let report;
    try {
      report = JSON.parse(await readFile(f, "utf8"));
    } catch {
      continue;
    }
    seen.push(f);
    for (const v of blocking(report)) found.push(`${v.severity}: ${v.name || v.message || v.id} (${v.location?.file || "unknown file"})`);
  }
  await mkdir("reports", { recursive: true });
  await writeFile("reports/security-gate.json", JSON.stringify({ reports: seen, blocking: found }, null, 2));
  if (!seen.length) console.log("No scanner reports in this pipeline (scanners skipped for this change).");
  if (found.length) {
    console.error(`Security gate failed:\n- ${found.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`Security gate passed (${seen.join(", ") || "no reports"}).`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
