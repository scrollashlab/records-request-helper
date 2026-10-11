// Monitor: confirm the National Archives pages still say what config/facts.json
// encodes. If a phrase disappears, the job fails, the Pipeline Medic flow opens an
// issue, and the Issue-to-MR flow proposes the update.
import { readFile, writeFile, mkdir } from "node:fs/promises";

export function normalize(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#36;|&dollar;/g, "$")
    .replace(/&rsquo;|&#8217;/g, "'")
    .replace(/\s+/g, " ");
}

export function check(text, phrases) {
  return phrases.filter((p) => !text.includes(p));
}

async function main() {
  const facts = JSON.parse(await readFile("config/facts.json", "utf8"));
  const results = [];
  for (const src of facts.sources) {
    const res = await fetch(src.url, { headers: { "user-agent": "records-request-helper source-drift monitor" } });
    const text = normalize(await res.text());
    const missing = res.ok ? check(text, src.mustContain) : src.mustContain;
    results.push({ url: src.url, status: res.status, missing });
  }
  await mkdir("reports", { recursive: true });
  await writeFile("reports/source-drift.json", JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  const drift = results.filter((r) => r.missing.length);
  for (const r of results) console.log(`${r.missing.length ? "DRIFT" : "ok   "} ${r.url}${r.missing.length ? ` missing: ${r.missing.map((m) => JSON.stringify(m)).join(", ")}` : ""}`);
  if (drift.length) {
    console.log("Source drift detected: the National Archives guidance changed. config/facts.json needs review.");
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
