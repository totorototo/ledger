// The Training section's numbers: training load, intensity and running efficiency from the
// Personal API's activity list. Pure: dates are the watch's local "YYYY-MM-DD" strings, never
// through the machine's zone.

const DAY_MS = 86_400_000;

// Running in any of its forms; everything else still counts toward load and time.
const RUN_TYPES = /run/;

// Calendar arithmetic on "YYYY-MM-DD", in UTC so no zone or DST moves a day.
const toDay = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const fromDay = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso, n) => fromDay(toDay(iso) + n * DAY_MS);

// The Monday that starts the week holding `iso`.
export function weekStart(iso) {
  const weekday = (new Date(toDay(iso)).getUTCDay() + 6) % 7;
  return addDays(iso, -weekday);
}

const num = (value) => (Number.isFinite(value) ? value : 0);
const round = (value, digits = 1) =>
  Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null;
export const median = (values) => {
  const list = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = list.length >> 1;
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
};

export const isRun = (activity) => RUN_TYPES.test(activity.activityType?.typeKey ?? "");
export const dayOf = (activity) => activity.startTimeLocal?.slice(0, 10) ?? null;

const zoneSeconds = (activity) => [1, 2, 3, 4, 5].map((z) => num(activity[`hrTimeInZone_${z}`]));

// Ground speed with the hills taken out when the watch knows it: on trails, raw pace says
// more about the terrain than about the runner.
const speedOf = (activity) => activity.avgGradeAdjustedSpeed || activity.averageSpeed || null;

// A run faster than 6.5 m/s (2:34/km) on its moving time is a GPS fault or a ride saved as a
// run: the 10 km world record is about 6.3 m/s. It is dropped.
const FASTEST_PLAUSIBLE = 6.5;
// Past 150 m of climb per km over 20 km the barometer is wrong (the steepest ultras climb
// about 75): the run stays, its elevation doesn't.
const STEEPEST_PLAUSIBLE = 150;
const movingTime = (activity) => activity.movingDuration || activity.duration;

// The history with Garmin's faults taken out, and what was taken out, to report it.
export function screen(activities) {
  const kept = [];
  const faults = [];
  for (const a of activities) {
    const km = num(a.distance) / 1000;
    const fault = { date: dayOf(a), km: round(km), hours: round(num(a.duration) / 3600) };
    if (isRun(a) && movingTime(a) && num(a.distance) / movingTime(a) > FASTEST_PLAUSIBLE) {
      faults.push({ ...fault, fault: "speed", dropped: "run" });
    } else if (isRun(a) && km >= 20 && num(a.elevationGain) / km > STEEPEST_PLAUSIBLE) {
      faults.push({ ...fault, fault: "elevation", dropped: "elevation" });
      kept.push({ ...a, elevationGain: null });
    } else {
      kept.push(a);
    }
  }
  return { activities: kept, faults };
}

// An easy session by the watch's own zones: four fifths of its heart-rate time in Z1–Z2.
// why the zones the watch recorded, not a ceiling from the zones endpoint: the app reads no
// zones, and these are the zones the athlete had set on the day.
export function isEasy(activity) {
  const zones = zoneSeconds(activity);
  const total = zones.reduce((a, b) => a + b, 0);
  return total > 0 && (zones[0] + zones[1]) / total >= 0.8;
}

// Garmin's own per-activity load (EPOC based), summed per day.
function dailyLoad(activities) {
  const days = new Map();
  for (const activity of activities) {
    const day = dayOf(activity);
    if (day) days.set(day, num(days.get(day)) + num(activity.activityTrainingLoad));
  }
  return days;
}

const loadOver = (days, until, length) => {
  let total = 0;
  for (let i = 0; i < length; i++) total += num(days.get(addDays(until, -i)));
  return total;
};

// Acute (7 days) against chronic (28 days, as a weekly average) load, at each of `ends`.
// why rolling sums, not EWMA: the same signal with numbers a person can check by hand; the
// ratio is a warning light (above ~1.5 load rose faster than the body has adapted), not a rule.
export function loadSeries(activities, ends) {
  const days = dailyLoad(activities);
  return ends.map((until) => {
    const acute = loadOver(days, until, 7);
    const chronic = loadOver(days, until, 28) / 4;
    return {
      acute: round(acute, 0),
      chronic: round(chronic, 0),
      ratio: round(acute / chronic, 2),
    };
  });
}

// Time in the three bands that matter for planning: easy (Z1–Z2), the grey zone (Z3) and
// hard (Z4–Z5), as shares of all the time with a heart rate.
export function intensity(activities) {
  const zones = [0, 0, 0, 0, 0];
  for (const activity of activities) zoneSeconds(activity).forEach((s, i) => (zones[i] += s));
  const total = zones.reduce((a, b) => a + b, 0);
  const share = (seconds) => (total ? round((seconds / total) * 100, 0) : null);
  return {
    hours: round(total / 3600),
    easyPct: share(zones[0] + zones[1]),
    moderatePct: share(zones[2]),
    hardPct: share(zones[3] + zones[4]),
  };
}

// Aerobic efficiency of easy runs: the median of metres per minute (grade adjusted) per
// heartbeat, over the runs with both. A rising number means the same effort carries the
// runner further.
export function efficiency(runs) {
  const measured = runs.filter((a) => a.averageHR && speedOf(a));
  return round(median(measured.map((a) => (speedOf(a) * 60) / a.averageHR)), 2);
}
