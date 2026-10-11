import { assess, BRANCHES, coverLetter, longDate, RELATIONSHIPS } from "./rules.js";

const $ = (id) => document.getElementById(id);
const [facts, flags, build] = await Promise.all(
  ["facts.json", "flags.json", "build.json"].map((f) => fetch(f).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))),
);

for (const [value, label] of Object.entries(BRANCHES)) $("branch").append(new Option(label, value));
for (const [value, label] of Object.entries(RELATIONSHIPS)) {
  const l = document.createElement("label");
  l.className = "inline";
  l.innerHTML = `<input type="radio" name="relationship" value="${value}"${value === "veteran" ? " checked" : ""}> `;
  l.append(label);
  $("relationship").append(l);
}

if (flags.showSources !== false && facts.sources) {
  $("sources").textContent = `Facts checked against the National Archives on ${facts.lastChecked} (version ${facts.version}). Sources: ${facts.sources.map((s) => s.url).join(" · ")}`;
}
if (build.commit) $("build").textContent = `Build ${build.commit.slice(0, 8)}.`;

function list(id, items) {
  $(id).replaceChildren(...items.map((t) => Object.assign(document.createElement("li"), { textContent: t })));
}

$("form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const input = {
    relationship: document.querySelector("input[name=relationship]:checked")?.value,
    veteranDeceased: $("veteranDeceased").checked,
    branch: $("branch").value,
    separation: $("separation").value,
    nameInService: $("nameInService").value,
    knowsServiceNumber: $("knowsServiceNumber").checked,
  };
  const r = assess(input, facts);
  $("errors").hidden = r.ok;
  $("out").hidden = !r.ok;
  if (!r.ok) {
    $("errors").textContent = r.errors.join(" ");
    return;
  }
  const label = { open: "Open to the public", full: "Full copy available to you", limited: "Limited public access" }[r.access];
  const summary = $("summary");
  summary.replaceChildren();
  summary.append(Object.assign(document.createElement("h2"), { textContent: label }));
  summary.append(Object.assign(document.createElement("p"), { textContent: r.cost }));
  summary.append(Object.assign(document.createElement("p"), { className: "hint", textContent: r.archival ? `Archival since ${longDate(r.opensOn)}.` : `Becomes archival (open to anyone) on ${longDate(r.opensOn)}.` }));
  for (const w of r.warnings) summary.append(Object.assign(document.createElement("p"), { className: "warn", textContent: w }));

  $("fire").hidden = !(r.fire && flags.showFireCheck !== false);
  if (r.fire) {
    $("fire").replaceChildren(
      Object.assign(document.createElement("h2"), { textContent: r.fire.affected === "likely" ? "This file was likely in the 1973 fire" : "This file may have been in the 1973 fire" }),
      Object.assign(document.createElement("p"), { textContent: `${r.fire.note} The Archives can often rebuild basic service facts from other records, so send everything below.` }),
    );
  }
  list("needs", r.needs);
  list("send", r.howToSend);
  $("letter-card").hidden = flags.showCoverLetter === false;
  $("letter").textContent = coverLetter(input, r);
  $("out").scrollIntoView({ behavior: "smooth" });
});

$("copy").addEventListener("click", () => navigator.clipboard?.writeText($("letter").textContent));
