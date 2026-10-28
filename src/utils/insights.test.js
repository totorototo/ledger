import { activity } from "../test/fixtures.js";
import {
  effects,
  hrvSummary,
  insights,
  restingSummary,
  session,
  sleepSummary,
  volume,
} from "./insights.js";
import { parsePlan } from "./plan.js";

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

// `count` days of resting heart rate from `from`, each `value(i)`.
const restingDays = (from, count, value) =>
  Array.from({ length: count }, (_, i) => ({
    date: new Date(Date.parse(from) + i * 864e5).toISOString().slice(0, 10),
    resting: value(i),
  }));

describe("restingSummary", () => {
  it("counts the days 5 bpm or more over the median of the 28 days before", () => {
    const all = [
      ...restingDays("2026-09-21", 28, (i) => (i % 2 ? 50 : 52)),
      ...restingDays("2026-10-19", 7, (i) => [51, 56, 57, 60, 52, 50, 51][i]),
    ];
    expect(restingSummary(all, "2026-10-19", "2026-10-25")).toEqual({
      days: 7,
      average: 54,
      baseline: 51,
      raised: 3,
    });
  });

  it("has no baseline under 14 days before, and is null with no day", () => {
    const all = restingDays("2026-10-12", 14, () => 50);
    expect(restingSummary(all, "2026-10-19", "2026-10-25")).toMatchObject({
      days: 7,
      baseline: null,
      raised: null,
    });
    expect(restingSummary(all, "2026-11-01", "2026-11-07")).toBeNull();
  });
});

describe("sleepSummary", () => {
  it("averages length and score, and counts the nights under 7 h", () => {
    const nights = [
      { date: "2026-10-19", hours: 6.5, score: 60 },
      { date: "2026-10-20", hours: 8, score: 85 },
      { date: "2026-10-21", hours: 6.9, score: null },
    ];
    expect(sleepSummary(nights)).toEqual({
      nights: 3,
      averageHours: 7.1,
      averageScore: 73,
      under7h: 2,
    });
    expect(sleepSummary([])).toBeNull();
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
    expect(weeks[0]).toMatchObject({ week: "2026-09-21", runKm: 30, kmChange: null });
    expect(weeks[4]).toMatchObject({ week: "2026-10-19", runKm: 30, kmChange: "±0%", ratio: 1 });
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
    const fast = easyRun(99, "2026-10-21", { distance: 10_000, duration: 1000 });
    const later = easyRun(100, "2026-11-02");
    const result = insights([...history, fast, later], "2026-10-25");
    // `activities` and `kept` count the same period: the later run is cut from both.
    expect(result.coverage).toMatchObject({ activities: 16, kept: 15, runsWithZones: 15 });
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
    expect(result.weeks.at(-1).hrv).toEqual({ nights: 3, average: 35, belowBand: 2, aboveBand: 0 });
    expect(result.weeks.at(-2).hrv).toEqual({ nights: 1, average: 40, belowBand: 0, aboveBand: 0 });
    expect(result.weeks[0].hrv).toBeNull();
    expect(result.lastWeek.hrv).toMatchObject({ nights: 3, belowBand: 2 });
    expect(result.lastWeek.hrv.days.map((d) => d.date)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-25",
    ]);
    expect(result.months[1].hrv).toMatchObject({ nights: 4 });
    expect(result.coverage).toMatchObject({ hrvNights: 4, hrvFirst: "2026-10-18" });
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
    expect(months[1]).toMatchObject({ cadence: 171, power: 250, runsWithPower: 9 });
    expect(lastWeek.effects).toEqual({ AEROBIC_BASE: 3 });
    expect(lastWeek.sessions[0]).toMatchObject({ effect: "AEROBIC_BASE", aerobicTE: 2.8 });
    expect(coverage).toMatchObject({ runsWithPower: 9, withEffect: 15 });
  });

  it("adds resting heart rate, sleep, the zones and the plan's notes, when given", () => {
    const restingHr = restingDays("2026-09-21", 35, (i) => (i >= 32 ? 60 : 50));
    const sleep = [{ date: "2026-10-24", hours: 6, score: 55 }];
    const zones = { sport: "RUNNING", floors: [94, 113, 152, 162, 169] };
    const plan = parsePlan(`## Races
- 2026-12-05 Saintélyon
- 2026-10-01 past race
## Planned
- 2026-10-19..2026-10-21 recovery days
- not dated
`);
    const result = insights(history, "2026-10-25", { restingHr, sleep, zones, plan });
    expect(result.weeks.at(-1)).toMatchObject({
      restingHr: { days: 7, baseline: 50, raised: 3 },
      sleep: { nights: 1, under7h: 1 },
      notes: ["planned: recovery days"],
    });
    expect(result.weeks.at(-2).notes).toEqual([]);
    expect(result.lastWeek.restingHr.days).toHaveLength(7);
    expect(result.lastWeek.sleep.days).toEqual(sleep);
    expect(result.lastWeek.notes).toEqual(["planned: recovery days"]);
    expect(result.months[1].restingHr).toMatchObject({ days: 25 });
    expect(result.zones).toBe(zones);
    expect(result.plan).toEqual({
      nextRace: { date: "2026-12-05", text: "Saintélyon", daysTo: 41 },
      races: [{ date: "2026-12-05", text: "Saintélyon", daysTo: 41 }],
      ignored: ["- not dated"],
    });
    expect(result.coverage).toMatchObject({
      restingHrDays: 35,
      restingHrFirst: "2026-09-21",
      sleepNights: 1,
      sleepFirst: "2026-10-24",
    });
    // Without them, null rather than zero.
    const bare = insights(history, "2026-10-25");
    expect(bare.lastWeek).toMatchObject({ restingHr: null, sleep: null, notes: [] });
    expect(bare.plan).toBeNull();
  });
});
