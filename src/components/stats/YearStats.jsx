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
  // The first year with an activity, once the whole history is read: no going back past it.
  const firstYear = useStore((state) => state.history?.firstYear ?? null);
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
  // This year's and the one before's, filtered alike, for the running total.
  const compared = useMemo(
    () =>
      before?.status === "ready" ? [...filterByType(before.activities, types), ...shown] : shown,
    [before, types, shown],
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
  const thisYear = new Date().getFullYear();
  const earliest = Math.min(firstYear ?? thisYear - 9, year);
  const pickable = Array.from({ length: thisYear - earliest + 1 }, (_, i) => thisYear - i);
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
  const pair = useMemo(() => [year - 1, year], [year]);
  // Training reads every sport, and the year before for January's 28-day load.
  const both = useMemo(
    () => (before?.status === "ready" ? [...before.activities, ...all] : (all ?? [])),
    [before, all],
  );
  const until = year === now.year ? now.iso : `${year}-12-31`;
  // The year before, filtered alike and, for this year, cut at today's date: a whole year
  // against ten months would always read as a drop.
  const compare = useMemo(() => {
    if (before?.status !== "ready") return null;
    const sameTypes = filterByType(before.activities, types);
    const current = year === now.year;
    const list = current
      ? sameTypes.filter((a) => dayOfYear(a.startTimeLocal) <= now.day)
      : sameTypes;
    return {
      totals: summarize(list).totals,
      year: year - 1,
      label: current ? `vs ${year - 1} at this date` : `vs ${year - 1}`,
    };
  }, [before, types, year, now]);

  // The year shown is read as the page opens, and again after Refresh forgets it.
  useEffect(() => {
    if (!entry) loadYear(year);
  }, [entry, year, loadYear]);

  // The year before too, for "vs last year at this date": one more read, kept as any year is.
  // why not the whole history: a year is one or two requests, the history one per 100.
  useEffect(() => {
    if (!before && (firstYear === null || year - 1 >= firstYear)) loadYear(year - 1);
  }, [before, year, firstYear, loadYear]);

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
