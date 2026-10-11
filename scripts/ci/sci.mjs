// Software Carbon Intensity for this pipeline, per the Green Software Foundation
// SCI specification: SCI = ((E * I) + M) per R.
//
// Durations come from metrics/*.json files that every job writes in after_script
// (see .gitlab-ci.yml). If SCI_API_TOKEN (read_api) is set, exact durations for
// every job, including GitLab template jobs, are read from the Jobs API instead.
// Jobs that this pipeline skipped are counted as savings against a run-everything
// baseline, using the durations in config/sci.json.
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";

export function jobEnergyKwh(minutes, cfg) {
  const h = minutes / 60;
  const w = cfg.cpuWattsPerVcpu;
  const cpuW = cfg.runner.vcpu * (w.min + w.utilization * (w.max - w.min));
  const memKw = cfg.runner.memoryGb * cfg.memoryKwhPerGbHour; // kWh per hour = kW
  return ((cpuW / 1000 + memKw) * h) * cfg.pue;
}

export function jobEmbodiedGrams(minutes, cfg) {
  const share = cfg.runner.vcpu / cfg.runner.platformVcpu;
  const lifespanH = cfg.embodied.lifespanYears * 365 * 24;
  return cfg.embodied.serverKgCo2e * 1000 * share * (minutes / 60 / lifespanH);
}

export function sci(jobs, cfg) {
  let e = 0;
  let m = 0;
  for (const j of jobs) {
    e += jobEnergyKwh(j.minutes, cfg);
    m += jobEmbodiedGrams(j.minutes, cfg);
  }
  const grams = e * cfg.gridGramsPerKwh.value + m;
  return { energyKwh: e, embodiedGrams: m, grams };
}

export function baselineFor(source, cfg) {
  const b = cfg.baselineJobMinutes;
  return b[source] || b.push;
}

export function report(ran, cfg, source = "push") {
  const ranNames = new Set(ran.map((j) => j.name));
  const skipped = Object.entries(baselineFor(source, cfg))
    .filter(([name]) => !ranNames.has(name))
    .map(([name, minutes]) => ({ name, minutes }));
  const actual = sci(ran, cfg);
  const baseline = sci([...ran, ...skipped], cfg);
  const saved = baseline.grams - actual.grams;
  return {
    sciGramsPerPipeline: round(actual.grams, 3),
    energyKwh: round(actual.energyKwh, 6),
    embodiedGrams: round(actual.embodiedGrams, 3),
    runnerMinutes: round(ran.reduce((s, j) => s + j.minutes, 0), 2),
    baselineGrams: round(baseline.grams, 3),
    savedGrams: round(saved, 3),
    savedPercent: baseline.grams ? round((100 * saved) / baseline.grams, 1) : 0,
    jobsRan: ran.map((j) => j.name).sort(),
    jobsSkipped: skipped.map((j) => j.name).sort(),
    pipelineSource: source,
    method: cfg.method,
  };
}

const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

async function fromMetrics(dir) {
  const out = [];
  try {
    for (const f of await readdir(dir)) {
      if (!f.endsWith(".json")) continue;
      const j = JSON.parse(await readFile(`${dir}/${f}`, "utf8"));
      if (j.name && j.seconds >= 0) out.push({ name: j.name, minutes: j.seconds / 60 });
    }
  } catch {
    /* no metrics yet */
  }
  return out;
}

async function fromApi() {
  const { CI_API_V4_URL, CI_PROJECT_ID, CI_PIPELINE_ID, SCI_API_TOKEN, CI_JOB_NAME } = process.env;
  const res = await fetch(`${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/pipelines/${CI_PIPELINE_ID}/jobs?per_page=100`, {
    headers: { "PRIVATE-TOKEN": SCI_API_TOKEN },
  });
  if (!res.ok) throw new Error(`jobs API ${res.status}`);
  const jobs = await res.json();
  return jobs
    .filter((j) => j.name !== CI_JOB_NAME && j.duration != null)
    .map((j) => ({ name: j.name, minutes: j.duration / 60 }));
}

async function main() {
  const cfg = JSON.parse(await readFile("config/sci.json", "utf8"));
  let ran = process.env.SCI_API_TOKEN ? await fromApi().catch(() => null) : null;
  if (!ran) ran = await fromMetrics("metrics");
  const r = report(ran, cfg, process.env.CI_PIPELINE_SOURCE || "push");
  await mkdir("reports", { recursive: true });
  await writeFile("reports/sci.json", JSON.stringify(r, null, 2));
  await writeFile(
    "reports/metrics.txt",
    [`sci_grams_per_pipeline ${r.sciGramsPerPipeline}`, `sci_saved_percent ${r.savedPercent}`, `runner_minutes ${r.runnerMinutes}`].join("\n") + "\n",
  );
  console.log(`SCI: ${r.sciGramsPerPipeline} gCO2e for this pipeline (${r.runnerMinutes} runner-minutes).`);
  console.log(`Carbon saved vs run-everything baseline: ${r.savedGrams} g (${r.savedPercent}%). Skipped: ${r.jobsSkipped.join(", ") || "none"}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
