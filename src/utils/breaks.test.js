import { activity } from "../test/fixtures.js";
import { breakSummary, longestBreak } from "./breaks.js";
import { addDays } from "./metrics.js";

const run = (day) =>
  activity({ startTimeLocal: `${day} 07:00:00`, activityType: { typeKey: "running" } });
const ride = (day) =>
  activity({ startTimeLocal: `${day} 07:00:00`, activityType: { typeKey: "road_biking" } });
// A run every `step` days over [from, from + days).
const every = (from, days, step = 2) =>
  Array.from({ length: Math.ceil(days / step) }, (_, i) => run(addDays(from, i * step)));

describe("longestBreak", () => {
  it("finds the longest stretch with no run, and its dates", () => {
    // 84 days from 2026-01-01, with no run from 01-11 to 01-30.
    const list = [...every("2026-01-01", 10, 1), ...every("2026-01-31", 54, 1)];
    expect(longestBreak(list, "2026-03-26")).toEqual({
      days: 20,
      from: "2026-01-11",
      to: "2026-01-30",
      runDays: 64,
    });
  });

  it("counts a ride as no run, but as history", () => {
    expect(longestBreak([ride("2026-01-01")], "2026-03-26")).toMatchObject({
      days: 84,
      runDays: 0,
    });
  });

  it("leaves out the day itself, and counts a break reaching it", () => {
    const list = [...every("2026-01-01", 80, 1), run("2026-03-26")];
    expect(longestBreak(list, "2026-03-26")).toMatchObject({ days: 4, to: "2026-03-25" });
  });

  it("is null when the history starts inside the window", () => {
    expect(longestBreak([run("2026-02-01")], "2026-03-26")).toBeNull();
    expect(longestBreak([], "2026-03-26")).toBeNull();
  });
});

describe("breakSummary", () => {
  const list = [
    ...every("2025-01-01", 500, 1).filter(
      (a) =>
        // A 20-day break before the DNF, 5 before the finish.
        !(a.startTimeLocal >= "2025-04-01" && a.startTimeLocal < "2025-04-21") &&
        !(a.startTimeLocal >= "2025-08-01" && a.startTimeLocal < "2025-08-06"),
    ),
  ];
  const races = [
    { date: "2024-01-01", text: "Too Old 160 km 10000 m D+, 40:00:00" },
    { date: "2025-05-01", text: "Dropped 160 km 10000 m D+, technical, DNF" },
    { date: "2025-06-01", text: "Short 40 km 1000 m D+, 6:00:00" },
    { date: "2025-09-01", text: "Finished 160 km 8000 m D+, 40:00:00" },
    { date: "2026-10-01", text: "Later 170 km 10000 m D+, A race" },
    { date: "2026-08-01", text: "Sooner 170 km 10000 m D+, B race" },
  ];
  const summary = breakSummary(list, "2026-05-01", races);

  it("lines long races up, newest first, leaving out short ones", () => {
    expect(summary.races.map((r) => [r.name, r.dnf, r.before.days])).toEqual([
      ["Finished", false, 5],
      ["Dropped", true, 20],
    ]);
  });

  it("counts the DNFs after a break longer than any before a finish", () => {
    expect(summary).toMatchObject({
      finishes: 1,
      dnfs: 1,
      longestBeforeFinish: 5,
      dnfsOverFinishes: 1,
    });
  });

  it("says how many long races are older than the history", () => {
    expect(summary.withoutHistory).toBe(1);
  });

  it("gives the next race's window", () => {
    expect(summary.next).toEqual({
      date: "2026-08-01",
      name: "Sooner",
      windowOpens: "2026-05-09",
    });
  });

  it("has no comparison without a finish", () => {
    const only = breakSummary(list, "2026-05-01", [races[1]]);
    expect(only.longestBeforeFinish).toBeNull();
    expect(only.dnfsOverFinishes).toBeNull();
    expect(only.next).toBeNull();
  });
});
