import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { afterCutoff, assess, coverLetter, fireRisk, longDate, parseSeparation, separationText } from "../src/rules.js";

const facts = JSON.parse(readFileSync(new URL("../config/facts.json", import.meta.url)));
const today = new Date("2026-10-11T00:00:00Z");
const base = { relationship: "veteran", branch: "army", separation: "1990", knowsServiceNumber: true };

test("parses year, month and full dates", () => {
  assert.equal(parseSeparation("1968").precision, "year");
  assert.equal(parseSeparation("1968-05").date.toISOString().slice(0, 10), "1968-05-31");
  assert.equal(parseSeparation("1968-05-14").precision, "day");
  assert.equal(parseSeparation("1968-13"), null);
  assert.equal(parseSeparation("1968-02-30"), null);
  assert.equal(parseSeparation("May 1968"), null);
});

test("records 62+ years old are archival and open to anyone for a fee", () => {
  const r = assess({ ...base, relationship: "other", separation: "1955-06-01" }, facts, today);
  assert.equal(r.archival, true);
  assert.equal(r.access, "open");
  assert.match(r.cost, /\$25/);
  assert.match(r.cost, /\$70/);
});

test("non-archival records are free and complete for the veteran", () => {
  const r = assess(base, facts, today);
  assert.equal(r.archival, false);
  assert.equal(r.access, "full");
  assert.equal(r.opensOn, "2052-12-31");
});

test("next of kin needs the veteran to be deceased and proof of death", () => {
  const living = assess({ ...base, relationship: "next_of_kin", veteranDeceased: false }, facts, today);
  assert.equal(living.access, "limited");
  assert.ok(living.warnings.some((w) => /has died/.test(w)));
  const deceased = assess({ ...base, relationship: "next_of_kin", veteranDeceased: true }, facts, today);
  assert.equal(deceased.access, "full");
  assert.ok(deceased.needs.some((n) => /Proof of death/.test(n)));
});

test("the general public gets limited access to non-archival records", () => {
  const r = assess({ ...base, relationship: "other" }, facts, today);
  assert.equal(r.access, "limited");
});

test("a year-only date on the archival boundary is flagged", () => {
  const r = assess({ ...base, separation: "1964" }, facts, today);
  assert.equal(r.archival, false);
  assert.ok(r.warnings.some((w) => /becomes archival between January 1, 2026 and December 31, 2026/.test(w)));
});

test("1973 fire: Army 1912-1960 discharges are flagged", () => {
  const r = assess({ ...base, separation: "1946-03-02" }, facts, today);
  assert.equal(r.fire.affected, "likely");
  assert.ok(r.needs.includes("Last unit of assignment"));
  assert.equal(assess({ ...base, separation: "1961" }, facts, today).fire, null);
});

test("1973 fire: Air Force only names after Hubbard, James E.", () => {
  const sep = parseSeparation("1955-01-01");
  assert.equal(fireRisk({ branch: "air_force", separation: sep, nameInService: "Adams, John" }, facts), null);
  assert.equal(fireRisk({ branch: "air_force", separation: sep, nameInService: "Young, Ann" }, facts).affected, "likely");
  assert.equal(fireRisk({ branch: "air_force", separation: sep, nameInService: "" }, facts).affected, "possible");
  assert.equal(fireRisk({ branch: "navy", separation: sep }, facts), null);
});

test("alphabetical cut-off compares surname first", () => {
  assert.equal(afterCutoff("Hubbard, James F.", "Hubbard, James E."), true);
  assert.equal(afterCutoff("Hubbard, Alan", "Hubbard, James E."), false);
  assert.equal(afterCutoff("", "Hubbard, James E."), null);
});

test("invalid input returns readable errors", () => {
  const r = assess({ relationship: "x", branch: "y", separation: "soon" }, facts, today);
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 3);
});

test("cover letter has no bracket placeholders and mentions the fire when relevant", () => {
  const input = { ...base, separation: "1950", nameInService: "Doe, John Q." };
  const r = assess(input, facts, today);
  const letter = coverLetter(input, r, today);
  assert.ok(!/\[[^\]]+\]/.test(letter));
  assert.match(letter, /Doe, John Q\./);
  assert.match(letter, /1973 fire/);
});

test("dates read as words for the user", () => {
  assert.equal(longDate("1960-01-01"), "January 1, 1960");
  assert.equal(separationText("1968"), "1968");
  assert.equal(separationText("1968-05"), "May 1968");
  assert.equal(separationText("1968-05-14"), "May 14, 1968");
});
