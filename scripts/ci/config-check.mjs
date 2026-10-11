// Configure: validate runtime configuration before it can ship.
import { readFile } from "node:fs/promises";

export const KNOWN_FLAGS = ["showCoverLetter", "showFireCheck", "showSources"];

export function validateFlags(flags) {
  const errors = [];
  for (const [k, v] of Object.entries(flags)) {
    if (!KNOWN_FLAGS.includes(k)) errors.push(`Unknown flag "${k}".`);
    if (typeof v !== "boolean") errors.push(`Flag "${k}" must be true or false.`);
  }
  for (const k of KNOWN_FLAGS) if (!(k in flags)) errors.push(`Missing flag "${k}".`);
  return errors;
}

export function validateFacts(f) {
  const errors = [];
  if (!/^\d{4}\.\d{2}\.\d{2}$/.test(f.version || "")) errors.push("facts.version must look like 2026.10.11.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.lastChecked || "")) errors.push("facts.lastChecked must be YYYY-MM-DD.");
  if (!Number.isInteger(f.archivalYears) || f.archivalYears < 1) errors.push("facts.archivalYears must be a positive integer.");
  for (const k of ["archivalUpTo5Pages", "archival6PagesOrMore", "nonArchivalVeteranOrNextOfKin"]) {
    if (typeof f.fees?.[k] !== "number") errors.push(`facts.fees.${k} must be a number.`);
  }
  for (const r of f.fire1973 || []) {
    if (!(new Date(r.from) < new Date(r.to))) errors.push(`fire1973 range for ${r.branch} is invalid.`);
  }
  if (!Array.isArray(f.nextOfKin) || f.nextOfKin.length < 1) errors.push("facts.nextOfKin must list relationships.");
  return errors;
}

async function main() {
  const flags = JSON.parse(await readFile("config/flags.json", "utf8"));
  const facts = JSON.parse(await readFile("config/facts.json", "utf8"));
  const errors = [...validateFlags(flags), ...validateFacts(facts)];
  if (errors.length) {
    console.error(`Configuration check failed:\n- ${errors.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`Configuration valid: ${Object.entries(flags).map(([k, v]) => `${k}=${v}`).join(", ")}; facts ${facts.version}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
