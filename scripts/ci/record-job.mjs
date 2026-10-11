// after_script helper: write this job's duration so the SCI job can total the pipeline.
import { mkdirSync, writeFileSync } from "node:fs";

const started = Date.parse(process.env.CI_JOB_STARTED_AT || "");
const seconds = Number.isFinite(started) ? Math.max(0, Math.round((Date.now() - started) / 1000)) : 0;
const name = process.env.CI_JOB_NAME || "local";
mkdirSync("metrics", { recursive: true });
writeFileSync(`metrics/${name.replace(/[^\w.-]+/g, "_")}.json`, JSON.stringify({ name, seconds }) + "\n");
