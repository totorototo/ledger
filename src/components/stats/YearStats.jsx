import { ChevronDown } from "@styled-icons/feather/ChevronDown";
import { ChevronLeft } from "@styled-icons/feather/ChevronLeft";
import { ChevronRight } from "@styled-icons/feather/ChevronRight";
import { useEffect, useMemo } from "react";

import useStore from "../../store/store.js";
import {
  chartSeries,
  countByType,
  dayOfYear,
  filterByType,
  monthOf,
  MONTHS,
  stackTotals,
  summarize,
  today,
} from "../../utils/yearStats.js";
import LoadingSpinner from "../loadingSpinner/LoadingSpinner.jsx";
import { ColumnChart, MeasureSwitch, SeriesLegend, Sports, Totals } from "./parts.jsx";
import RunningTotal from "./RunningTotal.jsx";
import style from "./Stats.style.js";
import Training from "./Training.jsx";

function YearStats({ className }) {
  const year = useStore((state) => state.year);
  const entry = useStore((state) => state.years[state.year]);
  const before = useStore((state) => state.years[state.year - 1]);
  const showYear = useStore((state) => state.showYear);
  const loadYear = useStore((state) => state.loadYear);
  const compareWith = useStore((state) => state.compareWith);
  // The first year with an activity, once the whole history is read: no going back past it.
  const firstYear = useStore((state) => state.history?.firstYear ?? null);
  const thisYear = new Date().getFullYear();
  const earliest = Math.min(firstYear ?? thisYear - 9, year);
  const pickable = Array.from({ length: thisYear - earliest + 1 }, (_, i) => thisYear - i);
  // The year compared with: the one picked, kept as the shown year changes, else the year
  // before; none before the first activity's year.
  // why a picked year stays put: stepping through years against one reference (2021, a
  // record year) is the question; a picker that reset on every step would lose it.
  const pinned = useStore((state) => state.against);
  const against =
    pinned !== null && pinned !== year
      ? pinned
      : firstYear === null || year - 1 >= firstYear
        ? year - 1
        : null;
  const other = useStore((state) => (against === null ? undefined : state.years[against]));
  const types = useStore((state) => state.types);
  const toggleTypes = useStore((state) => state.toggleTypes);
  const clearTypes = useStore((state) => state.clearTypes);
  const measure = useStore((state) => state.measure);
  const setMeasure = useStore((state) => state.setMeasure);
  // why rank on the whole history once it is read: a type then keeps its colour from one
  // year to the next. Before that, the year's own list ranks it.
  const ranking = useStore((state) =>
    state.history?.status === "ready" ? state.history.activities : null,
  );
  const all = entry?.activities;
  const series = useMemo(() => chartSeries(ranking ?? all ?? [], types), [ranking, all, types]);
  const counts = useMemo(() => countByType(all ?? []), [all]);
  const shown = useMemo(() => filterByType(all ?? [], types), [all, types]);
  const summary = useMemo(() => summarize(shown), [shown]);
  // This year's and the compared one's, filtered alike, for the running total.
  const compared = useMemo(
    () =>
      other?.status === "ready" ? [...filterByType(other.activities, types), ...shown] : shown,
    [other, types, shown],
  );
  const parts = useMemo(
    () =>
      stackTotals(
        shown,
        series,
        monthOf,
        MONTHS.map((_, i) => i),
      ),
    [shown, series],
  );
  const now = useMemo(() => today(), []);
  // This year's months past the current one are still to come, not months of nothing.
  const lastMonth = year === now.year ? Number(now.iso.slice(5, 7)) - 1 : 11;
  const months = summary.months.map((totals, i) => ({
    key: MONTHS[i],
    label: MONTHS[i],
    short: MONTHS[i][0],
    totals,
    parts: parts[i],
    future: i > lastMonth,
  }));
  const pair = useMemo(
    () => (against === null ? [year] : [Math.min(year, against), Math.max(year, against)]),
    [year, against],
  );
  // Training reads every sport, and the year before for January's 28-day load.
  const both = useMemo(
    () => (before?.status === "ready" ? [...before.activities, ...all] : (all ?? [])),
    [before, all],
  );
  const until = year === now.year ? now.iso : `${year}-12-31`;
  // The compared year, filtered alike. When either year is the current one, both are cut at
  // today's date: a whole year against ten months would always read as a drop (or a gain).
  const compare = useMemo(() => {
    if (against === null || other?.status !== "ready") return null;
    const sameTypes = filterByType(other.activities, types);
    const toDate = (list) => list.filter((a) => dayOfYear(a.startTimeLocal) <= now.day);
    if (year === now.year) {
      return { totals: summarize(toDate(sameTypes)).totals, label: `vs ${against} at this date` };
    }
    if (against === now.year) {
      return {
        totals: summarize(sameTypes).totals,
        base: summarize(toDate(shown)).totals,
        label: `vs ${against} at this date`,
      };
    }
    return { totals: summarize(sameTypes).totals, label: `vs ${against}` };
  }, [against, other, types, year, shown, now]);

  // The year shown is read as the page opens, and again after Refresh forgets it.
  useEffect(() => {
    if (!entry) loadYear(year);
  }, [entry, year, loadYear]);

  // The year before too, for Training's January: one more read, kept as any year is.
  // why not the whole history: a year is one or two requests, the history one per 100.
  useEffect(() => {
    if (!before && (firstYear === null || year - 1 >= firstYear)) loadYear(year - 1);
  }, [before, year, firstYear, loadYear]);

  // And the compared year, when it isn't that one.
  useEffect(() => {
    if (against !== null && !other) loadYear(against);
  }, [against, other, loadYear]);

  const others = pickable.filter((y) => y !== year);

  const legend = (
    <SeriesLegend
      series={series}
      counts={counts}
      types={types}
      onToggle={toggleTypes}
      onClear={clearTypes}
    />
  );

  return (
    <section className={className} aria-labelledby="year-title">
      <span className="eyebrow">{year === now.year ? "Year to date" : "Year in review"}</span>
      <div className="heading">
        {/* The title is the year picker: a native select laid over it, invisible, so the
            heading still reads "2025" and phones get their own wheel.
            why not a second "2025" beside the arrows: the year showed twice. */}
        <div className="title-pick">
          <h2 id="year-title" className="title">
            {year}
            <ChevronDown className="title-caret" size={20} aria-hidden="true" />
          </h2>
          <select
            aria-label="Year"
            value={year}
            onChange={(event) => showYear(Number(event.target.value))}
          >
            {pickable.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {/* The arrows next to the title: they step that year.
            why before the compared year: on a phone the comparison wraps under the year
            instead of the arrows wrapping away from it. */}
        <div className="years">
          <button
            type="button"
            aria-label="Previous year"
            onClick={() => showYear(year - 1)}
            disabled={firstYear !== null && year <= firstYear}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next year"
            onClick={() => showYear(year + 1)}
            disabled={year >= thisYear}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        {/* The year compared with, a picker as the title is: the tiles' changes and the
            running total's dashed line follow it. */}
        {others.length > 0 && (
          <div className="against">
            <span aria-hidden="true">vs</span>
            <div className="title-pick">
              <span className="against-year">
                {against ?? "—"}
                <ChevronDown className="title-caret" size={16} aria-hidden="true" />
              </span>
              <select
                aria-label="Compare with"
                value={against ?? ""}
                onChange={(event) => compareWith(Number(event.target.value))}
              >
                {against === null && (
                  <option value="" disabled>
                    —
                  </option>
                )}
                {others.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
      {/* The page's controls: the type filter and the measure, over everything below them. */}
      {entry?.status === "ready" && (summary.totals.count > 0 || types.length > 0) && (
        <div className="controls">
          {legend}
          {summary.totals.count > 0 && <MeasureSwitch value={measure} onChange={setMeasure} />}
        </div>
      )}
      {(!entry || entry.status === "loading") && <LoadingSpinner label={`Reading ${year}…`} />}
      {entry?.status === "error" && (
        <div className="year-error" role="alert">
          <p>{entry.error}</p>
          <button type="button" onClick={() => loadYear(year)}>
            Try again
          </button>
        </div>
      )}
      {entry?.status === "ready" &&
        (summary.totals.count === 0 ? (
          <p className="empty">
            {types.length === 0 ? `No activities in ${year}.` : `None of these types in ${year}.`}
          </p>
        ) : (
          <>
            <Totals totals={summary.totals} compare={compare} />
            <ColumnChart periods={months} series={series} measureKey={measure} noun="month" />
            <RunningTotal
              activities={compared}
              years={pair}
              focus={year}
              against={against}
              today={now}
              measureKey={measure}
            />
            <Training activities={both} from={`${year}-01-01`} until={until} />
            {/* why the months only behind the chart's disclosure: the chart already shows
                them; the table stays one click away for exact figures. */}
            <Sports sports={summary.sports} />
          </>
        ))}
    </section>
  );
}

export default style(YearStats);
