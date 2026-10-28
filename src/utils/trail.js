// Trail and ultra times from the runner's own events, for the trail-predictor skill. Pure.
// Distance and climb go into one effort figure, the effort-km (km + D+ / 100, ITRA's), and the
// runner's events of the last 3 years are fitted in two parts, as Terminus plans a race: the
// time on the move, moving = c × effortKm^b (Riegel's power law with the runner's own fatigue
// exponent b, not the road's 1.06), and the stops on top, stops = r × moving².
// why the runner's own curve: on trail, terrain, night and aid stations set the time as much as
// fitness; the runner's own races carry all of it, a road formula none.
// why moving and stops apart: an ultra's clock holds hours of aid stations and sleep that a
// short race has none of; one curve through both lends the ultras' sleep to every length.

import { addDays, dayOf, isRun } from "./metrics.js";

// Events of the last 3 years: older ones were run with another body.
export const YEARS = 3;
// A day this long is an event whatever Garmin's flag says: nobody trains 100 effort-km.
export const ULTRA_EFFORT_KM = 100;
// Long days under it are shown as training, never fitted.
export const LONG_EFFORT_KM = 30;
// The effort-km the what-if table reads at.
export const GRID = [50, 100, 150, 200, 300];
// The ground a plan line may name. Mixed, or none, is the curve itself; runnable and technical
// each get a factor on the time on the move, fitted once at least MIN_GROUND events carry it.
// why a tag and not a measure: effort-km knows distance and climb, never the ground, and the
// summaries hold nothing that tells a forest road from a boulder field. The runner does.
export const GROUNDS = ["runnable", "technical"];
export const MIN_GROUND = 2;
// Terminus's limits on its settings (gpxz `Settings.validate`).
export const TERMINUS_FATIGUE_MAX = 0.05;

const round = (value, digits = 1) =>
  // + 0: a perfect fit's -0 reads as 0.
  Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits + 0 : null;

export const effortKm = (km, climbM) => km + climbM / 100;

// 38.67 h → "38h40"; 3.2 h → "3h12".
export function hm(hours) {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

// A race line's course: "81 km", "2100 m D+" (or "D+ 2100", "2100 m+"). Null where it isn't said.
export function course(text) {
  const km = text.match(/(\d+(?:[.,]\d+)?)\s*km\b/i);
  const climb =
    text.match(/(\d[\d\s]{2,6})\s*m\s*(?:D\+|\+)/i) ?? text.match(/D\+\s*(\d[\d\s]{2,6})/i);
  return {
    km: km ? Number(km[1].replace(",", ".")) : null,
    climbM: climb ? Number(climb[1].replace(/\s/g, "")) : null,
  };
}

// A race line's name: the text before its course and result ("Col Trail, The Ridge 43 km
// 2800 m D+, 8:33:13" → "Col Trail, The Ridge").
export const raceName = (text) =>
  text
    .replace(/,?\s*(?:DNF|\d{1,3}[:h]\d{2}(?::\d{2})?)\b.*$/i, "")
    .replace(/\s+\d[\d.,]*\s*km\b.*$/i, "")
    .trim();

// A past race line's result: its clock ("15:26:19", "15:26", "15h26") or a DNF. Empty when
// it says neither.
export function result(text) {
  if (/\bDNF\b/i.test(text)) return { dnf: true };
  const time = text.match(/\b(\d{1,3})[:h](\d{2})(?::(\d{2}))?\b/);
  if (!time) return {};
  return { hours: Number(time[1]) + Number(time[2]) / 60 + Number(time[3] ?? 0) / 3600 };
}

// A race line's ground: "runnable", "technical" (or "roulant", "technique"), else null.
export function ground(text) {
  if (/\b(?:technical|technique)\b/i.test(text)) return "technical";
  if (/\b(?:runnable|roulante?)\b/i.test(text)) return "runnable";
  return null;
}

// Solves the square system m · x = v by Gaussian elimination with partial pivoting.
function solve(m, v) {
  const n = v.length;
  const rows = m.map((row, i) => [...row, v[i]]);
  for (let c = 0; c < n; c++) {
    const pivot = rows.reduce(
      (best, row, r) => (r >= c && Math.abs(row[c]) > Math.abs(rows[best][c]) ? r : best),
      c,
    );
    [rows[c], rows[pivot]] = [rows[pivot], rows[c]];
    for (let r = c + 1; r < n; r++) {
      const f = rows[r][c] / rows[c][c];
      for (let k = c; k <= n; k++) rows[r][k] -= f * rows[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--)
    x[r] =
      (rows[r][n] - rows[r].slice(r + 1, n).reduce((s, q, k) => s + q * x[r + 1 + k], 0)) /
      rows[r][r];
  return x;
}

// Least squares of log(hours) on log(effortKm), plus one shift per ground that at least
// MIN_GROUND events carry: log hours = a + b·log(effortKm) + t[ground]. Returns a, b, `grounds`
// ({ runnable: t } for the fitted ones), the residuals and their standard deviation, the
// spread. Null under 3 events or when they don't span twice the effort: a curve through one
// length says nothing of another.
// why one curve with shifts, not a curve per ground: the fatigue exponent is the runner's;
// the ground moves the level, and two SaintéLyon-sized events can't carry a slope.
export function fitCurve(points) {
  if (points.length < 3) return null;
  const xs = points.map((p) => Math.log(p.effortKm));
  if (Math.max(...xs) - Math.min(...xs) < Math.log(2)) return null;
  // A ground needs MIN_GROUND events, the mixed rest as many to be measured against, and the
  // fit one event more than it has numbers: the rarest ground joins mixed until all three hold.
  const count = (g) => points.filter((p) => p.ground === g).length;
  let fitted = GROUNDS.filter((g) => count(g) >= MIN_GROUND);
  const enough = () =>
    points.length - fitted.reduce((s, g) => s + count(g), 0) >= MIN_GROUND &&
    points.length > 2 + fitted.length;
  while (fitted.length && !enough())
    fitted = fitted.filter((g) => g !== fitted.reduce((a, b) => (count(b) < count(a) ? b : a)));
  const row = (p, i) => [1, xs[i], ...fitted.map((g) => (p.ground === g ? 1 : 0))];
  const X = points.map(row);
  const ys = points.map((p) => Math.log(p.hours));
  const k = X[0].length;
  const xtx = Array.from({ length: k }, (_, r) =>
    Array.from({ length: k }, (_, c) => X.reduce((s, x) => s + x[r] * x[c], 0)),
  );
  const xty = Array.from({ length: k }, (_, r) => X.reduce((s, x, i) => s + x[r] * ys[i], 0));
  const [a, b, ...shifts] = solve(xtx, xty);
  const grounds = Object.fromEntries(fitted.map((g, i) => [g, shifts[i]]));
  const residuals = ys.map((y, i) => y - X[i].reduce((s, x, c) => s + x * [a, b, ...shifts][c], 0));
  const spread = Math.sqrt(
    residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, points.length - k),
  );
  return { a, b, grounds, spread, residuals };
}

// The shift of a ground on log moving time: 0 for mixed, none, or a ground too rare to fit.
const shiftOf = (curve, g) => curve.grounds?.[g] ?? 0;

// The stops as a share of the time on the move that grows with it: stops = r × moving², by
// least squares through 0. A 3 h race stops for a drink, a 30 h one for aid stations and sleep.
export function fitStops(points) {
  const den = points.reduce((s, p) => s + p.movingHours ** 4, 0);
  if (!den) return 0;
  const num = points.reduce((s, p) => s + (p.hours - p.movingHours) * p.movingHours ** 2, 0);
  return Math.max(0, num / den);
}

// The clock time at `e` effort-km on ground `g`: the curve's moving time, plus its stops.
const clockAt = (model, e, g = null) => {
  const moving = Math.exp(model.curve.a + model.curve.b * Math.log(e) + shiftOf(model.curve, g));
  return { moving, stops: model.stops * moving ** 2 };
};

// The time at `e` effort-km, with the band the events' spread sets around it.
const predict = (model, e, g = null) => {
  const { moving, stops } = clockAt(model, e, g);
  const hours = moving + stops;
  return {
    hours: round(hours, 2),
    time: hm(hours),
    low: hm(hours * Math.exp(-model.spread)),
    high: hm(hours * Math.exp(model.spread)),
    moving: hm(moving),
    stops: hm(stops),
  };
};

// The same events in Terminus's pace model (gpxz `pace_model.zig`): the pace at x effort-km
// in is base × e^(k·x), so the time on the move to E is base × (e^(kE) − 1) / k. Base and k
// by least squares on log time: for each k on a grid, log base is the mean residual. Null
// under 3 events.
// why a grid over k: one parameter on a bounded range, 5000 steps of a sum over a handful of
// events; no solver to get wrong.
export function fitTerminus(points) {
  if (points.length < 3) return null;
  const shape = (k, e) => (k === 0 ? e : Math.expm1(k * e) / k);
  let best = null;
  for (let i = 0; i <= 5000; i++) {
    const k = (TERMINUS_FATIGUE_MAX * i) / 5000;
    const logs = points.map((p) => Math.log(p.movingHours) - Math.log(shape(k, p.effortKm)));
    const logBase = logs.reduce((a, b) => a + b, 0) / logs.length;
    const sse = logs.reduce((s, l) => s + (l - logBase) ** 2, 0);
    if (!best || sse < best.sse) best = { k, logBase, sse };
  }
  const seconds = Math.exp(best.logBase) * 3600;
  return {
    basePaceSPerKm: Math.round(seconds),
    basePace: `${Math.floor(Math.round(seconds) / 60)}:${String(Math.round(seconds) % 60).padStart(2, "0")}`,
    fatigueCoefficient: round(best.k, 4),
    spreadPct: round((Math.exp(Math.sqrt(best.sse / Math.max(1, points.length - 2))) - 1) * 100, 0),
  };
}

// Terminus's settings with a base pace per fitted ground: Terminus knows the slope, not the
// ground, so a technical course runs at the technical base pace.
function terminusFor(settings, curve) {
  if (!settings) return null;
  const pace = (seconds) =>
    `${Math.floor(Math.round(seconds) / 60)}:${String(Math.round(seconds) % 60).padStart(2, "0")}`;
  return {
    ...settings,
    basePaceByGround: Object.fromEntries(
      Object.entries(curve.grounds).map(([g, t]) => [
        g,
        pace(settings.basePaceSPerKm * Math.exp(t)),
      ]),
    ),
  };
}

// The runner's events, the curve through them, and its times for the plan's races ahead and
// the what-if table. Events are of two kinds:
// - the plan's past races with a result ("…, 15:26:19", "…, DNF", `result`): the official
//   course and clock, whatever their age, since the runner chose to list them. Garmin's run that
//   day gives the time on the move only when its distance is within 15% of the course's: a watch
//   left running before or after the race, or a run to the start, records something else.
// - Garmin's runs of the last 3 years flagged a race, on a plan race's date, or of 100 effort-km
//   or more. A DNF in the plan takes its day out.
// `activities` are screened: a run whose barometer failed has no climb and is left out. Time
// is the race clock, `elapsedDuration`: Garmin's `duration` stops while the watch is paused,
// at an aid station or a night's sleep.
// why official results over the watch: a DNF recorded to the drop looks like a slow finish,
// and a race can't be told from its approach run; the result sheet says what was raced.
export function trailPrediction(activities, until, races = []) {
  const from = addDays(until, -365 * YEARS);
  const past = races
    .filter((r) => r.date <= until)
    .map((r) => ({ ...r, ...course(r.text), ...result(r.text) }));
  const planned = new Set(past.map((r) => r.date));
  // The ground of a day the plan names a race on.
  const groundOn = new Map(past.map((r) => [r.date, ground(r.text)]));
  const dnf = new Set(past.filter((r) => r.dnf).map((r) => r.date));
  const results = past.filter((r) => r.hours != null);
  const resulted = new Set(results.map((r) => r.date));
  const runs = activities
    .filter((a) => isRun(a) && dayOf(a) >= from && dayOf(a) <= until)
    .filter((a) => a.distance > 0 && (a.elapsedDuration ?? a.duration) > 0)
    .filter((a) => a.elevationGain != null)
    .map((a) => {
      const km = a.distance / 1000;
      const clock = (a.elapsedDuration ?? a.duration) / 3600;
      const moving = Math.min(clock, (a.movingDuration ?? a.elapsedDuration ?? a.duration) / 3600);
      const e = effortKm(km, a.elevationGain);
      const why =
        a.eventType?.typeKey === "race"
          ? "race"
          : planned.has(dayOf(a))
            ? "plan"
            : e >= ULTRA_EFFORT_KM
              ? "ultra"
              : null;
      return {
        date: dayOf(a),
        name: a.activityName ?? null,
        km: round(km),
        climbM: Math.round(a.elevationGain),
        effortKm: round(e, 0),
        hours: round(clock, 2),
        time: hm(clock),
        movingHours: round(moving, 2),
        moving: hm(moving),
        stops: hm(clock - moving),
        speed: round(e / moving, 2),
        why,
        ground: groundOn.get(dayOf(a)) ?? null,
        // The plan says what the day was: a DNF, or a race whose result stands in for the run.
        note: dnf.has(dayOf(a)) ? "DNF" : resulted.has(dayOf(a)) ? "plan result" : null,
      };
    });
  // A run a result stands in for is that result; a DNF stays in sight among the long days.
  const days = runs
    .filter((d) => d.note !== "plan result")
    .map((d) => (d.note ? { ...d, why: null } : d))
    .filter((d) => d.why || d.effortKm >= LONG_EFFORT_KM);
  // A result's time on the move: the watch's when its run that day is the course, else unknown.
  const official = results
    .filter((r) => r.km != null && r.climbM != null)
    .map((r) => {
      const e = effortKm(r.km, r.climbM);
      const run = runs.find((d) => d.date === r.date && Math.abs(d.km / r.km - 1) <= 0.15);
      return {
        date: r.date,
        name: raceName(r.text),
        km: r.km,
        climbM: r.climbM,
        effortKm: round(e, 0),
        hours: round(r.hours, 2),
        time: hm(r.hours),
        movingHours: run ? Math.min(run.movingHours, r.hours) : null,
        moving: run ? hm(Math.min(run.movingHours, r.hours)) : null,
        stops: run ? hm(r.hours - Math.min(run.movingHours, r.hours)) : null,
        speed: round(e / (run ? Math.min(run.movingHours, r.hours) : r.hours), 2),
        why: "result",
        ground: ground(r.text),
      };
    });
  const events = [...official, ...days.filter((d) => d.why)];
  // Stops from the events whose time on the move is known; the others' moving time is what the
  // stops model leaves of their clock: moving + r × moving² = clock.
  const stops = fitStops(events.filter((d) => d.movingHours != null));
  const movingOf = (d) =>
    d.movingHours ?? (stops > 0 ? (Math.sqrt(1 + 4 * stops * d.hours) - 1) / (2 * stops) : d.hours);
  const curve = fitCurve(
    events.map((d) => ({ effortKm: d.effortKm, hours: movingOf(d), ground: d.ground })),
  );
  // The whole model against the events' clocks: its spread is the band's.
  const model = curve && { curve, stops, spread: 0 };
  const residuals = model
    ? events.map((d) => {
        const { moving, stops } = clockAt(model, d.effortKm, d.ground);
        return Math.log(d.hours / (moving + stops));
      })
    : [];
  const params = 2 + (curve ? Object.keys(curve.grounds).length : 0);
  if (model)
    model.spread = Math.sqrt(
      residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, events.length - params),
    );
  const span = events.length
    ? [Math.min(...events.map((e) => e.effortKm)), Math.max(...events.map((e) => e.effortKm))]
    : null;
  const ahead = races
    .filter((r) => r.date > until)
    .map((r) => {
      const { km, climbM } = course(r.text);
      const e = km != null && climbM != null ? effortKm(km, climbM) : null;
      const g = ground(r.text);
      return {
        date: r.date,
        text: r.text,
        name: raceName(r.text),
        km,
        climbM,
        effortKm: round(e, 0),
        ground: g,
        // A ground named but too rare among the events to fit reads as mixed: say so.
        groundFitted: g == null || (curve != null && curve.grounds[g] != null),
        ...(model && e != null
          ? predict(model, e, g)
          : { hours: null, time: null, low: null, high: null, moving: null, stops: null }),
        // Inside the events' range the curve interpolates; outside it, it guesses.
        within: e != null && span != null && e >= span[0] && e <= span[1],
      };
    });
  return {
    from,
    until,
    events: events
      .map((d, i) => ({
        ...d,
        offPct: model ? round((Math.exp(residuals[i]) - 1) * 100, 0) : null,
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    training: days.filter((d) => !d.why).sort((a, b) => b.date.localeCompare(a.date)),
    fit: model && {
      events: events.length,
      exponent: round(curve.b, 2),
      stopsAt30h: hm(model.stops * 30 ** 2),
      spreadPct: round((Math.exp(model.spread) - 1) * 100, 0),
      fromEffortKm: span[0],
      toEffortKm: span[1],
      // Each fitted ground's factor on the time on the move against mixed ground.
      grounds: Object.fromEntries(
        GROUNDS.map((g) => [
          g,
          curve.grounds[g] == null
            ? null
            : {
                events: events.filter((d) => d.ground === g).length,
                pct: round((Math.exp(curve.grounds[g]) - 1) * 100, 0),
              },
        ]),
      ),
      // On mixed ground: each event's time on the move with its ground's factor taken out.
      terminus: terminusFor(
        fitTerminus(
          events.map((d) => ({
            effortKm: d.effortKm,
            movingHours: movingOf(d) / Math.exp(shiftOf(curve, d.ground)),
          })),
        ),
        curve,
      ),
    },
    races: ahead,
    grid: model ? GRID.map((e) => ({ effortKm: e, ...predict(model, e) })) : [],
    // The line the page draws: 25 points from 20 to 400 effort-km, evenly on a log scale.
    curve: model
      ? Array.from({ length: 25 }, (_, i) => 20 * 20 ** (i / 24)).map((e) => ({
          effortKm: round(e, 0),
          hours: round(clockAt(model, e).moving + clockAt(model, e).stops, 2),
        }))
      : [],
  };
}
