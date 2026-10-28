// @vitest-environment node
import { activity } from "../../src/test/fixtures.js";
import { insights } from "../../src/utils/insights.js";
import { checkNotes, render, reportData } from "./build.js";

// A run on `day`, with a 5 km split; easy (Z2) unless `hard`.
const run = (id, day, { hard = false, ...overrides } = {}) =>
  activity({
    activityId: id,
    activityName: `Run ${id}`,
    startTimeLocal: `${day} 07:00:00`,
    activityType: { typeKey: "running" },
    distance: 10_000,
    duration: 3600,
    averageHR: 140,
    averageSpeed: 2.8,
    activityTrainingLoad: 80,
    hrTimeInZone_2: hard ? 600 : 3000,
    hrTimeInZone_4: hard ? 3000 : 0,
    fastestSplit_5000: 1500,
    ...overrides,
  });

// A run every few days from 2025-09 to 2026-10-28.
const history = Array.from({ length: 140 }, (_, i) => {
  const day = new Date(Date.UTC(2025, 8, 1 + i * 3)).toISOString().slice(0, 10);
  return run(i + 1, day, { hard: i % 4 === 0 });
}).filter((a) => a.startTimeLocal <= "2026-10-28");
const metrics = insights(history, "2026-10-28");

const trust = (level) => ({ level, why: "because" });
const NOTES = {
  "race-predictor": {
    takeaway: "t",
    trust: {
      "5k": trust("high"),
      "10k": trust("fair"),
      half: trust("low"),
      marathon: trust("low"),
    },
    reading: ["r"],
    trend: "t",
    sharpen: "s",
  },
  "trail-predictor": { headline: "h", takeaway: "t", reading: ["r"], sharpen: null },
  "load-check": {
    verdict: "Steady",
    takeaway: "t",
    now: [],
    earlier: [{ flag: "Load spike", text: "x" }],
    action: "a",
  },
  "weekly-review": {
    takeaway: "t",
    standouts: [{ date: "2026-10-26", name: "Run", text: "x" }],
    takeaways: ["k"],
  },
  "aerobic-progress": { headline: "h", takeaway: "t", trend: ["x"] },
};

describe("reportData", () => {
  it("puts the skill's trust beside each predicted time", () => {
    const data = reportData("race-predictor", metrics, NOTES["race-predictor"]);
    expect(data.predictions.map((p) => [p.label, p.trust])).toEqual([
      ["5 km", "high"],
      ["10 km", "fair"],
      ["Half marathon", "low"],
      ["Marathon", "low"],
    ]);
    expect(data.predictions[0].time).toBe(metrics.race.predictions[0].time);
    expect(data.trend).toHaveLength(12);
    expect(data).toMatchObject({ until: "2026-10-28", effort: { label: "5 km" } });
  });

  it("gives the load check the last 8 weeks, summaries without their days", () => {
    const data = reportData("load-check", metrics, NOTES["load-check"]);
    expect(data.weeks).toHaveLength(8);
    expect(data.weeks.at(-1)).toMatchObject({ week: metrics.weeks.at(-1).week, partial: true });
    expect(data.now).toEqual(metrics.lastWeek.load);
  });

  it("gives the weekly review the last 7 days as metrics.json has them", () => {
    const data = reportData("weekly-review", metrics, NOTES["weekly-review"]);
    expect(data.from).toBe(metrics.lastWeek.from);
    expect(data.sessions).toEqual(metrics.lastWeek.sessions);
  });

  it("lines each of the last 12 months up with the same month a year earlier", () => {
    const data = reportData("aerobic-progress", metrics, NOTES["aerobic-progress"]);
    expect(data.months).toHaveLength(12);
    expect(data.months.map((m) => m.month)).toEqual(
      data.lastYear.map((m) => `${Number(m.month.slice(0, 4)) + 1}${m.month.slice(4)}`),
    );
    // Months before the history are gaps, not dropped.
    expect(data.lastYear[0]).toMatchObject({ month: "2024-11", efficiency: null });
    expect(data.latest.month).toBe(data.months.findLast((m) => m.efficiency != null).month);
    expect(data.sameMonthLastYear.month).toBe(`2025${data.latest.month.slice(4)}`);
  });

  it("refuses another metrics version, and an empty history", () => {
    expect(() =>
      reportData("weekly-review", { ...metrics, version: 0 }, NOTES["weekly-review"]),
    ).toThrow(/npm run export/);
    expect(() =>
      reportData("weekly-review", { version: metrics.version, empty: true }, {}),
    ).toThrow(/no activities/);
  });
});

describe("reportData, trail", () => {
  it("passes the curve, the events and the races ahead as metrics.json has them", () => {
    // 3 ultra-length days of different lengths make a curve.
    const ultras = [
      [901, "2026-05-01", 100, 2000, 18],
      [902, "2025-06-01", 160, 6000, 36],
      [903, "2024-06-01", 250, 9000, 70],
    ].map(([id, day, km, climb, hours]) =>
      activity({
        activityId: id,
        startTimeLocal: `${day} 05:00:00`,
        activityType: { typeKey: "trail_running" },
        distance: km * 1000,
        duration: hours * 3600,
        elevationGain: climb,
      }),
    );
    const withTrail = insights([...history, ...ultras], "2026-10-28");
    const data = reportData("trail-predictor", withTrail, NOTES["trail-predictor"]);
    expect(data.fit).toEqual(withTrail.trail.fit);
    expect(data.events).toHaveLength(3);
    expect(data.grid).toEqual(withTrail.trail.grid);
    expect(data.curve).toEqual(withTrail.trail.curve);
  });

  it("refuses a history with no event to scale from", () => {
    expect(() => reportData("trail-predictor", metrics, NOTES["trail-predictor"])).toThrow(
      /nothing to scale from/,
    );
  });
});

describe("checkNotes", () => {
  it("names every missing or malformed note", () => {
    expect(() => checkNotes("load-check", { verdict: "Fine", takeaway: "t", now: [] })).toThrow(
      "load-check notes: missing or malformed verdict, earlier, action",
    );
  });

  it("wants a trust level and a reason for every distance", () => {
    const three = { ...NOTES["race-predictor"].trust, marathon: undefined };
    expect(() =>
      checkNotes("race-predictor", { ...NOTES["race-predictor"], trust: three }),
    ).toThrow(/trust/);
  });
});

describe("render", () => {
  it("fills the slots and escapes the data so it can't close its script", () => {
    const page = render(
      '<!-- BASE_STYLE --><script id="report" type="application/json">"__REPORT__"</script><!-- BASE_SCRIPT -->',
      { style: "a{}", script: "go()" },
      { name: "</script><b>$&" },
    );
    expect(page).toBe(
      '<style>\na{}</style><script id="report" type="application/json">{"name":"\\u003c/script>\\u003cb>$&"}</script><script>\ngo()</script>',
    );
  });
});
