// Pure rules for planning a military personnel records request.
// Every fact comes from config/facts.json, which the source-drift monitor
// checks against the National Archives pages on a schedule.

export const BRANCHES = {
  army: "Army",
  navy: "Navy",
  marine_corps: "Marine Corps",
  air_force: "Air Force",
  coast_guard: "Coast Guard",
  space_force: "Space Force",
};

export const RELATIONSHIPS = {
  veteran: "I am the veteran",
  next_of_kin: "Next of kin of a deceased veteran",
  other: "Someone else (relative, researcher, genealogist)",
};

/** Parse "YYYY" or "YYYY-MM" or "YYYY-MM-DD". Returns { date, precision } or null. */
export function parseSeparation(value) {
  const s = String(value || "").trim();
  let m = /^(\d{4})$/.exec(s);
  if (m) return { date: new Date(Date.UTC(+m[1], 11, 31)), earliest: new Date(Date.UTC(+m[1], 0, 1)), precision: "year" };
  m = /^(\d{4})-(\d{2})$/.exec(s);
  if (m) {
    const y = +m[1];
    const mo = +m[2] - 1;
    if (mo < 0 || mo > 11) return null;
    return { date: new Date(Date.UTC(y, mo + 1, 0)), earliest: new Date(Date.UTC(y, mo, 1)), precision: "month" };
  }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCMonth() !== +m[2] - 1) return null;
    return { date: d, earliest: d, precision: "day" };
  }
  return null;
}

function addYears(d, years) {
  const out = new Date(d.getTime());
  out.setUTCFullYear(out.getUTCFullYear() + years);
  return out;
}

const iso = (d) => d.toISOString().slice(0, 10);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "1960-01-01" -> "January 1, 1960" */
export function longDate(isoDate) {
  const [y, m, d] = String(isoDate).split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** The separation date as the user gave it, in words: "1968", "May 1968" or "May 14, 1968". */
export function separationText(value) {
  const s = String(value || "").trim();
  const parts = s.split("-").map(Number);
  if (parts.length === 2) return `${MONTHS[parts[1] - 1]} ${parts[0]}`;
  if (parts.length === 3) return longDate(s);
  return s;
}

/** Is a surname alphabetically after the Air Force fire cut-off ("Hubbard, James E.")? */
export function afterCutoff(name, cutoff) {
  const norm = (x) => String(x || "").toUpperCase().replace(/[^A-Z, ]/g, "").replace(/\s+/g, " ").trim();
  const n = norm(name);
  if (!n) return null;
  return n.localeCompare(norm(cutoff), "en") > 0;
}

export function fireRisk({ branch, separation, nameInService }, facts) {
  if (!separation) return null;
  for (const f of facts.fire1973) {
    if (f.branch !== branch) continue;
    const from = new Date(`${f.from}T00:00:00Z`);
    const to = new Date(`${f.to}T00:00:00Z`);
    const overlaps = separation.earliest < to && separation.date >= from;
    if (!overlaps) continue;
    const fully = separation.earliest >= from && separation.date < to;
    let affected = fully ? "likely" : "possible";
    let note = `The 1973 fire at the National Personnel Records Center destroyed ${f.loss} of ${BRANCHES[f.branch]} records for discharges from ${longDate(f.from)} to ${longDate(f.to)}.`;
    if (f.surnameAfter) {
      const after = afterCutoff(nameInService, f.surnameAfter);
      if (after === false) return null;
      if (after === null) {
        affected = "possible";
        note += ` Only names alphabetically after "${f.surnameAfter}" were affected.`;
      }
    }
    return { affected, loss: f.loss, note };
  }
  return null;
}

/**
 * Plan a records request.
 * @param {object} input  { relationship, veteranDeceased, branch, separation, nameInService, knowsServiceNumber }
 * @param {object} facts  parsed config/facts.json
 * @param {Date}   today
 */
export function assess(input, facts, today = new Date()) {
  const errors = [];
  if (!BRANCHES[input.branch]) errors.push("Choose the branch of service.");
  if (!RELATIONSHIPS[input.relationship]) errors.push("Choose who is asking.");
  const separation = parseSeparation(input.separation);
  if (!separation) errors.push("Enter the separation date as a year (1968), a month (1968-05) or a full date (1968-05-14).");
  if (errors.length) return { ok: false, errors };

  const opensOn = addYears(separation.date, facts.archivalYears);
  const opensEarliest = addYears(separation.earliest, facts.archivalYears);
  const archival = opensOn <= today;
  const borderline = !archival && opensEarliest <= today;

  const warnings = [];
  let access;
  let cost;
  if (archival) {
    access = "open";
    cost = `Archival record: anyone may order a complete copy. Fee: $${facts.fees.archivalUpTo5Pages} for 5 pages or less, $${facts.fees.archival6PagesOrMore} for 6 pages or more (most files).`;
  } else if (input.relationship === "veteran") {
    access = "full";
    cost = "Free for the veteran.";
  } else if (input.relationship === "next_of_kin" && input.veteranDeceased) {
    access = "full";
    cost = "Free for next of kin.";
  } else {
    access = "limited";
    cost = "Free, but only limited information can be released to the general public until the record becomes archival.";
  }
  if (borderline) {
    warnings.push(`This record becomes archival between ${longDate(iso(opensEarliest))} and ${longDate(iso(opensOn))}. Use the exact separation date to be sure.`);
  }
  if (input.relationship === "next_of_kin" && !input.veteranDeceased) {
    warnings.push("Next-of-kin access applies when the veteran has died. A living veteran must sign the request, or you can ask as a member of the public.");
  }
  if (input.relationship === "next_of_kin" && input.veteranDeceased && !archival) {
    warnings.push(`Next of kin means: ${facts.nextOfKin.join(", ")}.`);
  }

  const fire = fireRisk({ branch: input.branch, separation, nameInService: input.nameInService }, facts);

  const needs = [
    "Complete name used while in service",
    input.knowsServiceNumber ? "Service number" : "Service number, if you can find it (old discharge papers, VA letters, dog tags)",
    "Social Security number, if the veteran had one on record",
    `Branch of service (${BRANCHES[input.branch]})`,
    "Dates of service",
    "Date and place of birth",
  ];
  if (fire) needs.push("Place of discharge", "Last unit of assignment", "Place of entry into service, if known");
  if (access === "full" && input.relationship === "next_of_kin") needs.push("Proof of death: death certificate, funeral home letter or published obituary");
  needs.push("Your signature and the date");

  const howToSend = [];
  if (access === "open") {
    howToSend.push(`Order online or by mail through the National Archives: ${facts.links.publicAccess}`);
  } else {
    howToSend.push(`Online, after identity verification with ID.me: ${facts.links.request}`);
  }
  howToSend.push(`Or mail Standard Form 180 (${facts.links.sf180}) to ${facts.nprc.mail.join(", ")}, or fax it to ${facts.nprc.fax}.`);
  howToSend.push(`Wait ${facts.nprc.followUpAfterDays} days before following up; earlier follow-ups can slow the request. Status line: ${facts.nprc.phone}.`);

  return {
    ok: true,
    archival,
    opensOn: iso(opensOn),
    access,
    cost,
    fire,
    needs,
    howToSend,
    warnings,
    factsVersion: facts.version,
  };
}

/** A plain cover letter to send with the SF-180. Built in the browser; nothing is uploaded. */
export function coverLetter(input, result, today = new Date()) {
  const name = (input.nameInService || "").trim() || "the veteran";
  const who = RELATIONSHIPS[input.relationship] || "";
  const lines = [
    longDate(`${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`),
    "",
    "National Personnel Records Center",
    "Military Personnel Records",
    "1 Archives Drive",
    "St. Louis, MO 63138",
    "",
    `Re: Request for the Official Military Personnel File of ${name}${BRANCHES[input.branch] ? `, ${BRANCHES[input.branch]}` : ""}`,
    "",
    "To the Military Personnel Records staff:",
    "",
    `Please send a complete copy of the Official Military Personnel File for ${name}, who separated from the ${BRANCHES[input.branch] || "service"} in ${separationText(input.separation)}. A completed Standard Form 180 is enclosed.`,
  ];
  if (input.relationship === "next_of_kin") lines.push("", "I am the veteran's next of kin. A copy of proof of death is enclosed.");
  if (result.fire) lines.push("", "This record may have been affected by the 1973 fire. I have included the place of discharge, last unit of assignment and place of entry to help reconstruct the file.");
  if (result.access === "open") lines.push("", "I understand this is an archival record and that a copying fee applies.");
  lines.push("", "Thank you for your help.", "", "Sincerely,", "", "Signature: ______________________________", "Printed name: ___________________________", `Requester: ${who}`);
  return lines.join("\n");
}
