// Race times from the runner's best recent efforts, for the race-predictor skill. Pure.
// Every run since 2024 carries Garmin's fastest 5 km, 10 km, half and marathon inside it
// (`fastestSplit_<metres>`, probed 2026-10-28): each is scored by Daniels and Gilbert's VDOT,
// and the best score gives a time at every distance.
// why VDOT, not Riegel's T2 = T1 × (D2/D1)^1.06: VDOT scores a 5 km and a 10 km on one scale,
// so the best effort is picked whatever its distance; Riegel needs one source distance.

import { addDays, dayOf, isEasy, isRun } from "./metrics.js";

// The splits read, by Garmin's field. The 1 km and the mile are left out: efforts that short
// lean on anaerobic power, and VDOT from them overstates every longer distance.
export const SPLITS = [
  { field: "fastestSplit_5000", distance: "5k", meters: 5000 },
  { field: "fastestSplit_10000", distance: "10k", meters: 10_000 },
  { field: "fastestSplit_21098", distance: "half", meters: 21_097.5 },
  { field: "fastestSplit_42195", distance: "marathon", meters: 42_195 },
];

// Efforts from the last 12 weeks: long enough to hold a race or a hard session, short enough
// that fitness hasn't moved much since.
export const WINDOW_DAYS = 84;

const round = (value, digits = 1) =>
  Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null;

// Oxygen cost of running at `v` m/min, and the share of VO2max held for `t` minutes
// (Daniels & Gilbert, _Oxygen Power_, 1979).
const cost = (v) => -4.6 + 0.182258 * v + 0.000104 * v * v;
const sustained = (t) =>
  0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);

// The VDOT of `meters` run in `seconds`.
export function vdot(meters, seconds) {
  if (!(meters > 0 && seconds > 0)) return null;
  const minutes = seconds / 60;
  return cost(meters / minutes) / sustained(minutes);
}

// The time, in seconds, that `score` gives over `meters`: VDOT falls as time grows, so
// bisection between 1 minute and 10 hours finds it.
export function timeFor(score, meters) {
  let low = 1;
  let high = 600;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (vdot(meters, mid * 60) > score) low = mid;
    else high = mid;
  }
  return Math.round(((low + high) / 2) * 60);
}

// 1642 → "27:22"; 12_754 → "3:32:34".
export function clock(seconds) {
  const s = Math.round(seconds);
  const hours = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(hours ? 2 : 1, "0");
  const ss = String(s % 60).padStart(2, "0");
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

const pace = (seconds, meters) => `${clock((seconds / meters) * 1000)}/km`;

// Every split of every run as an effort: its score, and the run it came from, to read how
// hard that run was (`easy`, `effect` and `averageHR` are the whole run's, not the split's).
export function efforts(activities) {
  const list = [];
  for (const a of activities.filter(isRun))
    for (const { field, distance, meters } of SPLITS)
      if (a[field] > 0)
        list.push({
          date: dayOf(a),
          name: a.activityName ?? null,
          distance,
          meters,
          seconds: Math.round(a[field]),
          time: clock(a[field]),
          pace: pace(a[field], meters),
          vdot: round(vdot(meters, a[field])),
          runKm: round((a.distance ?? 0) / 1000),
          averageHR: a.averageHR ?? null,
          easy: isEasy(a),
          effect: a.trainingEffectLabel ?? null,
        });
  return list.sort((a, b) => b.vdot - a.vdot || b.date.localeCompare(a.date));
}

// The predictions for the 12 weeks to `until`, from the activities already screened: the best
// effort, the best at each distance, the times its score gives, and the long runs and weekly
// running volume a half or a marathon rests on. `effort` null when no run in the window has a
// split.
export function racePrediction(activities, until) {
  const from = addDays(until, -(WINDOW_DAYS - 1));
  const runs = activities.filter((a) => isRun(a) && dayOf(a) >= from && dayOf(a) <= until);
  const all = efforts(runs);
  const best = all[0] ?? null;
  const km = runs.reduce((sum, a) => sum + (a.distance ?? 0), 0) / 1000;
  return {
    from,
    until,
    effort: best,
    bestByDistance: SPLITS.map(({ distance }) => all.find((e) => e.distance === distance)).filter(
      Boolean,
    ),
    top: all.slice(0, 5),
    predictions: best
      ? SPLITS.map(({ distance, meters }) => {
          // From the unrounded score: the effort's own distance gives back its own time.
          const seconds = timeFor(vdot(best.meters, best.seconds), meters);
          return { distance, seconds, time: clock(seconds), pace: pace(seconds, meters) };
        })
      : [],
    runsWithSplits: runs.filter((a) => SPLITS.some(({ field }) => a[field] > 0)).length,
    runs: runs.length,
    longestRunKm: round(Math.max(0, ...runs.map((a) => (a.distance ?? 0) / 1000))),
    runsOver25Km: runs.filter((a) => a.distance >= 25_000).length,
    weeklyRunKm: round(km / (WINDOW_DAYS / 7)),
  };
}

// The best score of each month's runs, to see the trend; null in a month without a split.
export const bestVdot = (runs) => efforts(runs)[0]?.vdot ?? null;
