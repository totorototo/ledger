import { activity } from "../test/fixtures.js";
import { insights, session, volume } from "./insights.js";

// An easy 10 km run on `day`: 90% of its heart-rate time in Z1–Z2.
const easyRun = (id, day, overrides = {}) =>
  activity({
    activityId: id,
    startTimeLocal: `${day} 07:00:00`,
    activityType: { typeKey: "running" },
    distance: 10_000,
    duration: 3600,
    elevationGain: 100,
    averageHR: 140,
    averageSpeed: 2.8,
    activityTrainingLoad: 60,
    hrTimeInZone_1: 600,
    hrTimeInZone_2: 2640,
    hrTimeInZone_3: 360,
    ...overrides,
  });

describe("volume", () => {
  it("sums every sport, then running alone, in km, hours and m", () => {
    const ride = activity({
      activityId: 9,
      activityType: { typeKey: "cycling" },
      distance: 40_000,
      duration: 5400,
      elevationGain: 300,
    });
    expect(volume([easyRun(1, "2026-10-20"), ride])).toEqual({
      count: 2,
      km: 50,
      hours: 2.5,
      climbM: 400,
      runs: 1,
      runKm: 10,
      load: 60,
    });
  });
});

describe("session", () => {
  it("reads a session in a person's units and says whether it was easy", () => {
    expect(session(easyRun(1, "2026-10-20"))).toMatchObject({
      date: "2026-10-20",
      type: "running",
      km: 10,
      hours: 1,
      load: 60,
      easy: true,
    });
  });
});

describe("insights", () => {
  // Five weeks of three easy runs each, Mon, Wed and Sat, ending Sunday Oct 25, 2026.
  const history = [];
  let id = 0;
  for (let week = 0; week < 5; week++)
    for (const offset of [0, 2, 5]) {
      const day = new Date(Date.UTC(2026, 8, 21 + week * 7 + offset)).toISOString().slice(0, 10);
      history.push(easyRun(++id, day));
    }

  it("says so when there is nothing to read", () => {
    expect(insights([], "2026-10-25")).toMatchObject({ empty: true });
  });

  it("compares the last 7 days with the 4 weeks before", () => {
    const { lastWeek } = insights(history, "2026-10-25");
    expect(lastWeek).toMatchObject({ from: "2026-10-19", until: "2026-10-25" });
    expect(lastWeek.volume.runKm).toBe(30);
    expect(lastWeek.previous4WeeksAverage.runKm).toBe(30);
    expect(lastWeek.weeksCovered).toBe(4);
    expect(lastWeek.change.km).toBe("±0%");
    expect(lastWeek.load).toEqual({ acute: 180, chronic: 180, ratio: 1 });
    expect(lastWeek.sessions).toHaveLength(3);
  });

  it("averages over the weeks the history covers, not 4, on a new account", () => {
    // The last two weeks only: one week before `from`, so the average is that week's.
    const { lastWeek } = insights(history.slice(-6), "2026-10-25");
    expect(lastWeek.weeksCovered).toBe(1);
    expect(lastWeek.previous4WeeksAverage.runKm).toBe(30);
    expect(lastWeek.change.km).toBe("±0%");
  });

  it("sums each week with its load and the change from the week before", () => {
    const { weeks } = insights(history, "2026-10-25");
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toMatchObject({
      week: "2026-09-21",
      runKm: 30,
      kmChange: null,
    });
    expect(weeks[4]).toMatchObject({
      week: "2026-10-19",
      runKm: 30,
      kmChange: "±0%",
      ratio: 1,
    });
    expect(weeks[4].partial).toBe(false);
    // On a Wednesday, the week is Monday to Wednesday so far.
    expect(insights(history, "2026-10-21").weeks.at(-1)).toMatchObject({
      week: "2026-10-19",
      partial: true,
    });
  });

  it("gives each month its easy-run efficiency, and each year its sports", () => {
    const { months, years } = insights(history, "2026-10-25");
    expect(months.map((m) => m.month)).toEqual(["2026-09", "2026-10"]);
    // 2.8 m/s × 60 / 140 bpm.
    expect(months[1]).toMatchObject({ easyRuns: 10, efficiency: 1.2 });
    expect(years).toEqual([
      expect.objectContaining({
        year: 2026,
        count: 15,
        sports: [expect.objectContaining({ type: "running", km: 150 })],
      }),
    ]);
  });

  it("leaves out what comes after `until` and reports Garmin's faults", () => {
    const fast = easyRun(99, "2026-10-21", {
      distance: 10_000,
      duration: 1000,
    });
    const later = easyRun(100, "2026-11-02");
    const result = insights([...history, fast, later], "2026-10-25");
    // `activities` and `kept` count the same period: the later run is cut from both.
    expect(result.coverage).toMatchObject({
      activities: 16,
      kept: 15,
      runsWithZones: 15,
    });
    expect(result.faults).toEqual([
      expect.objectContaining({ date: "2026-10-21", fault: "speed" }),
    ]);
  });
});
