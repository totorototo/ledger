// Builds an insight skill's report page (scripts/reports/) from data/metrics.json and the
// skill's notes:
//
//   npm run report -- <skill>                 writes data/reports/<skill>.html
//   npm run report -- <skill> --url <url>     records the page's artifact link
//
// data/reports/ is gitignored: the pages hold the account's data. links.json keeps each
// page's link, so a skill updates its page in place instead of making a new one.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { render, reportData, SKILLS } from "./reports/build.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "reports");
const LINKS = join(OUT, "links.json");
const read = (path) => readFileSync(path, "utf8");
const links = () => (existsSync(LINKS) ? JSON.parse(read(LINKS)) : {});

const [skill, flag, url] = process.argv.slice(2);
try {
  if (!SKILLS.includes(skill)) throw new Error(`usage: npm run report -- <${SKILLS.join("|")}>`);
  mkdirSync(OUT, { recursive: true });
  if (flag === "--url") {
    if (!url?.startsWith("https://claude.ai/"))
      throw new Error("--url takes the artifact's claude.ai link");
    writeFileSync(LINKS, `${JSON.stringify({ ...links(), [skill]: url }, null, 2)}\n`);
    console.log(`recorded ${skill}: ${url}`);
  } else {
    const notesPath = join(OUT, `${skill}.notes.json`);
    if (!existsSync(notesPath))
      throw new Error(`no ${notesPath}: the skill writes its notes first`);
    const data = reportData(
      skill,
      JSON.parse(read(join(ROOT, "data", "metrics.json"))),
      JSON.parse(read(notesPath)),
    );
    const base = join(ROOT, "scripts", "reports");
    const page = render(
      read(join(base, `${skill}.html`)),
      { style: read(join(base, "base.css")), script: read(join(base, "base.js")) },
      data,
    );
    const out = join(OUT, `${skill}.html`);
    writeFileSync(out, page);
    console.log(`wrote ${out}`);
    console.log(`link: ${links()[skill] ?? "none yet (publish it, then record it with --url)"}`);
  }
} catch (err) {
  console.error(`report failed: ${err.message}`);
  process.exitCode = 1;
}
