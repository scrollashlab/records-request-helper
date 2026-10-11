// Monitor: the live site responds, serves the current facts version and the app script.
const base = (process.env.SITE_URL || process.argv[2] || "").replace(/\/$/, "");
if (!base) {
  console.error("SITE_URL is not set");
  process.exit(2);
}
const expectVersion = process.env.EXPECT_FACTS_VERSION;
const failures = [];
async function get(path) {
  const t = Date.now();
  const res = await fetch(`${base}/${path}`, { headers: { "cache-control": "no-cache" } });
  const ms = Date.now() - t;
  if (!res.ok) failures.push(`${path}: HTTP ${res.status}`);
  if (ms > 3000) failures.push(`${path}: slow (${ms} ms)`);
  return res;
}
// Pages deployments take a moment to go live; retry the first request.
let first;
for (let i = 0; i < 12; i++) {
  first = await fetch(`${base}/build.json`, { headers: { "cache-control": "no-cache" } }).catch(() => null);
  const b = first?.ok ? await first.json().catch(() => ({})) : {};
  if (!process.env.CI_COMMIT_SHA || b.commit === process.env.CI_COMMIT_SHA) break;
  await new Promise((r) => setTimeout(r, 15000));
}
const html = await (await get("index.html")).text();
if (!html.includes("Military Records Request Helper")) failures.push("index: title missing");
const facts = await (await get("facts.json")).json().catch(() => ({}));
if (expectVersion && facts.version !== expectVersion) failures.push(`facts.json: version ${facts.version}, expected ${expectVersion}`);
await get("app.js");
await get("rules.js");
if (failures.length) {
  console.error(`Smoke check failed for ${base}:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`Smoke check passed for ${base} (facts ${facts.version}).`);
