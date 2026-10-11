// Package: assemble the static site into dist/ with build metadata.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
await cp("src/rules.js", "dist/rules.js");
await cp("config/facts.json", "dist/facts.json");
await cp("config/flags.json", "dist/flags.json");
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const build = {
  version: pkg.version,
  commit: process.env.CI_COMMIT_SHA || "local",
  pipeline: process.env.CI_PIPELINE_ID || null,
  builtAt: new Date().toISOString(),
};
await writeFile("dist/build.json", JSON.stringify(build, null, 2));
console.log(`Built dist/ for version ${build.version} (${build.commit.slice(0, 8)}).`);
