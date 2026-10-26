import { describe, expect, it } from "vitest";

import { activity } from "../test/fixtures.js";
import { MIN_EASY_RUNS, monthly, training, weeklyLoad } from "./training.js";

const easy = (day, more = {}) =>
  activity({
    activityId: Number(day.replaceAll("-", "")),
    startTimeLocal: `${day} 07:00:00`,
    activityType: { typeKey: "running" },
    distance: 10_000,
    duration: 3000,
    averageSpeed: 10_000 / 3000,
    averageHR: 140,
    activityTrainingLoad: 70,
    hrTimeInZone_1: 1200,
    hrTimeInZone_2: 1500,
    hrTimeInZone_3: 300,
    ...more,
  });

describe("weeklyLoad", () => {
  it("has a point per week from the first activity's to today's, gaps at zero", () => {
    const weeks = weeklyLoad([easy("2026-09-29"), easy("2026-10-01")], "2026-09-29", "2026-10-21");
    expect(weeks.map((w) => w.key)).toEqual([
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
    ]);
    expect(weeks[0]).toMatchObject({ acute: 140, chronic: 35, label: "Week of Sep 28" });
    // The axis names a month at its first week's end: October's, not September's.
    expect(weeks.map((w) => w.tick)).toEqual(["O", "", "", ""]);
    expect(weeks[3].acute).toBe(0);
  });
});

describe("monthly", () => {
  it("takes the median of the easy runs, and leaves a thin month as a gap", () => {
    const sep = ["2026-09-02", "2026-09-09", "2026-09-16"].map((day) => easy(day));
    const hard = easy("2026-10-03", {
      hrTimeInZone_1: 0,
      hrTimeInZone_2: 600,
      hrTimeInZone_4: 2400,
    });
    const months = monthly([...sep, easy("2026-10-01"), hard], "2026-09-01", "2026-10-21");
    expect(months.map((m) => m.key)).toEqual(["2026-09", "2026-10"]);
    // 10 km in 50 min at 140 bpm: 200 m a minute, 1.43 m per heartbeat.
    expect(months[0]).toMatchObject({ easyRuns: 3, efficiency: 1.43, label: "Sep 2026" });
    expect(months[1].easyRuns).toBeLessThan(MIN_EASY_RUNS);
    expect(months[1].efficiency).toBeNull();
    expect(months[1].intensity.hardPct).toBeGreaterThan(0);
  });

  it("has every month of the range, the empty ones too", () => {
    const months = monthly([easy("2026-03-30")], "2026-01-01", "2026-04-10");
    expect(months.map((m) => m.key)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(months.map((m) => m.tick)).toEqual(["J", "F", "M", "A"]);
  });
});

describe("training", () => {
  it("screens the history first and says what the charts rest on", () => {
    const glitch = easy("2026-09-05", { distance: 100_000, movingDuration: 3000 });
    const noHR = easy("2026-09-06", { averageHR: undefined, activityTrainingLoad: undefined });
    const lastYear = easy("2025-12-20");
    const result = training(
      [lastYear, easy("2026-09-04"), glitch, noHR],
      "2026-01-01",
      "2026-09-30",
    );
    expect(result.faults).toHaveLength(1);
    expect(result.coverage).toEqual({ activities: 2, withLoad: 1, runs: 2, runsWithHR: 1 });
    // The year before is out of the counts, but in January's 28-day load.
    expect(result.weeks[0].chronic).toBe(18);
  });
});
