// The longest break from running before each long race, and now. Pure.
// why the longest break and not weekly counts: thin weeks didn't line up with results on the
// first runner's races (a DNF with 1 thin week, a finish with 4), and one long stop is the visible
// trace of an injury or an illness, which Garmin doesn't record.

import { addDays, dayOf, isRun } from "./metrics.js";
import { course, effortKm, raceName, result } from "./trail.js";

export const BREAK_DAYS = 84;
export const LONG_RACE_EFFORT_KM = 190;

// The longest stretch with no run in the BREAK_DAYS before `end` (not counting `end`); null when
// the history starts inside them: no activity there is a gap in the data, not a break.
export function longestBreak(activities, end) {
  const start = addDays(end, -BREAK_DAYS);
  const first = activities.map(dayOf).filter(Boolean).sort()[0];
  if (!first || first > start) return null;
  const running = new Set(activities.filter(isRun).map(dayOf));
  let best = null;
  let open = null;
  let runDays = 0;
  for (let i = 0; i < BREAK_DAYS; i++) {
    const day = addDays(start, i);
    if (running.has(day)) {
      runDays += 1;
      open = null;
      continue;
    }
    open = open ? { ...open, days: open.days + 1, to: day } : { days: 1, from: day, to: day };
    if (!best || open.days > best.days) best = open;
  }
  return { days: best?.days ?? 0, from: best?.from ?? null, to: best?.to ?? null, runDays };
}

// `races` are the plan's, { date, text }: only a result or a DNF says how a race ended.
export function breakSummary(activities, until, races = []) {
  const long = races
    .filter((r) => r.date <= until)
    .map((r) => {
      const { km, climbM } = course(r.text);
      return {
        date: r.date,
        name: raceName(r.text),
        effortKm: km != null && climbM != null ? Math.round(effortKm(km, climbM)) : null,
        ...result(r.text),
      };
    })
    .filter((r) => r.effortKm >= LONG_RACE_EFFORT_KM && (r.dnf || r.hours != null))
    .map((r) => ({
      date: r.date,
      name: r.name,
      effortKm: r.effortKm,
      dnf: Boolean(r.dnf),
      before: longestBreak(activities, r.date),
    }));
  const rows = long.filter((r) => r.before).sort((a, b) => b.date.localeCompare(a.date));
  const finishes = rows.filter((r) => !r.dnf);
  const dnfs = rows.filter((r) => r.dnf);
  const longestBeforeFinish = finishes.length
    ? Math.max(...finishes.map((r) => r.before.days))
    : null;
  const next = races.filter((r) => r.date > until).sort((a, b) => a.date.localeCompare(b.date))[0];
  return {
    days: BREAK_DAYS,
    now: longestBreak(activities, addDays(until, 1)),
    races: rows,
    // Long races older than the history, said so that none drops silently.
    withoutHistory: long.length - rows.length,
    finishes: finishes.length,
    dnfs: dnfs.length,
    longestBeforeFinish,
    dnfsOverFinishes:
      longestBeforeFinish == null
        ? null
        : dnfs.filter((r) => r.before.days > longestBeforeFinish).length,
    next: next
      ? {
          date: next.date,
          name: raceName(next.text),
          windowOpens: addDays(next.date, -BREAK_DAYS),
        }
      : null,
  };
}
