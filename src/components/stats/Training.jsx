import { useMemo, useState } from "react";

import { MIN_EASY_RUNS, training } from "../../utils/training.js";
import { roveColumns } from "./parts.jsx";
import TrendChart from "./TrendChart.jsx";

const BANDS = [
  { key: "easyPct", label: "Easy", note: "Z1–Z2", className: "band-easy" },
  { key: "moderatePct", label: "Grey", note: "Z3", className: "band-grey" },
  { key: "hardPct", label: "Hard", note: "Z4–Z5", className: "band-hard" },
];

// The acute:chronic ratio in a word, as text: no status colour.
// why words, not a red zone: the ratio flags a fast rise; it does not predict an injury.
export const ratioWord = (ratio) =>
  ratio < 0.8 ? "easing off" : ratio <= 1.3 ? "steady" : ratio <= 1.5 ? "building" : "a spike";

const counted = (count, of, noun) =>
  `${count.toLocaleString("en-US")} of ${of.toLocaleString("en-US")} ${noun}`;

// How the year's training moved: load per week, the easy runs' efficiency and the time in
// each intensity band per month, Jan 1 to `until`. Every sport counts, whatever the
// legend picks: load and heart rate are the body's, not one sport's.
// why every sport: a hard week of riding is still a hard week for the legs that run.
// why one year, not the whole history: a few hundred weeks on one axis is a noise band.
function Training({ activities, from, until }) {
  const data = useMemo(() => training(activities, from, until), [activities, from, until]);
  const { weeks, months, coverage, faults } = data;
  const hasLoad = coverage.withLoad > 0;
  const hasHR = coverage.runsWithHR > 0;
  if (!hasLoad && !hasHR) return null;

  const speedFaults = faults.filter((f) => f.fault === "speed").length;
  const climbFaults = faults.length - speedFaults;

  return (
    <section className="training" aria-labelledby="training-title">
      {/* The type filter above doesn't reach here: said where the eye lands, not in a note. */}
      <div className="training-head">
        <h3 id="training-title" className="section-title">
          Training
        </h3>
        <span className="tag">All sports</span>
      </div>
      {/* What the charts rest on, so a trend is never read off data it doesn't have. */}
      <p className="coverage">
        From Garmin&apos;s per-activity numbers, whatever the filter. Load on{" "}
        {counted(coverage.withLoad, coverage.activities, "activities")}; heart rate on{" "}
        {counted(coverage.runsWithHR, coverage.runs, "runs")}.
        {speedFaults > 0 &&
          ` ${speedFaults.toLocaleString("en-US")} set aside as GPS faults or rides saved as runs.`}
        {climbFaults > 0 &&
          ` ${climbFaults.toLocaleString("en-US")} kept without their impossible climb.`}
      </p>
      {hasLoad && (
        <TrendChart
          title="Load per week (Garmin training load)"
          label="Training load: the last 7 days against the 28-day weekly average"
          points={weeks}
          lines={[
            {
              key: "acute",
              label: "Last 7 days",
              role: "is-focus",
              values: weeks.map((w) => w.acute),
            },
            {
              key: "chronic",
              label: "28-day weekly average",
              role: "is-before",
              values: weeks.map((w) => w.chronic),
            },
          ]}
          tick={(value) => Math.round(value).toLocaleString("en-US")}
          readout={(i) => (
            <>
              <span className="readout-label">{weeks[i].label}</span>
              <strong>{weeks[i].acute.toLocaleString("en-US")}</strong>
              <span>
                vs {weeks[i].chronic.toLocaleString("en-US")} a week over 28 days
                {weeks[i].ratio !== null &&
                  ` · ratio ${weeks[i].ratio.toFixed(2)}, ${ratioWord(weeks[i].ratio)}`}
              </span>
            </>
          )}
        />
      )}
      <div className="training-pair">
        {hasHR && (
          <TrendChart
            title="Easy-run efficiency"
            label="Metres per heartbeat on easy runs, median per month"
            zero={false}
            points={months}
            lines={[{ key: "eff", role: "is-focus", values: months.map((m) => m.efficiency) }]}
            tick={(value) => value.toFixed(2)}
            note="Grade-adjusted speed over average heart rate, on runs with four fifths of their time in Z1–Z2 by the watch's zones. Rising means the same effort carries you further. Not a VO2max: Garmin's Personal API gives none."
            readout={(i) => (
              <>
                <span className="readout-label">{months[i].label}</span>
                {months[i].efficiency === null ? (
                  <span>
                    {months[i].easyRuns === 0
                      ? "No easy run"
                      : `${months[i].easyRuns} easy run${months[i].easyRuns > 1 ? "s" : ""}: under ${MIN_EASY_RUNS}, no median`}
                  </span>
                ) : (
                  <>
                    <strong>{months[i].efficiency.toFixed(2)} m</strong>
                    <span>per heartbeat · median of {months[i].easyRuns} easy runs</span>
                  </>
                )}
              </>
            )}
          />
        )}
        {hasHR && <IntensityChart months={months} />}
      </div>
    </section>
  );
}

// Each month's heart-rate time split into easy, grey and hard, as shares of one full column.
// why shares, not hours: the question is the balance, and hours would only repeat the volume.
function IntensityChart({ months }) {
  const [active, setActive] = useState(null);
  const latest = months.findLastIndex((m) => m.intensity.hours > 0);
  const shown = active ?? latest;
  const month = shown >= 0 ? months[shown] : null;

  return (
    <figure className="chart share">
      <div className="chart-head">
        <figcaption className="chart-title">Intensity per month</figcaption>
      </div>
      <p className="readout" aria-live="polite">
        {month === null ? (
          "Nothing to plot yet."
        ) : (
          <>
            <span className="readout-label">{month.label}</span>
            {month.intensity.hours > 0 ? (
              <span className="readout-parts">
                {BANDS.map((band) => (
                  <span key={band.key} className="readout-part">
                    <span className={`swatch ${band.className}`} aria-hidden="true" />
                    {band.label} {month.intensity[band.key]}%
                  </span>
                ))}
                <span className="readout-part">{month.intensity.hours} h with heart rate</span>
              </span>
            ) : (
              <span>No heart-rate time</span>
            )}
          </>
        )}
      </p>
      <div className="plot" onPointerLeave={() => setActive(null)}>
        <div className="grid" aria-hidden="true">
          {["100%", "50%", "0%"].map((tick) => (
            <span key={tick} className="gridline">
              {tick}
            </span>
          ))}
        </div>
        <div
          className="columns"
          role="group"
          aria-label="Intensity per month"
          onKeyDown={roveColumns}
        >
          {months.map((m, i) => (
            <div
              key={m.key}
              className={`column${i === shown ? " is-shown" : ""}`}
              role="img"
              tabIndex={i === Math.max(shown, 0) ? 0 : -1}
              aria-label={
                m.intensity.hours > 0
                  ? `${m.label}: ${BANDS.map((b) => `${b.label} ${m.intensity[b.key]}%`).join(", ")}`
                  : `${m.label}: no heart-rate time`
              }
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <span className="bar" style={{ height: m.intensity.hours > 0 ? "100%" : 0 }}>
                {BANDS.map((band) =>
                  m.intensity[band.key] > 0 ? (
                    <span
                      key={band.key}
                      className={`segment ${band.className}`}
                      style={{ flexGrow: m.intensity[band.key] }}
                    />
                  ) : null,
                )}
              </span>
              <span className="month" aria-hidden="true">
                {m.tick}
              </span>
            </div>
          ))}
        </div>
      </div>
      <ul className="line-key">
        {BANDS.map((band) => (
          <li key={band.key}>
            <span className={`swatch ${band.className}`} aria-hidden="true" />
            {band.label} ({band.note})
          </li>
        ))}
      </ul>
    </figure>
  );
}

export default Training;
