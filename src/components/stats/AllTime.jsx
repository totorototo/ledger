import { useEffect, useMemo } from "react";

import useStore from "../../store/store.js";
import {
  byYear,
  chartSeries,
  countByType,
  filterByType,
  stackTotals,
  summarize,
  today,
  yearOf,
} from "../../utils/yearStats.js";
import LoadingSpinner from "../loadingSpinner/LoadingSpinner.jsx";
import {
  ColumnChart,
  countActivities,
  MeasureSwitch,
  PeriodTable,
  SeriesLegend,
  Sports,
  Totals,
} from "./parts.jsx";
import RunningTotal from "./RunningTotal.jsx";
import style from "./Stats.style.js";

// Every year since the first activity: the totals, a column per year, then the years as rows
// that open the Year page, then the sports.
function AllTime({ className }) {
  const history = useStore((state) => state.history);
  const loadHistory = useStore((state) => state.loadHistory);
  const showYear = useStore((state) => state.showYear);
  const setView = useStore((state) => state.setView);
  const ready = history?.status === "ready";
  const types = useStore((state) => state.types);
  const toggleTypes = useStore((state) => state.toggleTypes);
  const clearTypes = useStore((state) => state.clearTypes);
  const measure = useStore((state) => state.measure);
  const setMeasure = useStore((state) => state.setMeasure);
  const all = ready ? history.activities : null;
  const series = useMemo(() => chartSeries(all ?? [], types), [all, types]);
  const counts = useMemo(() => countByType(all ?? []), [all]);
  const activities = useMemo(() => filterByType(all ?? [], types), [all, types]);
  const summary = useMemo(() => summarize(activities), [activities]);
  const years = useMemo(() => {
    const list = byYear(activities, new Date().getFullYear());
    const parts = stackTotals(
      activities,
      series,
      yearOf,
      list.map(({ year }) => year),
    );
    return list.map(({ year, totals }, i) => ({
      key: year,
      label: String(year),
      short: `'${String(year).slice(2)}`,
      totals,
      parts: parts[i],
    }));
  }, [activities, series]);

  const yearKeys = useMemo(() => years.map(({ key }) => key), [years]);
  const now = useMemo(() => today(), []);

  // Read as the page opens, and again after Refresh forgets it.
  useEffect(() => {
    if (!history) loadHistory();
  }, [history, loadHistory]);

  const openYear = (year) => {
    showYear(year);
    setView("year");
  };

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
    <section className={className} aria-labelledby="all-title">
      <span className="eyebrow">Since the beginning</span>
      <div className="heading">
        <h2 id="all-title" className="title">
          {years.length > 1 ? `${years[0].label}–${years.at(-1).label}` : "All time"}
        </h2>
      </div>
      {ready && (summary.totals.count > 0 || types.length > 0) && (
        <div className="controls">
          {legend}
          {summary.totals.count > 0 && <MeasureSwitch value={measure} onChange={setMeasure} />}
        </div>
      )}
      {(!history || history.status === "loading") && (
        <LoadingSpinner
          label={`Reading your history… ${countActivities(history?.count ?? 0)} so far`}
        />
      )}
      {history?.status === "error" && (
        <div className="year-error" role="alert">
          <p>{history.error}</p>
          <button type="button" onClick={loadHistory}>
            Try again
          </button>
        </div>
      )}
      {ready &&
        (summary.totals.count === 0 ? (
          <p className="empty">
            {types.length === 0
              ? "No activities on this account yet."
              : "None of these types on this account."}
          </p>
        ) : (
          <>
            <Totals totals={summary.totals} />
            <ColumnChart
              periods={years}
              series={series}
              measureKey={measure}
              noun="year"
              table={false}
            />
            <RunningTotal
              activities={activities}
              years={yearKeys}
              focus={years.at(-1).key}
              today={now}
              measureKey={measure}
            />
            <div className="tables">
              <section aria-labelledby="years-title">
                <h3 id="years-title" className="section-title">
                  By year
                </h3>
                <PeriodTable periods={[...years].reverse()} noun="year" onPick={openYear} />
              </section>
              <Sports sports={summary.sports} />
            </div>
          </>
        ))}
    </section>
  );
}

export default style(AllTime);
