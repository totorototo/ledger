// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  addDays,
  efficiency,
  intensity,
  isEasy,
  loadSeries,
  screen,
  weekStart,
} from "./metrics.js";

// Synthetic, in the activity list's shape.
const run = (day, extra = {}) => ({
  activityId: Number(day.replaceAll("-", "")),
  activityName: "Run",
  activityType: { typeKey: "trail_running" },
  startTimeLocal: `${day} 07:00:00`,
  distance: 10_000,
  duration: 3600,
  elevationGain: 300,
  averageHR: 140,
  maxHR: 160,
  averageSpeed: 2.5,
  activityTrainingLoad: 100,
  hrTimeInZone_1: 600,
  hrTimeInZone_2: 2400,
  hrTimeInZone_3: 600,
  hrTimeInZone_4: 0,
  hrTimeInZone_5: 0,
  ...extra,
});

describe("dates", () => {
  it("adds days across a month and a DST change without a zone", () => {
    expect(addDays("2026-10-24", 8)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("starts the week on Monday", () => {
    expect(weekStart("2026-10-24")).toBe("2026-10-19"); // a Saturday
    expect(weekStart("2026-10-19")).toBe("2026-10-19");
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // Sunday ends it
  });
});

describe("loadSeries", () => {
  it("compares the last 7 days with the 28-day weekly average", () => {
    // 100 a week for three weeks, then 400 in the last one: acute 400, chronic 175.
    const list = [run("2026-10-01"), run("2026-10-08"), run("2026-10-15")];
    for (const day of ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]) list.push(run(day));
    expect(loadSeries(list, ["2026-10-24"])).toEqual([{ acute: 400, chronic: 175, ratio: 2.29 }]);
  });

  it("has no ratio without history", () => {
    expect(loadSeries([], ["2026-10-24"])[0].ratio).toBeNull();
  });
});

describe("intensity", () => {
  it("splits heart-rate time into easy, moderate and hard", () => {
    const hard = run("2026-10-20", {
      hrTimeInZone_2: 0,
      hrTimeInZone_4: 1800,
      hrTimeInZone_5: 600,
    });
    expect(intensity([run("2026-10-21"), hard])).toEqual({
      hours: 2,
      easyPct: 50,
      moderatePct: 17,
      hardPct: 33,
    });
  });

  it("has no shares without heart rate", () => {
    expect(intensity([{ startTimeLocal: "2026-10-20 07:00:00" }]).easyPct).toBeNull();
  });
});

describe("efficiency", () => {
  it("takes the median metres per minute per heartbeat", () => {
    // 2.5 m/s = 150 m/min at 140 bpm, 3 m/s = 180 m/min at 150 bpm: 1.07 and 1.2.
    const list = [run("2026-10-20"), run("2026-10-21", { averageHR: 150, averageSpeed: 3 })];
    expect(efficiency(list)).toBe(1.14);
  });

  it("prefers the grade-adjusted speed", () => {
    expect(efficiency([run("2026-10-20", { avgGradeAdjustedSpeed: 2.8 })])).toBe(1.2);
  });

  it("has none without heart rate or speed", () => {
    expect(efficiency([run("2026-10-20", { averageHR: null })])).toBeNull();
    expect(efficiency([])).toBeNull();
  });
});

describe("screen", () => {
  it("drops a run faster than any human on its moving time", () => {
    const ride = run("2023-11-23", { distance: 16_500, duration: 5400, movingDuration: 1714 });
    const { activities, faults } = screen([run("2026-01-01"), ride]);
    expect(activities).toHaveLength(1);
    expect(faults).toEqual([
      { date: "2023-11-23", km: 16.5, hours: 1.5, fault: "speed", dropped: "run" },
    ]);
  });

  it("keeps a long run with an impossible climb, without its elevation", () => {
    const long = run("2021-08-19", {
      distance: 208_900,
      duration: 258_000,
      averageSpeed: 0.8,
      elevationGain: 54_816,
    });
    const { activities, faults } = screen([long, run("2026-01-01", { elevationGain: 2000 })]);
    expect(activities.map((a) => a.elevationGain)).toEqual([null, 2000]);
    expect(faults[0]).toMatchObject({ fault: "elevation", dropped: "elevation" });
  });
});

describe("isEasy and loadSeries", () => {
  const zones = (z1, z2, z3, z4) => ({
    hrTimeInZone_1: z1,
    hrTimeInZone_2: z2,
    hrTimeInZone_3: z3,
    hrTimeInZone_4: z4,
  });

  it("calls a session easy at four fifths of its time in Z1–Z2", () => {
    expect(isEasy(zones(400, 400, 200, 0))).toBe(true);
    expect(isEasy(zones(400, 300, 200, 100))).toBe(false);
    expect(isEasy({})).toBe(false);
  });

  it("reads the load at several days", () => {
    const list = [
      { startTimeLocal: "2026-10-01 07:00:00", activityTrainingLoad: 100 },
      { startTimeLocal: "2026-10-10 07:00:00", activityTrainingLoad: 60 },
    ];
    const [first, second] = loadSeries(list, ["2026-10-01", "2026-10-10"]);
    expect(first).toEqual({ acute: 100, chronic: 25, ratio: 4 });
    expect(second).toMatchObject({ acute: 60, chronic: 40 });
  });
});
