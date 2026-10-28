import { activity } from "../test/fixtures.js";
import { effects, hrvSummary, insights, session, volume } from "./insights.js";

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

describe("hrvSummary", () => {
  const night = (date, lastNightAvg) => ({
    date,
    lastNightAvg,
    balancedLow: 32,
    balancedUpper: 46,
  });

  it("counts the nights under and over the balanced band", () => {
    expect(
      hrvSummary([night("2026-10-20", 30), night("2026-10-21", 40), night("2026-10-22", 50)]),
    ).toEqual({ nights: 3, average: 40, belowBand: 1, aboveBand: 1 });
  });

  it("is null with no night: no reading isn't a low one", () => {
    expect(hrvSummary([])).toBeNull();
  });
});

describe("effects", () => {
  it("counts sessions by Garmin's label, leaving the unlabelled out", () => {
    const labelled = (id, label) => activity({ activityId: id, trainingEffectLabel: label });
    expect(
      effects([labelled(1, "TEMPO"), labelled(2, "TEMPO"), labelled(3), labelled(4, "RECOVERY")]),
    ).toEqual({
      TEMPO: 2,
      RECOVERY: 1,
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

  it("adds each week's and the last 7 days' HRV, when given", () => {
    const nights = ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-25"].map((date, i) => ({
      date,
      lastNightAvg: [40, 30, 31, 44][i],
      weeklyAvg: 38,
      status: "BALANCED",
      balancedLow: 32,
      balancedUpper: 46,
    }));
    const result = insights(history, "2026-10-25", { hrv: nights });
    expect(result.weeks.at(-1).hrv).toEqual({
      nights: 3,
      average: 35,
      belowBand: 2,
      aboveBand: 0,
    });
    expect(result.weeks.at(-2).hrv).toEqual({
      nights: 1,
      average: 40,
      belowBand: 0,
      aboveBand: 0,
    });
    expect(result.weeks[0].hrv).toBeNull();
    expect(result.lastWeek.hrv).toMatchObject({ nights: 3, belowBand: 2 });
    expect(result.lastWeek.hrv.days.map((d) => d.date)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-25",
    ]);
    expect(result.months[1].hrv).toMatchObject({ nights: 4 });
    expect(result.coverage).toMatchObject({
      hrvNights: 4,
      hrvFirst: "2026-10-18",
    });
    // Without HRV, its fields are null rather than zero.
    expect(insights(history, "2026-10-25").lastWeek.hrv).toBeNull();
  });

  it("gives each month its runs' cadence and power, and each session its training effect", () => {
    const withPower = history.map((a, i) => ({
      ...a,
      averageRunningCadenceInStepsPerMinute: 170 + (i % 3),
      avgPower: i < 6 ? undefined : 250,
      trainingEffectLabel: "AEROBIC_BASE",
      aerobicTrainingEffect: 2.84,
    }));
    const { months, lastWeek, coverage } = insights(withPower, "2026-10-25");
    expect(months[1]).toMatchObject({
      cadence: 171,
      power: 250,
      runsWithPower: 9,
    });
    expect(lastWeek.effects).toEqual({ AEROBIC_BASE: 3 });
    expect(lastWeek.sessions[0]).toMatchObject({
      effect: "AEROBIC_BASE",
      aerobicTE: 2.8,
    });
    expect(coverage).toMatchObject({ runsWithPower: 9, withEffect: 15 });
  });
});
