// The Training section's series for one year: load per week, and efficiency and intensity per
// month. The sums are metrics.js's; this file only cuts the history into periods.
// Days are the watch's "YYYY-MM-DD", stepped in UTC by metrics.js, never through local time.

import {
  addDays,
  dayOf,
  efficiency,
  intensity,
  isEasy,
  isRun,
  loadSeries,
  screen,
  weekStart,
} from "./metrics.js";
import { MONTHS } from "./yearStats.js";

// Below this many easy runs, a month's median is one or two runs' mood: left as a gap.
// why a gap, not a thin point: a line through a point of one run reads as a trend.
export const MIN_EASY_RUNS = 3;

const dayName = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;

// One year, Jan 1 to `until` (Dec 31, or today for this year), screened, with what the charts
// rest on: the faults set aside, and how many activities carry a load, how many runs a heart
// rate. `activities` may hold the year before too: the first weeks' 28-day load reads it.
export function training(activities, from, until) {
  const { activities: kept, faults } = screen(activities);
  const inRange = (a) => dayOf(a) >= from && dayOf(a) <= until;
  const year = kept.filter(inRange);
  const runs = year.filter(isRun);
  return {
    faults: faults.filter((f) => f.date >= from && f.date <= until),
    coverage: {
      activities: year.length,
      withLoad: year.filter((a) => a.activityTrainingLoad > 0).length,
      runs: runs.length,
      runsWithHR: runs.filter((a) => a.averageHR > 0).length,
    },
    weeks: weeklyLoad(kept, from, until),
    months: monthly(year, from, until),
  };
}

// One point per week, Monday first, from the week holding `from` to the one holding `until`:
// Garmin's acute (7 days) and chronic (28 days, per week) load at the week's end, or at
// `until` for the last. `tick` names the month where one starts.
export function weeklyLoad(activities, from, until) {
  const starts = [];
  for (let start = weekStart(from); start <= until; start = addDays(start, 7)) starts.push(start);
  const ends = starts.map((start) => (addDays(start, 6) < until ? addDays(start, 6) : until));
  return loadSeries(activities, ends).map((load, i) => {
    // The month the week's end falls in, so the week holding Jan 1 is January's.
    const month = Number(ends[i].slice(5, 7)) - 1;
    const previous = i > 0 ? Number(ends[i - 1].slice(5, 7)) - 1 : null;
    return {
      key: starts[i],
      label: `Week of ${dayName(starts[i])}`,
      tick: month !== previous ? MONTHS[month][0] : "",
      ...load,
    };
  });
}

// One point per month from `from`'s to `until`'s: the median metres per heartbeat of its easy
// runs (null under MIN_EASY_RUNS), and its time in the easy, grey and hard bands.
export function monthly(activities, from, until) {
  const groups = new Map();
  for (const activity of activities) {
    const month = dayOf(activity)?.slice(0, 7);
    if (!month) continue;
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(activity);
  }
  const months = [];
  for (
    let month = from.slice(0, 7);
    month <= until.slice(0, 7);
    month = addDays(`${month}-28`, 7).slice(0, 7)
  )
    months.push(month);
  return months.map((month) => {
    const list = groups.get(month) ?? [];
    const easy = list.filter((a) => isRun(a) && isEasy(a));
    return {
      key: month,
      label: `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`,
      tick: MONTHS[Number(month.slice(5)) - 1][0],
      easyRuns: easy.length,
      efficiency: easy.length >= MIN_EASY_RUNS ? efficiency(easy) : null,
      intensity: intensity(list),
    };
  });
}
