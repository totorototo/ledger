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
import { bestVdot, racePrediction } from "./race.js";
import { trailPrediction } from "./trail.js";
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

// Resting heart rate ({ date, resting }) from `from` to `to`, against the runner's own
// baseline: the median of the 28 days before `from`. `raised` counts the days at least 5 bpm
// over it. Null with no day; `baseline` null with under 14 days to set it.
// why a baseline of ours here: Garmin gives HRV a band, not resting heart rate; the median
// keeps a sick day from moving it.
export function restingSummary(all, from, to) {
  const days = all.filter((d) => d.date >= from && d.date <= to);
  if (!days.length) return null;
  const before = all.filter((d) => d.date >= addDays(from, -28) && d.date < from);
  const baseline = before.length >= 14 ? median(before.map((d) => d.resting)) : null;
  return {
    days: days.length,
    average: round(days.reduce((sum, d) => sum + d.resting, 0) / days.length, 0),
    baseline: round(baseline, 0),
    raised: baseline == null ? null : days.filter((d) => d.resting >= baseline + 5).length,
  };
}

// Nights of sleep ({ date, hours, score }): their mean length and Garmin score, and how many
// were under 7 h (the adult minimum of Hirshkowitz et al., _Sleep Health_ 2015). Null with no
// night.
export function sleepSummary(nights) {
  if (!nights.length) return null;
  const scored = nights.filter((n) => n.score != null);
  return {
    nights: nights.length,
    averageHours: round(nights.reduce((sum, n) => sum + n.hours, 0) / nights.length),
    averageScore: scored.length
      ? round(scored.reduce((sum, n) => sum + n.score, 0) / scored.length, 0)
      : null,
    under7h: nights.filter((n) => n.hours < 7).length,
  };
}

// The plan's entries that overlap `from`–`to`, as "<kind>: <text>".
const notesIn = (entries, from, to) =>
  entries.filter((e) => e.from <= to && e.to >= from).map((e) => `${e.kind}: ${e.text}`);

// Days from `from` to `to`, both "YYYY-MM-DD": read as UTC dates, so no zone moves them.
const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 864e5);

// The races ahead of `until`, nearest first, with the days to go; the notes the plan couldn't
// read. Null without a plan.
function planSummary(plan, until) {
  if (!plan) return null;
  const races = plan.entries
    .filter((e) => e.kind === "race" && e.from >= until)
    .map((e) => ({ date: e.from, text: e.text, daysTo: daysBetween(until, e.from) }));
  return { nextRace: races[0] ?? null, races, ignored: plan.ignored };
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

// A summary with the days it sums, for the last 7 days; null stays null.
const withDays = (summary, days) => summary && { ...summary, days };

// The 7 days to `until` against the 28 before them, per week: what weekly-review reads.
// `first` is the history's first day: the average is per week the history covers, so a new
// account's isn't diluted by weeks before its first activity.
function lastWeek(activities, until, first, { nights, resting, sleep, entries }) {
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
  const restingDays = resting.filter((d) => d.date >= from && d.date <= until);
  const sleepDays = sleep.filter((n) => n.date >= from && n.date <= until);
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
    restingHr: withDays(restingSummary(resting, from, until), restingDays),
    sleep: withDays(sleepSummary(sleepDays), sleepDays),
    notes: notesIn(entries, from, until),
    sessions: week.map(session),
  };
}

// The whole history, screened, summed per week, month and year up to `until` ("YYYY-MM-DD").
// `hrv`, `restingHr` and `sleep` are the readings server/export.js reads, `zones` the running
// zones as set now, `plan` parsePlan's result; without one, its fields are null.
export function insights(
  history,
  until,
  { hrv = [], restingHr = [], sleep = [], zones = null, plan = null } = {},
) {
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
  const upTo = (list) =>
    list.filter((d) => d.date <= until).sort((a, b) => a.date.localeCompare(b.date));
  const resting = upTo(restingHr);
  const slept = upTo(sleep);
  const sleepIn = (from, to) => sleepSummary(slept.filter((n) => n.date >= from && n.date <= to));
  const entries = plan?.entries ?? [];

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
        restingHr: restingSummary(resting, key, addDays(key, 6)),
        sleep: sleepIn(key, addDays(key, 6)),
        notes: notesIn(entries, key, addDays(key, 6)),
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
      // The month's best effort scored as VDOT (race.js): a month with no hard run reads low.
      bestVdot: bestVdot(monthRuns),
      hrv: hrvSummary(nightsIn(`${m.key}-01`, `${m.key}-31`)),
      restingHr: restingSummary(resting, `${m.key}-01`, `${m.key}-31`),
      sleep: sleepIn(`${m.key}-01`, `${m.key}-31`),
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
      restingHrDays: resting.length,
      restingHrFirst: resting[0]?.date ?? null,
      sleepNights: slept.length,
      sleepFirst: slept[0]?.date ?? null,
    },
    faults,
    zones,
    plan: planSummary(plan, until),
    lastWeek: lastWeek(activities, until, first, { nights, resting, sleep: slept, entries }),
    race: racePrediction(activities, until),
    trail: trailPrediction(
      activities,
      until,
      entries.filter((e) => e.kind === "race").map((e) => ({ date: e.from, text: e.text })),
    ),
    weeks,
    months,
    years,
  };
}
