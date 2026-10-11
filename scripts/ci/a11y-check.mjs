// Verify: basic accessibility rules for the static page.
import { readFile } from "node:fs/promises";

export function audit(html) {
  const problems = [];
  if (!/<html[^>]*\blang="[a-z-]+"/i.test(html)) problems.push("<html> needs a lang attribute.");
  if (!/<title>[^<]+<\/title>/i.test(html)) problems.push("Page needs a <title>.");
  if (!/<meta name="viewport"/i.test(html)) problems.push("Page needs a viewport meta tag.");
  const labelled = new Set([...html.matchAll(/<label[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]));
  // Controls wrapped inside a <label> are labelled too.
  for (const m of html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)) {
    for (const c of m[1].matchAll(/<(?:input|select|textarea)[^>]*\bid="([^"]+)"/g)) labelled.add(c[1]);
  }
  for (const m of html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const id = /\bid="([^"]+)"/.exec(m[2])?.[1];
    if (/type="(hidden|submit|button)"/.test(m[2])) continue;
    if (!id || !labelled.has(id)) problems.push(`<${m[1]}${id ? ` id="${id}"` : ""}> has no label.`);
  }
  for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) {
    if (!m[1].replace(/<[^>]+>/g, "").trim()) problems.push("A <button> has no text.");
  }
  for (const m of html.matchAll(/<img\b([^>]*)>/g)) if (!/\balt="/.test(m[1])) problems.push("An <img> has no alt text.");
  return problems;
}

async function main() {
  const problems = audit(await readFile("public/index.html", "utf8"));
  if (problems.length) {
    console.error(`Accessibility check failed:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  console.log("Accessibility check passed.");
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
