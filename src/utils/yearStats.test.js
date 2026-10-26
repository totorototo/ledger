import { describe, expect, it } from "vitest";

import { activity } from "../test/fixtures.js";
import {
  byYear,
  chartSeries,
  countByType,
  dayLabel,
  dayOfYear,
  filterByType,
  monthOf,
  niceMax,
  OTHER,
  runningTotal,
  stackTotals,
  summarize,
  today,
  totalAt,
  yearOf,
} from "./yearStats.js";

describe("summarize", () => {
  const year = [
    activity({ activityId: 1, startTimeLocal: "2025-01-05 07:00:00" }),
    activity({ activityId: 2, startTimeLocal: "2025-01-31 23:30:00", distance: 5000 }),
    activity({
      activityId: 3,
      startTimeLocal: "2025-03-01 00:10:00",
      activityType: { typeKey: "strength_training" },
      distance: undefined,
      elevationGain: null,
      duration: 3600,
    }),
  ];

  it("adds up the year, skipping numbers an activity doesn't have", () => {
    expect(summarize(year).totals).toEqual({
      count: 3,
      distance: 21_100 + 5000,
      duration: 9000 + 9000 + 3600,
      elevationGain: 2500,
    });
  });

  it("files each activity under its watch-local month", () => {
    const { months } = summarize(year);
    expect(months).toHaveLength(12);
    expect(months[0]).toMatchObject({ count: 2, distance: 26_100 });
    expect(months[1].count).toBe(0);
    expect(months[2]).toMatchObject({ count: 1, distance: 0, duration: 3600 });
  });

  it("ranks sports by time", () => {
    const { sports } = summarize(year);
    expect(sports.map((s) => s.typeKey)).toEqual(["trail_running", "strength_training"]);
    expect(sports[0].count).toBe(2);
  });

  it("sums an empty year to zeros", () => {
    const summary = summarize([]);
    expect(summary.totals.count).toBe(0);
    expect(summary.sports).toEqual([]);
  });
});

describe("monthOf and yearOf", () => {
  it("read the string, not through Date", () => {
    expect(monthOf("2025-12-31 23:59:59")).toBe(11);
    expect(monthOf(undefined)).toBeNull();
    expect(yearOf("2025-12-31 23:59:59")).toBe(2025);
    expect(yearOf("")).toBeNull();
  });
});

describe("byYear", () => {
  it("runs from the first year to the last, keeping empty years", () => {
    const years = byYear(
      [
        activity({ activityId: 1, startTimeLocal: "2024-06-01 08:00:00" }),
        activity({ activityId: 2, startTimeLocal: "2021-01-01 00:05:00", distance: 5000 }),
        activity({ activityId: 3, startTimeLocal: "2024-12-31 23:55:00" }),
      ],
      2026,
    );
    expect(years.map((y) => y.year)).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
    expect(years[0].totals).toMatchObject({ count: 1, distance: 5000 });
    expect(years[1].totals.count).toBe(0);
    expect(years[3].activities.map((a) => a.activityId)).toEqual([1, 3]);
  });

  it("has nothing to show without activities", () => {
    expect(byYear([], 2026)).toEqual([]);
  });
});

describe("niceMax", () => {
  it("rounds an axis top up to the next fine step × 10ⁿ", () => {
    expect(niceMax(0)).toBe(0);
    expect(niceMax(87)).toBe(100);
    expect(niceMax(130)).toBe(150);
    expect(niceMax(200)).toBe(200);
    expect(niceMax(1260)).toBe(1500);
    expect(niceMax(4100)).toBe(5000);
    expect(niceMax(0.3)).toBe(0.3);
  });
});

describe("filterByType", () => {
  const list = [
    activity({ activityId: 1 }),
    activity({ activityId: 2, activityType: { typeKey: "cycling" }, duration: 20_000 }),
    activity({ activityId: 3, activityType: undefined, duration: 60 }),
  ];

  it("keeps every activity when no type is picked", () => {
    expect(filterByType(list, [])).toBe(list);
  });

  it("keeps the picked types, untyped ones under null", () => {
    expect(filterByType(list, ["cycling"]).map((a) => a.activityId)).toEqual([2]);
    expect(filterByType(list, ["trail_running", null]).map((a) => a.activityId)).toEqual([1, 3]);
  });

  it("counts each type, untyped ones under null", () => {
    expect([...countByType(list)]).toEqual([
      ["trail_running", 1],
      ["cycling", 1],
      [null, 1],
    ]);
  });

  it("gives the types with most time a colour each, and folds the rest", () => {
    expect(chartSeries(list)).toEqual([
      { key: "cycling", typeKeys: ["cycling"], slot: 1 },
      { key: "trail_running", typeKeys: ["trail_running"], slot: 2 },
      { key: "none", typeKeys: [null], slot: 3 },
    ]);
    expect(chartSeries(list, ["hiking"])).toContainEqual({
      key: "hiking",
      typeKeys: ["hiking"],
      slot: 4,
    });
    expect(chartSeries(list, [], 1)).toEqual([
      { key: "cycling", typeKeys: ["cycling"], slot: 1 },
      { key: OTHER, typeKeys: ["trail_running", null], slot: null },
    ]);
  });

  it("splits each period's totals by series", () => {
    const series = chartSeries(list, [], 1);
    const [only] = stackTotals(list, series, yearOf, [2026]);
    expect(only.get("cycling")).toMatchObject({ count: 1, duration: 20_000 });
    expect(only.get(OTHER)).toMatchObject({ count: 2, duration: 9060 });
    expect(stackTotals(list, series, yearOf, [2025])[0].get(OTHER).count).toBe(0);
  });
});

describe("dayOfYear", () => {
  it("counts from Jan 1 as 0, with Feb 29 in a leap year", () => {
    expect(dayOfYear("2025-01-01 00:10:00")).toBe(0);
    expect(dayOfYear("2025-03-01 07:00:00")).toBe(59);
    expect(dayOfYear("2024-03-01 07:00:00")).toBe(60);
    expect(dayOfYear("2024-12-31 23:59:00")).toBe(365);
    expect(dayOfYear(undefined)).toBe(null);
  });

  it("names a day back", () => {
    expect(dayLabel(2025, 59)).toBe("Mar 1");
    expect(dayLabel(2024, 59)).toBe("Feb 29");
    expect(dayLabel(2024, 365)).toBe("Dec 31");
  });

  it("reads today off the browser's clock", () => {
    expect(today(new Date(2026, 9, 25, 23, 30))).toEqual({
      year: 2026,
      day: 297,
      iso: "2026-10-25",
    });
  });
});

describe("runningTotal", () => {
  const list = [
    activity({ activityId: 1, startTimeLocal: "2025-01-02 07:00:00", distance: 5000 }),
    activity({ activityId: 2, startTimeLocal: "2025-01-02 18:00:00", distance: 3000 }),
    activity({ activityId: 3, startTimeLocal: "2025-03-01 07:00:00", distance: 10000 }),
    activity({ activityId: 4, startTimeLocal: "2024-06-01 07:00:00", distance: 42195 }),
    activity({ activityId: 5, startTimeLocal: "2025-04-01 07:00:00", distance: undefined }),
  ];

  it("sums one year's activities day by day, up to its total", () => {
    const running = runningTotal(list, 2025, "distance");
    expect(running).toHaveLength(365);
    expect(running[0]).toBe(0);
    expect(running[1]).toBe(8000);
    expect(running[58]).toBe(8000);
    expect(running[59]).toBe(18000);
    expect(running.at(-1)).toBe(18000);
  });

  it("reads a leap year's last day against a plain year", () => {
    const running = runningTotal(list, 2025, "distance");
    expect(totalAt(running, 365)).toBe(18000);
    expect(runningTotal(list, 2024, "distance")).toHaveLength(366);
  });
});
