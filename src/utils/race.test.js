import { activity } from "../test/fixtures.js";
import { bestVdot, clock, efforts, racePrediction, timeFor, vdot } from "./race.js";

// A run on `day` with Garmin's fastest splits inside it.
const run = (id, day, splits = {}, overrides = {}) =>
  activity({
    activityId: id,
    activityName: `Run ${id}`,
    startTimeLocal: `${day} 07:00:00`,
    activityType: { typeKey: "running" },
    distance: 12_000,
    duration: 3600,
    averageHR: 150,
    hrTimeInZone_4: 3000,
    hrTimeInZone_2: 600,
    ...splits,
    ...overrides,
  });

describe("vdot and timeFor", () => {
  // Daniels' Running Formula, VDOT 50: 19:57, 41:21, 1:31:35, 3:10:49. The printed table is
  // rounded, so the formula lands within seconds of it, not on it.
  it("match Daniels' table at VDOT 50 within 10 s", () => {
    expect(Math.abs(timeFor(50, 5000) - 1197)).toBeLessThanOrEqual(10);
    expect(Math.abs(timeFor(50, 10_000) - 2481)).toBeLessThanOrEqual(10);
    expect(Math.abs(timeFor(50, 21_097.5) - 5495)).toBeLessThanOrEqual(10);
    expect(Math.abs(timeFor(50, 42_195) - 11_449)).toBeLessThanOrEqual(10);
  });

  it("scores a 19:57 5 km at 50", () => {
    expect(vdot(5000, 19 * 60 + 57)).toBeCloseTo(50, 0);
  });

  it("is null without a distance or a time", () => {
    expect(vdot(5000, 0)).toBeNull();
    expect(vdot(0, 1200)).toBeNull();
  });
});

describe("clock", () => {
  it("writes minutes under an hour, hours past it", () => {
    expect(clock(1642)).toBe("27:22");
    expect(clock(12_754)).toBe("3:32:34");
    expect(clock(3605)).toBe("1:00:05");
  });
});

describe("efforts", () => {
  it("scores each split of each run, best first, and leaves other sports out", () => {
    const ride = activity({
      activityId: 9,
      startTimeLocal: "2026-10-20 07:00:00",
      activityType: { typeKey: "cycling" },
      fastestSplit_5000: 400,
    });
    const list = efforts([
      run(1, "2026-10-20", { fastestSplit_5000: 1500, fastestSplit_10000: 3200 }),
      ride,
    ]);
    expect(list.map((e) => e.distance)).toEqual(["5k", "10k"]);
    expect(list[0]).toMatchObject({
      date: "2026-10-20",
      name: "Run 1",
      time: "25:00",
      pace: "5:00/km",
      runKm: 12,
      easy: false,
    });
    expect(list[0].vdot).toBeGreaterThan(list[1].vdot);
  });
});

describe("racePrediction", () => {
  it("predicts every distance from the best effort of the last 12 weeks", () => {
    const result = racePrediction(
      [
        run(1, "2026-10-20", { fastestSplit_5000: 19 * 60 + 57 }),
        run(2, "2026-10-01", { fastestSplit_5000: 1500, fastestSplit_10000: 3100 }),
        // Faster, but 13 weeks back: out of the window.
        run(3, "2026-07-28", { fastestSplit_5000: 1000 }),
      ],
      "2026-10-28",
    );
    expect(result.from).toBe("2026-08-06");
    expect(result.effort).toMatchObject({ date: "2026-10-20", distance: "5k", vdot: 50 });
    // The effort's own distance gives back its own time.
    expect(result.predictions[0]).toMatchObject({ distance: "5k", time: "19:57", pace: "3:59/km" });
    expect(result.predictions.map((p) => p.distance)).toEqual(["5k", "10k", "half", "marathon"]);
    expect(result.bestByDistance.map((e) => [e.distance, e.date])).toEqual([
      ["5k", "2026-10-20"],
      ["10k", "2026-10-01"],
    ]);
    expect(result).toMatchObject({ runs: 2, runsWithSplits: 2, longestRunKm: 12, weeklyRunKm: 2 });
  });

  it("reads the long runs a half or a marathon rests on", () => {
    const result = racePrediction(
      [
        run(1, "2026-10-20", {}, { distance: 30_000 }),
        run(2, "2026-10-10", {}, { distance: 26_000 }),
        run(3, "2026-10-01", {}, { distance: 16_000 }),
      ],
      "2026-10-28",
    );
    expect(result).toMatchObject({ longestRunKm: 30, runsOver25Km: 2, weeklyRunKm: 6 });
  });

  it("predicts nothing when no run in the window has a split", () => {
    const result = racePrediction([run(1, "2026-10-20")], "2026-10-28");
    expect(result).toMatchObject({ effort: null, predictions: [], top: [], runsWithSplits: 0 });
  });
});

describe("bestVdot", () => {
  it("is the month's best score, null without a split", () => {
    expect(bestVdot([run(1, "2026-10-20", { fastestSplit_5000: 19 * 60 + 57 })])).toBe(50);
    expect(bestVdot([run(1, "2026-10-20")])).toBeNull();
  });
});
