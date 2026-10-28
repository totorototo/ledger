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

// Least squares of log(hours) on log(effortKm): b, log c, and the spread of the events around
// the curve (the residuals' standard deviation, in log). Null under 3 events or when they
// don't span twice the effort: a curve through one length says nothing of another.
export function fitCurve(points) {
  if (points.length < 3) return null;
  const xs = points.map((p) => Math.log(p.effortKm));
  const ys = points.map((p) => Math.log(p.hours));
  if (Math.max(...xs) - Math.min(...xs) < Math.log(2)) return null;
  const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
  const mx = mean(xs);
  const my = mean(ys);
  const b =
    xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) /
    xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const a = my - b * mx;
  const residuals = ys.map((y, i) => y - (a + b * xs[i]));
  const spread = Math.sqrt(
    residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, points.length - 2),
  );
  return { a, b, spread, residuals };
}

// The stops as a share of the time on the move that grows with it: stops = r × moving², by
// least squares through 0. A 3 h race stops for a drink, a 30 h one for aid stations and sleep.
export function fitStops(points) {
  const den = points.reduce((s, p) => s + p.movingHours ** 4, 0);
  if (!den) return 0;
  const num = points.reduce((s, p) => s + (p.hours - p.movingHours) * p.movingHours ** 2, 0);
  return Math.max(0, num / den);
}

// The clock time at `e` effort-km: the curve's moving time, plus its stops.
const clockAt = (model, e) => {
  const moving = Math.exp(model.curve.a + model.curve.b * Math.log(e));
  return { moving, stops: model.stops * moving ** 2 };
};

// The time at `e` effort-km, with the band the events' spread sets around it.
const predict = (model, e) => {
  const { moving, stops } = clockAt(model, e);
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

// The runner's events and long days of the last 3 years to `until`, the curve through the
// events, and its times for the plan's races ahead (`races`: { date, text } from plan.md, past
// ones marking events) and for the what-if table. `activities` are screened: a run whose
// barometer failed has no climb and is left out. Time is the race clock, `elapsedDuration`:
// Garmin's `duration` stops while the watch is paused, at an aid station or a night's sleep.
export function trailPrediction(activities, until, races = []) {
  const from = addDays(until, -365 * YEARS);
  const planned = new Set(races.filter((r) => r.date <= until).map((r) => r.date));
  const days = activities
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
      };
    })
    .filter((d) => d.why || d.effortKm >= LONG_EFFORT_KM);
  const events = days.filter((d) => d.why);
  const curve = fitCurve(events.map((d) => ({ effortKm: d.effortKm, hours: d.movingHours })));
  // The whole model against the events' clocks: its spread is the band's.
  const model = curve && { curve, stops: fitStops(events), spread: 0 };
  const residuals = model
    ? events.map((d) => {
        const { moving, stops } = clockAt(model, d.effortKm);
        return Math.log(d.hours / (moving + stops));
      })
    : [];
  if (model)
    model.spread = Math.sqrt(
      residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, events.length - 2),
    );
  const span = events.length
    ? [Math.min(...events.map((e) => e.effortKm)), Math.max(...events.map((e) => e.effortKm))]
    : null;
  const ahead = races
    .filter((r) => r.date > until)
    .map((r) => {
      const { km, climbM } = course(r.text);
      const e = km != null && climbM != null ? effortKm(km, climbM) : null;
      return {
        date: r.date,
        text: r.text,
        km,
        climbM,
        effortKm: round(e, 0),
        ...(model && e != null
          ? predict(model, e)
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
      terminus: fitTerminus(events),
    },
    races: ahead,
    grid: model ? GRID.map((e) => ({ effortKm: e, ...predict(model, e) })) : [],
    // The line the page draws: 25 points from 20 to 320 effort-km, evenly on a log scale.
    curve: model
      ? Array.from({ length: 25 }, (_, i) => 20 * 16 ** (i / 24)).map((e) => ({
          effortKm: round(e, 0),
          hours: round(clockAt(model, e).moving + clockAt(model, e).stops, 2),
        }))
      : [],
  };
}
