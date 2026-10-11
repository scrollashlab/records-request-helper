import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { audit } from "../scripts/ci/a11y-check.mjs";
import { validateFacts, validateFlags } from "../scripts/ci/config-check.mjs";
import { factsAgeDays, mrLinksIssue, unsignedCommits } from "../scripts/ci/policy-check.mjs";
import { blocking } from "../scripts/ci/security-gate.mjs";
import { jobEmbodiedGrams, jobEnergyKwh, report } from "../scripts/ci/sci.mjs";
import { check, normalize } from "../scripts/ci/source-drift.mjs";

const sciCfg = JSON.parse(readFileSync(new URL("../config/sci.json", import.meta.url)));

test("SCI energy for one runner-hour matches the CCF-based hand calculation", () => {
  // 2 vCPU * (0.71 + 0.5 * 3.55) W = 4.97 W; 8 GB * 0.392 W = 3.136 W; * PUE 1.1
  assert.ok(Math.abs(jobEnergyKwh(60, sciCfg) - 0.0089166) < 1e-6);
  // 1000 kg * (2/32) / (4 * 8760 h)
  assert.ok(Math.abs(jobEmbodiedGrams(60, sciCfg) - 1.7837) < 1e-3);
});

test("SCI report counts skipped jobs as savings", () => {
  const r = report([{ name: "lint", minutes: 0.6 }, { name: "test", minutes: 0.8 }], sciCfg);
  assert.ok(r.savedPercent > 50);
  assert.ok(r.jobsSkipped.includes("semgrep-sast"));
  assert.ok(r.sciGramsPerPipeline > 0);
});

test("source-drift normalizes HTML and reports missing phrases", () => {
  const text = normalize("<p>A routine OMPF of 6 pages or more: <b>&#36;70 flat fee</b></p><script>x</script>");
  assert.deepEqual(check(text, ["$70 flat fee", "$25 flat fee"]), ["$25 flat fee"]);
});

test("policy: issue links and DCO sign-off", () => {
  assert.ok(mrLinksIssue("Closes #12"));
  assert.ok(mrLinksIssue("This fixes #3 for good"));
  assert.ok(!mrLinksIssue("Small tweak"));
  const log = "aaaa1111\x1fFix\n\nSigned-off-by: A B <a@b.c>\n\x1ebbbb2222\x1fNo sign\n\x1e";
  assert.deepEqual(unsignedCommits(log), ["bbbb2222"]);
  assert.equal(factsAgeDays("2026-10-01", new Date("2026-10-11T00:00:00Z")), 10);
});

test("config: flags and facts schemas", () => {
  assert.deepEqual(validateFlags({ showCoverLetter: true, showFireCheck: false, showSources: true }), []);
  assert.equal(validateFlags({ showCoverLetter: "yes" }).length, 3);
  const facts = JSON.parse(readFileSync(new URL("../config/facts.json", import.meta.url)));
  assert.deepEqual(validateFacts(facts), []);
  assert.ok(validateFacts({ ...facts, version: "v1" }).length === 1);
});

test("a11y: the shipped page passes and an unlabeled input fails", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.deepEqual(audit(html), []);
  assert.ok(audit('<html lang="en"><title>x</title><meta name="viewport"><input id="q"></html>').some((p) => /no label/.test(p)));
});

test("security gate blocks only high and critical findings", () => {
  const r = { vulnerabilities: [{ severity: "Critical" }, { severity: "High" }, { severity: "Medium" }, { severity: "Low" }] };
  assert.equal(blocking(r).length, 2);
  assert.equal(blocking({}).length, 0);
});

test("SCI baseline depends on pipeline type", () => {
  const mr = report([{ name: "policy-check", minutes: 0.5 }], sciCfg, "merge_request_event");
  assert.ok(mr.jobsSkipped.includes("review-app"));
  assert.ok(!mr.jobsSkipped.includes("pages"));
  const sched = report([{ name: "smoke", minutes: 0.4 }, { name: "source-drift", minutes: 0.5 }], sciCfg, "schedule");
  assert.equal(sched.savedGrams, 0);
});
