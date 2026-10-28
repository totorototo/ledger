// The report pages the insight skills publish (`npm run report <skill>`): each page's numbers
// picked from metrics.json, beside the skill's own reading (data/reports/<skill>.notes.json),
// put into its template. Pure: scripts/report.mjs reads and writes the files.
// why pick here and not in the skill: a number then goes from metrics.json to the page without
// passing through the model, which only writes words.

import { METRICS_VERSION } from "../../src/utils/insights.js";

export const SKILLS = ["race-predictor", "load-check", "weekly-review", "aerobic-progress"];
export const VERDICTS = ["Steady", "Lighter", "Watch", "Overreaching risk"];

const LABEL = { "5k": "5 km", "10k": "10 km", half: "Half marathon", marathon: "Marathon" };
const TRUST = ["high", "fair", "low"];

const DISCLAIMER = {
  "race-predictor":
    "Predicted from Garmin's fastest splits with Daniels' VDOT tables, assuming a flat road race run all out and training for the distance; an estimate, not a promise.",
  "load-check":
    "Based on Garmin's activity and wellness summaries; a warning light, not a diagnosis, and not medical advice.",
  "weekly-review": "Based on Garmin's activity and wellness summaries; not medical advice.",
  "aerobic-progress":
    "Based on Garmin's activity and wellness summaries; heat, terrain and sensor accuracy move these numbers; not medical advice.",
};

// What each skill's notes must hold: a key and a check. A missing or malformed note fails the
// build with its name, never a page with a hole in it.
const text = (v) => typeof v === "string" && v.trim() !== "";
const texts = (v) => Array.isArray(v) && v.every(text);
const optional = (v) => v == null || text(v);
const flags = (v) => Array.isArray(v) && v.every((f) => text(f?.flag) && text(f?.text));
const NOTES = {
  "race-predictor": {
    takeaway: text,
    trust: (v) =>
      Object.keys(LABEL).every((d) => TRUST.includes(v?.[d]?.level) && text(v?.[d]?.why)),
    reading: texts,
    trend: text,
    sharpen: text,
  },
  "load-check": {
    verdict: (v) => VERDICTS.includes(v),
    takeaway: text,
    now: flags,
    earlier: flags,
    action: text,
  },
  "weekly-review": {
    takeaway: text,
    standouts: (v) =>
      Array.isArray(v) &&
      v.every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s?.date) && text(s?.name) && text(s?.text)),
    takeaways: texts,
    caveat: optional,
  },
  "aerobic-progress": { headline: text, takeaway: text, trend: texts, worthTrying: optional },
};

export function checkNotes(skill, notes) {
  const bad = Object.entries(NOTES[skill]).filter(([key, ok]) => !ok(notes?.[key]));
  if (bad.length)
    throw new Error(`${skill} notes: missing or malformed ${bad.map(([k]) => k).join(", ")}`);
  return notes;
}

// A wellness summary without its days, for a page that shows only the summary.
const summary = (s) => s && Object.fromEntries(Object.entries(s).filter(([key]) => key !== "days"));

// "2026-10" → "2025-10".
const yearBefore = (month) => `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;

function racePredictor(m, notes) {
  const r = m.race;
  if (!r?.effort) throw new Error("race-predictor: no run of the last 12 weeks carries a split");
  const effort = { ...r.effort, label: LABEL[r.effort.distance] };
  return {
    effort,
    predictions: r.predictions.map((p) => ({
      distance: p.distance,
      label: LABEL[p.distance],
      time: p.time,
      pace: p.pace,
      trust: notes.trust[p.distance].level,
      why: notes.trust[p.distance].why,
    })),
    volume: {
      weeklyRunKm: r.weeklyRunKm,
      longestRunKm: r.longestRunKm,
      runsOver25Km: r.runsOver25Km,
    },
    trend: m.months.slice(-12).map((x) => ({ month: x.month, vdot: x.bestVdot ?? null })),
    efforts: r.top.map((e) => ({ ...e, label: LABEL[e.distance] })),
  };
}

function loadCheck(m) {
  const w = m.lastWeek;
  return {
    now: w.load,
    intensity: w.intensity,
    hrv: summary(w.hrv),
    restingHr: summary(w.restingHr),
    sleep: summary(w.sleep),
    nextRace: m.plan?.nextRace ?? null,
    coverage: { withLoad: m.coverage.withLoad, kept: m.coverage.kept },
    weeks: m.weeks.slice(-8).map((x) => ({
      week: x.week,
      km: x.km,
      hours: x.hours,
      load: x.load,
      ratio: x.ratio,
      kmChange: x.kmChange,
      easyPct: x.intensity?.easyPct ?? null,
      hrvBelow: x.hrv?.belowBand ?? null,
      sleepUnder7h: x.sleep?.under7h ?? null,
      notes: x.notes ?? [],
      partial: x.partial,
    })),
  };
}

function weeklyReview(m) {
  const w = m.lastWeek;
  return {
    from: w.from,
    volume: w.volume,
    average: w.previous4WeeksAverage,
    change: w.change,
    load: w.load,
    intensity: w.intensity,
    effects: w.effects,
    hrv: w.hrv,
    restingHr: w.restingHr,
    sleep: w.sleep,
    planNotes: w.notes,
    nextRace: m.plan?.nextRace ?? null,
    sessions: w.sessions,
  };
}

function aerobicProgress(m) {
  const month = (x, key) =>
    x
      ? {
          month: x.month,
          efficiency: x.efficiency,
          easyRuns: x.easyRuns,
          runKm: x.runKm,
          easyPct: x.intensity?.easyPct ?? null,
          cadence: x.cadence,
          power: x.power,
          hrv: x.hrv?.average ?? null,
          restingHr: x.restingHr?.average ?? null,
        }
      : { month: key, efficiency: null, easyRuns: 0 };
  const byMonth = new Map(m.months.map((x) => [x.month, x]));
  const months = m.months.slice(-12).map((x) => month(x));
  const lastYear = months.map((x) => month(byMonth.get(yearBefore(x.month)), yearBefore(x.month)));
  const latest = months.findLast((x) => x.efficiency != null) ?? null;
  return {
    months,
    lastYear,
    latest,
    sameMonthLastYear: latest ? lastYear[months.indexOf(latest)] : null,
    coverage: { runs: m.coverage.runs, runsWithZones: m.coverage.runsWithZones },
    zones: m.zones,
  };
}

const PICK = {
  "race-predictor": racePredictor,
  "load-check": loadCheck,
  "weekly-review": weeklyReview,
  "aerobic-progress": aerobicProgress,
};

// The data a page reads: its numbers from metrics.json, the skill's notes, the footer's line.
export function reportData(skill, metrics, notes) {
  if (!SKILLS.includes(skill)) throw new Error(`no report for "${skill}": ${SKILLS.join(", ")}`);
  if (metrics?.version !== METRICS_VERSION)
    throw new Error(
      `metrics.json is version ${metrics?.version}, the reports read ${METRICS_VERSION}: run npm run export`,
    );
  if (metrics.empty) throw new Error("metrics.json has no activities");
  checkNotes(skill, notes);
  return {
    skill,
    until: metrics.until,
    disclaimer: DISCLAIMER[skill],
    notes,
    ...PICK[skill](metrics, notes),
  };
}

// The page: the shared style and script in their slots, the data as JSON. `<` is escaped so a
// name holding "</script>" can't end the data block.
export function render(template, { style, script }, data) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return template
    .replace("<!-- BASE_STYLE -->", () => `<style>\n${style}</style>`)
    .replace("<!-- BASE_SCRIPT -->", () => `<script>\n${script}</script>`)
    .replace('"__REPORT__"', () => json);
}
