// Activities summed up: the totals, each month, each sport, each year. Pure, so the store
// keeps the list as Garmin sent it and the page sums it as it renders.

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const emptyTotals = () => ({ count: 0, distance: 0, duration: 0, elevationGain: 0 });

// Missing numbers (a strength session has no distance) count as nothing, not NaN.
function add(totals, activity) {
  totals.count += 1;
  totals.distance += Number.isFinite(activity.distance) ? activity.distance : 0;
  totals.duration += Number.isFinite(activity.duration) ? activity.duration : 0;
  totals.elevationGain += Number.isFinite(activity.elevationGain) ? activity.elevationGain : 0;
}

// The month (0–11) from the watch's local start, "2026-03-14 07:30:00".
// why not Date: the string has no zone, so Date would move a run near midnight to the
// browser's neighbouring day (and month), as formatLocalStart avoids too.
export function monthOf(startTimeLocal) {
  const match = /^\d{4}-(\d{2})-/.exec(startTimeLocal ?? "");
  return match ? Number(match[1]) - 1 : null;
}

// The year from the watch's local start, read as monthOf reads the month.
export function yearOf(startTimeLocal) {
  const match = /^(\d{4})-/.exec(startTimeLocal ?? "");
  return match ? Number(match[1]) : null;
}

export function summarize(activities) {
  const totals = emptyTotals();
  const months = MONTHS.map(emptyTotals);
  const sports = new Map();
  for (const activity of activities) {
    add(totals, activity);
    const month = monthOf(activity.startTimeLocal);
    if (month !== null) add(months[month], activity);
    const typeKey = activity.activityType?.typeKey ?? null;
    if (!sports.has(typeKey)) sports.set(typeKey, { typeKey, ...emptyTotals() });
    add(sports.get(typeKey), activity);
  }
  // Most time first: time is the one measure every sport has.
  const bySport = [...sports.values()].sort((a, b) => b.duration - a.duration);
  return { totals, months, sports: bySport };
}

// The activities whose type is one of `typeKeys`; every activity when none is picked.
// An activity with no type has the key null, as in summarize's sports.
export function filterByType(activities, typeKeys) {
  if (typeKeys.length === 0) return activities;
  const picked = new Set(typeKeys);
  return activities.filter((activity) => picked.has(activity.activityType?.typeKey ?? null));
}

// How many activities each type has, keyed as summarize's sports.
export function countByType(activities) {
  const counts = new Map();
  for (const activity of activities) {
    const key = activity.activityType?.typeKey ?? null;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// The key of the series that folds every type past the chart's colours.
export const OTHER = "other";

// The chart's series: the `max` types with most time, each its own slot (1–max), then the
// rest folded into one "other". Ranked on an unfiltered list, so a filter never repaints a
// type: colour follows the type, not its rank among what is shown.
// why four: the palette's first four hues stay apart for colour-blind readers when stacked;
// a fifth would be a hue nobody can tell from its neighbour.
// `picked` types missing from the list come last, so a pick made elsewhere can be undone here
// without moving any other type's colour.
export function chartSeries(activities, picked = [], max = 4) {
  const present = summarize(activities).sports.map((sport) => sport.typeKey);
  const ranked = [...present, ...picked.filter((typeKey) => !present.includes(typeKey))];
  const series = ranked
    .slice(0, max)
    .map((typeKey, i) => ({ key: typeKey ?? "none", typeKeys: [typeKey], slot: i + 1 }));
  if (ranked.length > max) series.push({ key: OTHER, typeKeys: ranked.slice(max), slot: null });
  return series;
}

// Each period's totals, split by series: one Map (series key → totals) per entry of
// `periods`, in order. `periodOf` reads an activity's period from its startTimeLocal.
// A type in no series (not in the ranked list) is left out.
export function stackTotals(activities, series, periodOf, periods) {
  const seriesOf = new Map();
  for (const { key, typeKeys } of series)
    for (const typeKey of typeKeys) seriesOf.set(typeKey, key);
  const cells = new Map(
    periods.map((period) => [period, new Map(series.map(({ key }) => [key, emptyTotals()]))]),
  );
  for (const activity of activities) {
    const cell = cells.get(periodOf(activity.startTimeLocal));
    const key = seriesOf.get(activity.activityType?.typeKey ?? null);
    if (cell && key !== undefined) add(cell.get(key), activity);
  }
  return periods.map((period) => cells.get(period));
}

// One entry per year from the first activity's to `until`, the empty years in between kept
// at zero so the chart's gaps show as gaps. The activities are grouped too, by year.
export function byYear(activities, until) {
  const groups = new Map();
  for (const activity of activities) {
    const year = yearOf(activity.startTimeLocal);
    if (year === null) continue;
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(activity);
  }
  if (groups.size === 0) return [];
  const first = Math.min(...groups.keys());
  const last = Math.max(until, ...groups.keys());
  return Array.from({ length: last - first + 1 }, (_, i) => {
    const list = groups.get(first + i) ?? [];
    return { year: first + i, activities: list, totals: summarize(list).totals };
  });
}

// The axis's top: the smallest of 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ at or above the largest
// value. Each halves to a round mid tick (750, 1,250, 1,500…).
// why not 1, 2, 5: 1,260 km got a 2,000 km axis, a third of the plot left empty.
const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

export function niceMax(value) {
  if (!(value > 0)) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = NICE.find((m) => m * power >= value * (1 - 1e-9));
  return Number((step * power).toPrecision(12));
}

// The days in `year`: 366 in a leap year.
export const daysIn = (year) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// The day of the year (0 for Jan 1) from the watch's local start, read as monthOf reads the
// month, so a run near midnight stays on the watch's day.
export function dayOfYear(startTimeLocal) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(startTimeLocal ?? "");
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const leap = daysIn(year) === 366 && month > 2 ? 1 : 0;
  return MONTH_DAYS.slice(0, month - 1).reduce((sum, days) => sum + days, 0) + day - 1 + leap;
}

// "Mar 14" for a day of `year`, as dayOfYear counts it.
export function dayLabel(year, day) {
  let left = day;
  for (let month = 0; month < 12; month += 1) {
    const days = MONTH_DAYS[month] + (month === 1 && daysIn(year) === 366 ? 1 : 0);
    if (left < days) return `${MONTHS[month]} ${left + 1}`;
    left -= days;
  }
  return `${MONTHS[11]} 31`;
}

// The running total of `key` (distance, duration, elevationGain) at the end of each day of
// `year`: one number per day, the last the year's total. Activities of other years are left
// out, so a year's or the whole history's list can be passed.
// why per day, not per activity: two years then line up day for day, and "this date last
// year" is one index.
export function runningTotal(activities, year, key) {
  const days = new Array(daysIn(year)).fill(0);
  for (const activity of activities) {
    if (yearOf(activity.startTimeLocal) !== year) continue;
    const value = activity[key];
    if (Number.isFinite(value)) days[dayOfYear(activity.startTimeLocal)] += value;
  }
  for (let i = 1; i < days.length; i += 1) days[i] += days[i - 1];
  return days;
}

// The running total at `day`, or at the year's last day when `day` is past it (Dec 31 of a
// leap year, read against a plain one).
export const totalAt = (running, day) => running[Math.min(day, running.length - 1)];

// Today on the browser's clock, as { year, day, iso }: day as dayOfYear counts it, iso the
// "YYYY-MM-DD" the Training section steps to.
// why the browser's clock here: it is "now" for the person reading, not a watch's start time.
export function today(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return { year: now.getFullYear(), day: dayOfYear(local), iso: local };
}

// The change from `then` to `now` as "+12%", "−8%" or "±0%"; null when there is no `then` to
// compare with (a percentage of nothing).
export function change(now, then) {
  if (!(then > 0)) return null;
  const percent = Math.round(((now - then) / then) * 100);
  return `${percent > 0 ? "+" : percent < 0 ? "−" : "±"}${Math.abs(percent)}%`;
}
