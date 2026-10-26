import { useState } from "react";

import { niceMax } from "../../utils/yearStats.js";

// A line per series over evenly spaced periods (weeks, months), on one axis. A null value is
// a gap in the line, never a zero. `points` are { key, label, tick } with `tick` the axis's
// name for the point, or "" for none; `lines` are
// { key, label, role, values } with role "is-focus" (the trend hue) or "is-before" (dashed);
// `readout(i)` says what period i holds; `zero` puts the axis's foot at 0.
// `note` says, under the chart, how to read it.
// why not from 0 for a ratio like efficiency: its moves are a few percent, flat from 0.
export default function TrendChart({
  title,
  points,
  lines,
  tick,
  readout,
  label,
  note,
  zero = true,
}) {
  const [active, setActive] = useState(null);
  const values = lines.flatMap((line) => line.values).filter(Number.isFinite);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pad = (max - min) * 0.15 || max * 0.1 || 1;
  const lo = zero ? 0 : Math.max(0, min - pad);
  const hi = zero ? niceMax(max) || 1 : max + pad;
  const last = points.length - 1;
  // Read at the pointer, else at the last period with a value.
  const latest = Math.max(
    ...lines.map((line) => line.values.findLastIndex((value) => Number.isFinite(value))),
  );
  const shown = active ?? latest;

  const x = (i) => (last > 0 ? (i / last) * 100 : 50);
  const y = (value) => 100 - ((value - lo) / (hi - lo)) * 100;
  const path = (line) =>
    line.values
      .map((value, i) => {
        if (!Number.isFinite(value)) return "";
        const move = i === 0 || !Number.isFinite(line.values[i - 1]) ? "M" : "L";
        return `${move}${i} ${y(value).toFixed(2)}`;
      })
      .join("");
  // A period with a value between two gaps has no segment to draw: a dot shows it instead.
  const lone = (line, i) =>
    Number.isFinite(line.values[i]) &&
    !Number.isFinite(line.values[i - 1]) &&
    !Number.isFinite(line.values[i + 1]);
  const ticks = points.flatMap((point, i) => (point.tick ? [{ i, text: point.tick }] : []));

  const pick = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const at = Math.round(((event.clientX - box.left) / box.width) * last);
    setActive(Math.max(0, Math.min(last, at)));
  };
  const step = (event) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
    if (!(event.key in moves)) return;
    event.preventDefault();
    setActive(Math.max(0, Math.min(last, (active ?? latest) + moves[event.key])));
  };

  return (
    <figure className="chart trend">
      <div className="chart-head">
        <figcaption className="chart-title">{title}</figcaption>
      </div>
      <p className="readout" aria-live="polite">
        {shown >= 0 ? readout(shown) : "Nothing to plot yet."}
      </p>
      <div className="plot">
        <div className="grid" aria-hidden="true">
          {[hi, (hi + lo) / 2, lo].map((value, i) => (
            <span key={i} className="gridline">
              {tick(value)}
            </span>
          ))}
        </div>
        <div
          className="lines"
          role="img"
          tabIndex={0}
          aria-label={label}
          onPointerMove={pick}
          onPointerLeave={() => setActive(null)}
          onKeyDown={step}
          onBlur={() => setActive(null)}
        >
          <svg
            viewBox={`0 0 ${Math.max(last, 1)} 100`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {lines.map((line) => (
              <path
                key={line.key}
                className={`line ${line.role}`}
                d={path(line)}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {lines.flatMap((line) =>
            line.values.map((value, i) =>
              lone(line, i) ? (
                <span
                  key={`${line.key}-${i}`}
                  className={`dot is-lone ${line.role}`}
                  style={{ left: `${x(i)}%`, top: `${y(value)}%` }}
                  aria-hidden="true"
                />
              ) : null,
            ),
          )}
          {active !== null && (
            <>
              <span className="crosshair" style={{ left: `${x(active)}%` }} aria-hidden="true" />
              {lines
                .filter((line) => Number.isFinite(line.values[active]))
                .map((line) => (
                  <span
                    key={line.key}
                    className={`dot ${line.role}`}
                    style={{ left: `${x(active)}%`, top: `${y(line.values[active])}%` }}
                    aria-hidden="true"
                  />
                ))}
            </>
          )}
          <div className="axis" aria-hidden="true">
            {ticks.map(({ i, text }) => (
              <span key={i} style={{ left: `${x(i)}%` }}>
                {text}
              </span>
            ))}
          </div>
        </div>
      </div>
      {lines.length > 1 && (
        <ul className="line-key">
          {lines.map((line) => (
            <li key={line.key}>
              <span className={`key-line ${line.role}`} aria-hidden="true" />
              {line.label}
            </li>
          ))}
        </ul>
      )}
      {note && <p className="chart-note">{note}</p>}
    </figure>
  );
}
