import { useMemo, useState } from "react";

import {
  change,
  dayLabel,
  daysIn,
  MONTHS,
  niceMax,
  runningTotal,
  totalAt,
} from "../../utils/yearStats.js";
import { MEASURES } from "./parts.jsx";

// The x axis spans 366 days, so a leap year and a plain one line up day for day.
const LAST_DAY = 365;
const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

// Each year's running total, Jan 1 to Dec 31, as one line on one axis: how the year built up,
// and how it stands against another at the same date. `years` are drawn oldest first; `focus`
// is the year in the trend hue, `against` (the one before by default) dashed, any other a
// faint line. `today` ({ year, day }) ends the current year's line at today.
// why violet and a dash, not the series hues: those hues name sports on this page; a year in
// blue would read as running.
export default function RunningTotal({
  activities,
  years,
  focus,
  against = focus - 1,
  today,
  measureKey,
}) {
  const [active, setActive] = useState(null);
  const measure = MEASURES.find((m) => m.key === measureKey);

  const lines = useMemo(
    () =>
      years.map((year) => {
        const running = runningTotal(activities, year, measureKey);
        const end = year === today.year ? today.day : running.length - 1;
        return { year, running, end };
      }),
    [activities, years, measureKey, today],
  );
  const top = niceMax(measure.scale(Math.max(0, ...lines.map(({ running, end }) => running[end]))));
  const main = lines.find(({ year }) => year === focus);
  const before = lines.find(({ year }) => year === against);
  const hasBefore = before !== undefined && before.running.at(-1) > 0;
  // Read at the pointer, else at the focus year's last drawn day (today, or Dec 31), or at
  // today when the compared year is the current one.
  // why: a past year's whole total against this year's so far would always read as a gain.
  const last = hasBefore && against === today.year ? before.end : main.end;
  const day = active ?? last;
  const nowValue = totalAt(main.running, Math.min(day, main.end));
  const thenValue = hasBefore ? totalAt(before.running, day) : null;
  const delta = hasBefore ? change(nowValue, thenValue) : null;

  const x = (i) => (i / LAST_DAY) * 100;
  const y = (value) => (top > 0 ? 100 - (measure.scale(value) / top) * 100 : 100);
  const path = ({ running, end }) =>
    running
      .slice(0, end + 1)
      .map((value, i) => `${i === 0 ? "M" : "L"}${i} ${y(value).toFixed(2)}`)
      .join("");
  const roleOf = (year) => (year === focus ? "is-focus" : year === against ? "is-before" : "");
  const rank = (year) => (year === focus ? 2 : year === against ? 1 : 0);

  const pick = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const at = Math.round(((event.clientX - box.left) / box.width) * LAST_DAY);
    setActive(Math.max(0, Math.min(LAST_DAY, at)));
  };
  const step = (event) => {
    const moves = { ArrowLeft: -7, ArrowRight: 7, Home: -Infinity, End: Infinity };
    if (!(event.key in moves)) return;
    event.preventDefault();
    setActive(Math.max(0, Math.min(main.end, (active ?? last) + moves[event.key])));
  };

  return (
    <figure className="chart running">
      <div className="chart-head">
        <figcaption className="chart-title">{measure.label} through the year</figcaption>
      </div>
      <p className="readout" aria-live="polite">
        <span className="readout-label">
          {active === null && last === daysIn(focus) - 1
            ? `${focus} total`
            : `${focus} by ${dayLabel(focus, Math.min(day, main.end))}`}
        </span>
        <strong>{measure.format(nowValue)}</strong>
        {hasBefore && (
          <span>
            {delta && <span className="change">{delta}</span>} vs {against} at that date (
            {measure.format(thenValue)})
          </span>
        )}
      </p>
      <div className="plot">
        <div className="grid" aria-hidden="true">
          {[top, top / 2, 0].map((tick) => (
            <span key={tick} className="gridline">
              {measure.tick(tick)}
            </span>
          ))}
        </div>
        <div
          className="lines"
          role="img"
          tabIndex={0}
          aria-label={`${measure.label} through ${focus}: ${measure.format(main.running[main.end])}${
            hasBefore ? `; ${against}: ${measure.format(before.running[before.end])}` : ""
          }`}
          onPointerMove={pick}
          onPointerLeave={() => setActive(null)}
          onKeyDown={step}
          onBlur={() => setActive(null)}
        >
          {/* why preserveAspectRatio none: the lines stretch to the plot; non-scaling strokes
              keep them 2px whatever the stretch. */}
          <svg viewBox={`0 0 ${LAST_DAY} 100`} preserveAspectRatio="none" aria-hidden="true">
            {/* Faint years first, then the compared one, so the focus year is drawn over all. */}
            {[...lines]
              .sort((a, b) => rank(a.year) - rank(b.year))
              .map((line) => (
                <path
                  key={line.year}
                  className={`line ${roleOf(line.year)}`}
                  d={path(line)}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </svg>
          {active !== null && (
            <>
              <span className="crosshair" style={{ left: `${x(active)}%` }} aria-hidden="true" />
              {[main, hasBefore ? before : null]
                .filter((line) => line && active <= line.end)
                .map((line) => (
                  <span
                    key={line.year}
                    className={`dot ${roleOf(line.year)}`}
                    style={{
                      left: `${x(active)}%`,
                      top: `${y(totalAt(line.running, active))}%`,
                    }}
                    aria-hidden="true"
                  />
                ))}
            </>
          )}
          <div className="axis" aria-hidden="true">
            {MONTH_STARTS.map((start, i) => (
              <span key={start} style={{ left: `${x(start)}%` }}>
                {MONTHS[i][0]}
              </span>
            ))}
          </div>
        </div>
      </div>
      <ul className="line-key">
        <li>
          <span className="key-line is-focus" aria-hidden="true" />
          {focus}
        </li>
        {hasBefore && (
          <li>
            <span className="key-line is-before" aria-hidden="true" />
            {against}
          </li>
        )}
        {years.length > 2 && (
          <li>
            <span className="key-line" aria-hidden="true" />
            Earlier years
          </li>
        )}
      </ul>
    </figure>
  );
}
