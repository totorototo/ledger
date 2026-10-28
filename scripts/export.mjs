// Writes the account's history and the numbers the insight skills read (.claude/skills):
//
//   npm run export
//
// Output in data/ (gitignored, never committed): activities.json, the trimmed history,
// hrv.json, each night's HRV, and metrics.json, the weekly, monthly and yearly sums of
// src/utils/insights.js up to today.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";

import { createExportClient, readHistory, readHrv } from "../server/export.js";
import { insights } from "../src/utils/insights.js";
import { today } from "../src/utils/yearStats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "data");

// The key as vite.config.js reads it: .env at the root, GARMIN_ prefix only.
const { GARMIN_PERSONAL_API_KEY } = loadEnv("development", ROOT, "GARMIN_");

try {
  const client = createExportClient({ apiKey: GARMIN_PERSONAL_API_KEY });
  const activities = await readHistory(client, {
    onPage: (count) => process.stdout.write(`\rread ${count} activities`),
  });
  process.stdout.write("\n");
  const until = today().iso;
  const since = activities.at(-1)?.startTimeLocal?.slice(0, 10) ?? until;
  const hrv = await readHrv(client, until, since);
  console.log(`read ${hrv.length} nights of HRV`);
  mkdirSync(OUT_DIR, { recursive: true });
  const write = (name, value) =>
    writeFileSync(join(OUT_DIR, name), `${JSON.stringify(value, null, 2)}\n`);
  write("activities.json", { until, activities });
  write("hrv.json", { until, nights: hrv });
  write("metrics.json", insights(activities, until, { hrv }));
  console.log(`wrote activities.json, hrv.json and metrics.json to ${OUT_DIR}, up to ${until}`);
} catch (err) {
  console.error(`export failed: ${err.message}`);
  process.exitCode = 1;
}
