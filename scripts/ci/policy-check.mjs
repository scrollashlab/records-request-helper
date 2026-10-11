// Govern: repository policy that every merge request must pass.
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const SECRET_PATTERNS = [
  /glpat-[A-Za-z0-9_-]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /AKIA[0-9A-Z]{16}/,
  // Built from parts so secret scanners do not mistake this pattern for a key.
  new RegExp("-----BEGIN (RSA |EC |OPENSSH )?" + "PRIVATE" + " KEY-----"),
];
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "reports", "metrics"]);

export function mrLinksIssue(description) {
  return /(close[sd]?|fix(e[sd])?|resolve[sd]?|refs?)\s+#\d+/i.test(description || "");
}

export function unsignedCommits(log) {
  // log: entries separated by \x1e, each "sha\x1fbody"
  return log
    .split("\x1e")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((e) => e.split("\x1f"))
    .filter(([, body]) => !/^Signed-off-by: .+ <.+>$/m.test(body || ""))
    .map(([sha]) => sha.slice(0, 8));
}

export function factsAgeDays(lastChecked, now = new Date()) {
  return Math.floor((now - new Date(`${lastChecked}T00:00:00Z`)) / 86400000);
}

async function* walk(dir) {
  for (const name of await readdir(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const s = await stat(p);
    if (s.isDirectory()) yield* walk(p);
    else yield { path: p, size: s.size };
  }
}

async function main() {
  const failures = [];
  const notes = [];

  const license = await readFile("LICENSE", "utf8").catch(() => "");
  if (!license.startsWith("MIT License")) failures.push("LICENSE must be the MIT License.");

  const facts = JSON.parse(await readFile("config/facts.json", "utf8"));
  const age = factsAgeDays(facts.lastChecked);
  if (age > 180) failures.push(`config/facts.json was last checked ${age} days ago (limit 180).`);
  if (!facts.sources?.length || facts.sources.some((s) => !s.url?.startsWith("https://www.archives.gov/") || !s.mustContain?.length)) {
    failures.push("Every fact source must be an archives.gov page with at least one mustContain phrase.");
  }

  for await (const f of walk(".")) {
    if (f.size > 1_000_000) failures.push(`${f.path} is larger than 1 MB.`);
    if (f.size > 200_000) continue;
    const text = await readFile(f.path, "utf8").catch(() => "");
    for (const re of SECRET_PATTERNS) if (re.test(text)) failures.push(`${f.path} looks like it contains a credential (${re.source.slice(0, 12)}…).`);
  }

  if (process.env.CI_MERGE_REQUEST_IID) {
    if (!mrLinksIssue(process.env.CI_MERGE_REQUEST_DESCRIPTION)) failures.push("The merge request description must link an issue (for example \"Closes #12\").");
    const base = process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA;
    if (base) {
      const log = execFileSync("git", ["log", "--no-merges", "--format=%H%x1f%B%x1e", `${base}..HEAD`], { encoding: "utf8" });
      const unsigned = unsignedCommits(log);
      if (unsigned.length) failures.push(`Commits without a DCO Signed-off-by line: ${unsigned.join(", ")}.`);
    }
  } else {
    notes.push("Not a merge request pipeline: skipped issue-link and DCO checks.");
  }

  await mkdir("reports", { recursive: true });
  await writeFile("reports/policy.json", JSON.stringify({ passed: !failures.length, failures, notes, factsAgeDays: age }, null, 2));
  for (const n of notes) console.log(n);
  if (failures.length) {
    console.error(`Policy check failed:\n- ${failures.join("\n- ")}`);
    process.exit(1);
  }
  console.log("Policy check passed: MIT license, fresh sourced facts, no credentials, issue link and DCO sign-off.");
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
