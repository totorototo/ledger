import { useState } from "react";

import {
  formatDistance,
  formatDuration,
  formatGainTotal,
  formatKmTotal,
  formatTypeKey,
} from "../../utils/format.js";
import { change, niceMax, OTHER } from "../../utils/yearStats.js";

// The pieces the Year and All-time pages share, styled by Stats.style.js.

// What the chart can plot: one measure at a time, on its own axis.
// why one at a time, not km and hours together: two units would need two y-scales.
export const MEASURES = [
  {
    key: "distance",
    label: "Distance",
    scale: (meters) => meters / 1000,
    tick: (km) => `${km.toLocaleString("en-US")} km`,
    format: formatDistance,
  },
  {
    key: "duration",
    label: "Time",
    scale: (seconds) => seconds / 3600,
    tick: (hours) => `${hours.toLocaleString("en-US")} h`,
    format: formatDuration,
  },
  {
    key: "elevationGain",
    label: "Climb",
    scale: (meters) => meters,
    tick: (meters) => `${meters.toLocaleString("en-US")} m`,
    format: (meters) => `${Math.round(meters).toLocaleString("en-US")} m D+`,
  },
];

// Past a dozen columns, only every nth is named (counted from the latest), so the initials
// never crowd on a phone.
const MAX_LABELS = 12;

export const countActivities = (count) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? "activity" : "activities"}`;

// The chart's legend, and the page's filter: one toggle per series, with its swatch and its
// activities on the page (`counts`, typeKey → count), and "All" to clear. Pressing one sums
// only its types; its colour stays the same.
// why the legend is the filter: the colours already name the types, so the filter costs no
// separate control, and the stacks show what a pick would keep before it is made.
export function SeriesLegend({ series, counts, types, onToggle, onClear }) {
  const countOf = (typeKeys) => typeKeys.reduce((sum, key) => sum + (counts.get(key) ?? 0), 0);
  return (
    <div className="legend" role="group" aria-label="Activity type">
      <button type="button" aria-pressed={types.length === 0} onClick={onClear}>
        All
      </button>
      {/* A series with nothing on the page is left out, unless it is picked: then it stays,
          so the pick can be undone here. */}
      {series
        .filter(
          ({ typeKeys }) =>
            countOf(typeKeys) > 0 || typeKeys.every((typeKey) => types.includes(typeKey)),
        )
        .map(({ key, typeKeys, slot }) => (
          <button
            key={key}
            type="button"
            aria-pressed={typeKeys.every((typeKey) => types.includes(typeKey))}
            onClick={() => onToggle(typeKeys)}
          >
            <span className={`swatch ${seriesClass(slot)}`} aria-hidden="true" />
            {key === OTHER ? "Other" : formatTypeKey(typeKeys[0])}
            {/* why aria-hidden: the button's name stays the type alone ("Cycling"). */}
            <span className="legend-count" aria-hidden="true">
              {countOf(typeKeys).toLocaleString("en-US")}
            </span>
          </button>
        ))}
    </div>
  );
}

// Arrow keys, Home and End move the focus between a group's columns, so a chart is one tab
// stop (the column shown carries tabIndex 0, the others -1) and not twelve or fifty.
export function roveColumns(event) {
  const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
  if (!(event.key in moves)) return;
  const columns = [...event.currentTarget.querySelectorAll('[role="img"]')];
  const at = columns.indexOf(document.activeElement);
  if (at < 0) return;
  event.preventDefault();
  columns[Math.max(0, Math.min(columns.length - 1, at + moves[event.key]))].focus();
}

// A series' colour class: its slot's hue, or the neutral grey of "other".
const seriesClass = (slot) => (slot === null ? "series-other" : `series-${slot}`);

// The measure every chart on the page plots: one switch for the page, so two charts never
// show two measures. `value` is a MEASURES key.
export function MeasureSwitch({ value, onChange }) {
  return (
    <div className="measures" role="group" aria-label="Measure">
      {MEASURES.map((m) => (
        <button
          key={m.key}
          type="button"
          aria-pressed={m.key === value}
          onClick={() => onChange(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

const TILES = [
  { key: "count", label: "Activities", format: (n) => n.toLocaleString("en-US") },
  { key: "distance", label: "Distance", format: formatKmTotal },
  { key: "duration", label: "Time", format: formatDuration },
  { key: "elevationGain", label: "Climb", format: formatGainTotal },
];

// Four tiles. `compare` ({ totals, label }) adds each one's change against other totals, as
// "+12% vs 2024 at this date"; a tile with nothing to compare with says so.
// why the change in ink, not the ahead/behind colours: more volume is not always better.
export function Totals({ totals, compare }) {
  return (
    <dl className="totals">
      {TILES.map(({ key, label, format }) => {
        const delta = compare ? change(totals[key], compare.totals[key]) : null;
        return (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{format(totals[key])}</dd>
            {compare && (
              <dd className="delta">
                {delta === null ? (
                  `none ${compare.label}`
                ) : (
                  <>
                    <strong>{delta}</strong> {compare.label}
                  </>
                )}
              </dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}

// One column per period (a month, a year) from one baseline, stacked by series. The line
// above says what the pointer or focus is on, else the best period: one label, never a
// number on every bar. `periods` are { key, label, short, totals, parts } with `parts` a
// Map (series key → totals) and `future` true for a period still to come; `series` as
// chartSeries gives them; `measureKey` the page's
// measure; `noun` names one period ("month", "year").
export function ColumnChart({ periods, series, measureKey, noun, table = true }) {
  const [active, setActive] = useState(null);
  const measure = MEASURES.find((m) => m.key === measureKey);
  const values = periods.map((period) => measure.scale(period.totals[measure.key]));
  const top = niceMax(Math.max(...values));
  const best = values.indexOf(Math.max(...values));
  const shown = active ?? (top > 0 ? best : null);
  const labelEvery = Math.ceil(periods.length / MAX_LABELS);
  const shownParts =
    shown === null
      ? []
      : series.filter(({ key }) => periods[shown].parts.get(key)[measure.key] > 0);
  const Noun = noun[0].toUpperCase() + noun.slice(1);

  return (
    <figure className="chart">
      <div className="chart-head">
        <figcaption className="chart-title">
          {measure.label} per {noun}
        </figcaption>
      </div>
      <p className="readout" aria-live="polite">
        {shown === null ? (
          "Nothing to plot yet."
        ) : (
          <>
            <span className="readout-label">{active === null ? `Best ${noun}` : Noun}</span>
            <strong>{measure.format(periods[shown].totals[measure.key])}</strong>
            <span>
              {periods[shown].label} · {countActivities(periods[shown].totals.count)}
            </span>
            {/* Its make-up, when more than one series is in it. */}
            {shownParts.length > 1 && (
              <span className="readout-parts">
                {shownParts.map(({ key, typeKeys, slot }) => (
                  <span key={key} className="readout-part">
                    <span className={`swatch ${seriesClass(slot)}`} aria-hidden="true" />
                    {key === OTHER ? "Other" : formatTypeKey(typeKeys[0])}{" "}
                    {measure.format(periods[shown].parts.get(key)[measure.key])}
                  </span>
                ))}
              </span>
            )}
          </>
        )}
      </p>
      <div className="plot" onPointerLeave={() => setActive(null)}>
        <div className="grid" aria-hidden="true">
          {[top, top / 2, 0].map((tick) => (
            <span key={tick} className="gridline">
              {measure.tick(tick)}
            </span>
          ))}
        </div>
        <div
          className="columns"
          role="group"
          aria-label={`${measure.label} per ${noun}`}
          onKeyDown={roveColumns}
        >
          {periods.map((period, i) => (
            <div
              key={period.key}
              className={`column${i === shown ? " is-shown" : ""}${period.future ? " is-future" : ""}`}
              role="img"
              tabIndex={i === (shown ?? 0) ? 0 : -1}
              aria-label={
                period.future
                  ? `${period.label}: still to come`
                  : `${period.label}: ${measure.format(period.totals[measure.key])}`
              }
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              {/* The stack: one segment per series with something, first series at the
                  base, a surface gap between segments. */}
              <span className="bar" style={{ height: top > 0 ? `${(values[i] / top) * 100}%` : 0 }}>
                {series.map(({ key, slot }) => {
                  const value = period.parts.get(key)[measure.key];
                  return value > 0 ? (
                    <span
                      key={key}
                      className={`segment ${seriesClass(slot)}`}
                      style={{ flexGrow: value }}
                    />
                  ) : null;
                })}
              </span>
              <span className="month" aria-hidden="true">
                {(periods.length - 1 - i) % labelEvery === 0 ? period.short : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
      {/* why a table too: the chart's colour is faint on light's background (2.1:1), so
          every value is also here as text. */}
      {table && (
        <details className="table-view">
          <summary>{Noun}s as a table</summary>
          <PeriodTable periods={periods} noun={noun} />
        </details>
      )}
    </figure>
  );
}

// The periods' numbers as rows. `onPick` makes each period's name a button.
export function PeriodTable({ periods, noun, onPick }) {
  const Noun = noun[0].toUpperCase() + noun.slice(1);
  return (
    <table aria-label={`${Noun}s`}>
      <thead>
        <tr>
          <th scope="col">{Noun}</th>
          <th scope="col">Activities</th>
          <th scope="col">Distance</th>
          <th scope="col">Time</th>
          <th scope="col">Climb</th>
        </tr>
      </thead>
      <tbody>
        {periods.map(({ key, label, totals, future }) => (
          <tr key={key} className={totals.count === 0 || future ? "is-empty" : undefined}>
            <th scope="row">
              {onPick ? (
                <button type="button" className="pick" onClick={() => onPick(key)}>
                  {label}
                </button>
              ) : (
                label
              )}
            </th>
            {/* A month still to come is no month of zero: its cells say so. */}
            {future ? (
              <td colSpan={4}>still to come</td>
            ) : (
              <>
                <td>{totals.count}</td>
                <td>{formatDistance(totals.distance)}</td>
                <td>{formatDuration(totals.duration)}</td>
                <td>{Math.round(totals.elevationGain).toLocaleString("en-US")} m</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Sports({ sports }) {
  return (
    <section className="sports" aria-labelledby="sports-title">
      <h3 id="sports-title" className="section-title">
        By sport
      </h3>
      <table aria-labelledby="sports-title">
        <thead>
          <tr>
            <th scope="col">Sport</th>
            <th scope="col">Count</th>
            <th scope="col">Distance</th>
            <th scope="col">Time</th>
          </tr>
        </thead>
        <tbody>
          {sports.map((sport) => (
            <tr key={sport.typeKey ?? "none"}>
              <th scope="row">{formatTypeKey(sport.typeKey)}</th>
              <td>{sport.count.toLocaleString("en-US")}</td>
              <td>{sport.distance > 0 ? formatKmTotal(sport.distance) : "–"}</td>
              <td>{formatDuration(sport.duration)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
