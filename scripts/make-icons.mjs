// Writes the app's icons from the mark the masthead draws (src/theme/mark.js). Dark's
// colours, the app's first variant.
//
//   node scripts/make-icons.mjs
//
// Output in public/: favicon.svg, apple-touch-icon.png, logo512.png (logo192 joins them with
// a PWA manifest, as in Waymark).

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";
import THEME from "@totorototo/trail-tokens";

import { MARK_PATH } from "../src/theme/mark.js";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const BACKGROUND = THEME.colors.dark["--color-background"];
const INK = THEME.colors.dark["--color-primary"];

const MARK = `<path d="${MARK_PATH}" fill="${INK}" fill-rule="evenodd"/>`;

// The tab icon: a rounded tile, the mark nearly to its edges.
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${BACKGROUND}"/>${MARK}</svg>\n`;

// why: Waymark's maskable tile, so the PNGs hold once a PWA manifest lists them: a launcher
// may crop them to a circle of 80% of the side. Full-bleed square, and a 96 viewBox puts the mark (its far corner about 32
// from the centre) inside that circle's radius of 38. iOS rounds the apple-touch-icon's corners itself.
const TILE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -16 96 96"><rect x="-16" y="-16" width="96" height="96" fill="${BACKGROUND}"/>${MARK}</svg>`;

const PNGS = [
  ["apple-touch-icon.png", 180],
  ["logo512.png", 512],
];

writeFileSync(join(OUT_DIR, "favicon.svg"), FAVICON);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of PNGS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${TILE}`,
  );
  await page.screenshot({ path: join(OUT_DIR, name), omitBackground: true });
}
await browser.close();

console.log(`wrote favicon.svg and ${PNGS.map(([name]) => name).join(", ")} to ${OUT_DIR}`);
