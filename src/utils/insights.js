// The numbers the insight skills (.claude/skills) read, written to data/metrics.json by
// `npm run export`. Pure, and built only from the sums the pages use (metrics.js, training.js,
// yearStats.js): a skill interprets these numbers, it never computes its own, so what it says
// matches what the app shows. Distances in km, times in hours, climb in m, all rounded.

import {
  addDays,
  dayOf,
  intensity,
  isEasy,
  isRun,
  loadSeries,
  median,
  screen,
  weekStart,
} from "./metrics.js";
import { monthly, weeklyLoad } from "./training.js";
import { byYear, change, summarize } from "./yearStats.js";

// Bump it when a field changes meaning or goes: the skills name the version they read.
export const METRICS_VERSION = 1;

const round = (value, digits = 1) =>
  Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null;

const inRange = (from, until) => (a) => dayOf(a) >= from && dayOf(a) <= until;

// What a period holds, in the units a person reads: every sport, then running alone.
export function volume(activities) {
  const { totals } = summarize(activities);
  const runs = summarize(activities.filter(isRun)).totals;
  return {
    count: totals.count,
    km: round(totals.distance / 1000),
    hours: round(totals.duration / 3600),
    climbM: round(totals.elevationGain, 0),
    runs: runs.count,
    runKm: round(runs.distance / 1000),
    load: round(
      activities.reduce((sum, a) => sum + (Number(a.activityTrainingLoad) || 0), 0),
      0,
    ),
  };
}

// A run of nights ({ date, lastNightAvg, status, balancedLow, balancedUpper }, from
// server/export.js): how many, their mean, and how many fell under or over the balanced band
// of the athlete's own baseline. Null with no night: no reading is not a low one.
// why count against Garmin's band, not a baseline of ours: it is the one the watch shows.
export function hrvSummary(nights) {
  if (!nights.length) return null;
  const banded = nights.filter((n) => n.balancedLow != null && n.balancedUpper != null);
  return {
    nights: nights.length,
    average: round(nights.reduce((sum, n) => sum + n.lastNightAvg, 0) / nights.length, 0),
    belowBand: banded.filter((n) => n.lastNightAvg < n.balancedLow).length,
    aboveBand: banded.filter((n) => n.lastNightAvg > n.balancedUpper).length,
  };
}

// How many sessions Garmin labelled each way ("TEMPO", "RECOVERY"…); unlabelled ones left out.
export function effects(activities) {
  const counts = {};
  for (const a of activities)
    if (a.trainingEffectLabel)
      counts[a.trainingEffectLabel] = (counts[a.trainingEffectLabel] ?? 0) + 1;
  return counts;
}

// One line per session, for a skill to name the ones that stand out.
export function session(activity) {
  return {
    date: dayOf(activity),
    name: activity.activityName ?? null,
    type: activity.activityType?.typeKey ?? null,
    km: round((activity.distance ?? 0) / 1000),
    hours: round((activity.duration ?? 0) / 3600, 2),
    climbM: round(activity.elevationGain, 0),
    averageHR: activity.averageHR ?? null,
    load: round(activity.activityTrainingLoad, 0),
    easy: isEasy(activity),
    effect: activity.trainingEffectLabel ?? null,
    aerobicTE: round(activity.aerobicTrainingEffect),
    anaerobicTE: round(activity.anaerobicTrainingEffect),
  };
}

// The 7 days to `until` against the 28 before them, per week: what weekly-review reads.
// `first` is the history's first day: the average is per week the history covers, so a new
// account's isn't diluted by weeks before its first activity.
function lastWeek(activities, until, first, nights) {
  const from = addDays(until, -6);
  const week = activities.filter(inRange(from, until));
  const start = addDays(from, -28);
  const before = volume(activities.filter(inRange(start, addDays(from, -1))));
  const covered = Array.from({ length: 28 }, (_, i) => addDays(start, i)).filter(
    (day) => day >= first,
  ).length;
  const weeks = covered / 7;
  const average = Object.fromEntries(
    Object.entries(before).map(([key, value]) => [key, weeks > 0 ? round(value / weeks) : 0]),
  );
  const now = volume(week);
  const weekNights = nights.filter((n) => n.date >= from && n.date <= until);
  return {
    from,
    until,
    volume: now,
    previous4WeeksAverage: average,
    // How many of those 4 weeks the history covers (fractional): under 4 on a new account.
    weeksCovered: round(weeks),
    change: {
      km: change(now.km, average.km),
      hours: change(now.hours, average.hours),
      load: change(now.load, average.load),
    },
    load: loadSeries(activities, [until])[0],
    intensity: intensity(week),
    effects: effects(week),
    hrv: weekNights.length
      ? {
          ...hrvSummary(weekNights),
          days: weekNights.map(({ date, lastNightAvg, status, balancedLow, balancedUpper }) => ({
            date,
            lastNightAvg,
            status,
            balancedLow,
            balancedUpper,
          })),
        }
      : null,
    sessions: week.map(session),
  };
}

// The whole history, screened, summed per week, month and year up to `until` ("YYYY-MM-DD").
// `hrv` is every night's reading (server/export.js's readHrv); without it, HRV fields are null.
export function insights(history, until, { hrv = [] } = {}) {
  // Nothing past `until`: an export taken on a day reads as it did on that day. Cut before
  // screening, so `coverage.activities` and `kept` count the same period.
  const period = history.filter((a) => dayOf(a) && dayOf(a) <= until);
  const { activities, faults } = screen(period);
  const days = activities.map(dayOf).filter(Boolean).sort();
  if (!days.length) return { version: METRICS_VERSION, until, empty: true };
  const first = days[0];
  const runs = activities.filter(isRun);
  const nights = hrv
    .filter((n) => n.date <= until && n.lastNightAvg != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nightsIn = (from, to) => nights.filter((n) => n.date >= from && n.date <= to);

  const perWeek = new Map();
  for (const a of activities) {
    const key = weekStart(dayOf(a));
    if (!perWeek.has(key)) perWeek.set(key, []);
    perWeek.get(key).push(a);
  }
  const weeks = weeklyLoad(activities, first, until).map(
    ({ key, acute, chronic, ratio }, i, all) => {
      const list = perWeek.get(key) ?? [];
      const totals = volume(list);
      const previous = i > 0 ? volume(perWeek.get(all[i - 1].key) ?? []) : null;
      return {
        week: key,
        ...totals,
        kmChange: previous ? change(totals.km, previous.km) : null,
        acute,
        chronic,
        ratio,
        intensity: intensity(list),
        effects: effects(list),
        hrv: hrvSummary(nightsIn(key, addDays(key, 6))),
        // The week ends after `until`: its totals and `kmChange` are of the days so far.
        partial: addDays(key, 6) > until,
      };
    },
  );

  const perMonth = new Map();
  for (const a of activities) {
    const key = dayOf(a).slice(0, 7);
    if (!perMonth.has(key)) perMonth.set(key, []);
    perMonth.get(key).push(a);
  }
  const months = monthly(activities, first, until).map((m) => {
    const monthRuns = (perMonth.get(m.key) ?? []).filter(isRun);
    return {
      month: m.key,
      ...volume(perMonth.get(m.key) ?? []),
      easyRuns: m.easyRuns,
      efficiency: m.efficiency,
      intensity: m.intensity,
      // Medians over every run, not only easy ones: they carry on where efficiency has gaps,
      // so read them with the month's intensity.
      cadence: round(median(monthRuns.map((a) => a.averageRunningCadenceInStepsPerMinute)), 0),
      power: round(median(monthRuns.map((a) => a.avgPower)), 0),
      runsWithPower: monthRuns.filter((a) => a.avgPower > 0).length,
      hrv: hrvSummary(nightsIn(`${m.key}-01`, `${m.key}-31`)),
    };
  });

  const years = byYear(activities, Number(until.slice(0, 4))).map(({ year, activities: list }) => ({
    year,
    ...volume(list),
    sports: summarize(list).sports.map((s) => ({
      type: s.typeKey,
      count: s.count,
      km: round(s.distance / 1000),
      hours: round(s.duration / 3600),
    })),
  }));

  return {
    version: METRICS_VERSION,
    until,
    first,
    coverage: {
      activities: period.length,
      kept: activities.length,
      withLoad: activities.filter((a) => a.activityTrainingLoad > 0).length,
      runs: runs.length,
      runsWithHR: runs.filter((a) => a.averageHR > 0).length,
      runsWithZones: runs.filter((a) => a.hrTimeInZone_1 != null).length,
      runsWithPower: runs.filter((a) => a.avgPower > 0).length,
      withEffect: activities.filter((a) => a.trainingEffectLabel).length,
      hrvNights: nights.length,
      hrvFirst: nights[0]?.date ?? null,
    },
    faults,
    lastWeek: lastWeek(activities, until, first, nights),
    weeks,
    months,
    years,
  };
}
