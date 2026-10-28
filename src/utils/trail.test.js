import { activity } from "../test/fixtures.js";
import { course, effortKm, fitCurve, fitStops, fitTerminus, hm, trailPrediction } from "./trail.js";

// A trail run on `day`: `km`, `climb` m and `hours` of elapsed time.
const trail = (id, day, km, climb, hours, overrides = {}) =>
  activity({
    activityId: id,
    activityName: `Trail ${id}`,
    startTimeLocal: `${day} 06:00:00`,
    activityType: { typeKey: "trail_running" },
    distance: km * 1000,
    duration: hours * 3600,
    elevationGain: climb,
    ...overrides,
  });

// Hours on the curve time = 0.05 × effortKm^1.3, for `e` effort-km.
const onCurve = (e) => 0.05 * e ** 1.3;

describe("effortKm and hm", () => {
  it("adds a kilometre per 100 m of climb", () => {
    expect(effortKm(80, 2000)).toBe(100);
  });

  it("writes hours as Xh mm", () => {
    expect(hm(38.67)).toBe("38h40");
    expect(hm(3.2)).toBe("3h12");
  });
});

describe("course", () => {
  it("reads the distance and the climb from a race line", () => {
    expect(course("Saintélyon 81 km 2100 m D+, A race")).toEqual({ km: 81, climbM: 2100 });
    expect(course("GRP 120,5 km D+ 7 000, B race")).toEqual({ km: 120.5, climbM: 7000 });
    expect(course("Trail des Cerfs 30 km 1500 m+")).toEqual({ km: 30, climbM: 1500 });
  });

  it("leaves out what the line doesn't say", () => {
    expect(course("Marathon de Paris, A race")).toEqual({ km: null, climbM: null });
  });
});

describe("fitCurve", () => {
  it("finds the exponent of events on a power curve", () => {
    const fit = fitCurve([40, 100, 250].map((e) => ({ effortKm: e, hours: onCurve(e) })));
    expect(fit.b).toBeCloseTo(1.3, 5);
    expect(fit.spread).toBeCloseTo(0, 5);
  });

  it("is null under 3 events, or when they don't span twice the effort", () => {
    expect(
      fitCurve([
        { effortKm: 50, hours: 6 },
        { effortKm: 200, hours: 30 },
      ]),
    ).toBeNull();
    expect(fitCurve([60, 80, 100].map((e) => ({ effortKm: e, hours: onCurve(e) })))).toBeNull();
  });
});

describe("fitStops", () => {
  it("finds r in stops = r × moving²", () => {
    const points = [3, 10, 30].map((m) => ({ movingHours: m, hours: m + 0.005 * m * m }));
    expect(fitStops(points)).toBeCloseTo(0.005, 6);
  });

  it("is 0 without stops", () => {
    expect(fitStops([{ movingHours: 5, hours: 5 }])).toBe(0);
  });
});

describe("fitTerminus", () => {
  it("finds Terminus's base pace and fatigue coefficient", () => {
    // 6:00 per effort-km at the start, slowing as e^(0.003 x).
    const points = [40, 100, 250].map((e) => ({
      effortKm: e,
      movingHours: (0.1 * Math.expm1(0.003 * e)) / 0.003,
    }));
    expect(fitTerminus(points)).toMatchObject({
      basePaceSPerKm: 360,
      basePace: "6:00",
      fatigueCoefficient: 0.003,
      spreadPct: 0,
    });
  });

  it("is null under 3 events", () => {
    expect(fitTerminus([{ effortKm: 50, movingHours: 6 }])).toBeNull();
  });
});

describe("trailPrediction, the race clock", () => {
  // On the curve on the move, with stops of 0.005 × moving² on top.
  const stopped = (id, day, km, climb, extra = {}) => {
    const moving = onCurve(effortKm(km, climb));
    return trail(id, day, km, climb, moving + 0.005 * moving ** 2, {
      movingDuration: moving * 3600,
      elapsedDuration: (moving + 0.005 * moving ** 2) * 3600,
      eventType: { typeKey: "race" },
      ...extra,
    });
  };

  it("fits the time on the move and adds the stops on top", () => {
    const result = trailPrediction(
      [
        stopped(1, "2026-08-20", 20, 2000),
        stopped(2, "2026-06-01", 60, 4000),
        stopped(3, "2025-09-01", 200, 5000),
      ],
      "2026-10-28",
    );
    expect(result.fit).toMatchObject({ exponent: 1.3, spreadPct: 0 });
    const at100 = result.grid[1];
    expect(at100.hours).toBeCloseTo(onCurve(100) + 0.005 * onCurve(100) ** 2, 1);
    expect(result.fit.terminus).toMatchObject({ fatigueCoefficient: expect.any(Number) });
    expect(result.curve).toHaveLength(25);
  });

  it("reads the clock, not the timer a paused watch stopped", () => {
    const [paused] = trailPrediction(
      [
        trail(1, "2026-08-20", 100, 5000, 20, {
          elapsedDuration: 24 * 3600,
          movingDuration: 18 * 3600,
        }),
      ],
      "2026-10-28",
    ).events;
    expect(paused).toMatchObject({ time: "24h00", moving: "18h00", stops: "6h00" });
  });
});

describe("trailPrediction", () => {
  // Events: a flagged race, a race from the plan, an ultra-length day. Training: a long day.
  const history = [
    trail(1, "2026-08-20", 20, 2000, onCurve(40), { eventType: { typeKey: "race" } }),
    trail(2, "2026-06-01", 60, 4000, onCurve(100)),
    trail(3, "2025-09-01", 200, 5000, onCurve(250)),
    trail(4, "2026-07-01", 30, 1500, 9),
    // 4 years back: out of the window.
    trail(5, "2022-08-01", 200, 10_000, 99),
    // A short run: neither event nor long day.
    trail(6, "2026-10-01", 10, 200, 1),
  ];
  const races = [
    { date: "2026-06-01", text: "Local 60 km" },
    { date: "2026-12-05", text: "Saintélyon 81 km 2100 m D+" },
    { date: "2027-04-10", text: "Paris marathon" },
  ];
  const result = trailPrediction(history, "2026-10-28", races);

  it("fits the runner's events and leaves training days out of the curve", () => {
    expect(result.events.map((e) => [e.date, e.why])).toEqual([
      ["2026-08-20", "race"],
      ["2026-06-01", "plan"],
      ["2025-09-01", "ultra"],
    ]);
    expect(result.training.map((t) => t.date)).toEqual(["2026-07-01"]);
    expect(result.fit).toMatchObject({
      events: 3,
      exponent: 1.3,
      spreadPct: 0,
      fromEffortKm: 40,
      toEffortKm: 250,
    });
    expect(result.events[0]).toMatchObject({ effortKm: 40, offPct: 0 });
  });

  it("predicts the plan's races ahead from their course, and says what it can't read", () => {
    const [lyon, paris] = result.races;
    expect(lyon).toMatchObject({
      km: 81,
      climbM: 2100,
      effortKm: 102,
      within: true,
    });
    expect(lyon.hours).toBeCloseTo(onCurve(102), 1);
    expect(paris).toMatchObject({ km: null, effortKm: null, time: null, within: false });
    expect(result.grid.map((g) => g.effortKm)).toEqual([50, 100, 150, 200, 300]);
    expect(result.grid[1].hours).toBeCloseTo(onCurve(100), 1);
  });

  it("predicts nothing without enough events", () => {
    const thin = trailPrediction([trail(1, "2026-08-20", 100, 2000, 20)], "2026-10-28");
    expect(thin).toMatchObject({ fit: null, grid: [] });
    expect(thin.events).toHaveLength(1);
  });
});
