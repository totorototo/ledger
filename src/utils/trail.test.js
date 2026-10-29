import { activity } from "../test/fixtures.js";
import {
  course,
  effortKm,
  fitCurve,
  fitStops,
  fitTerminus,
  ground,
  hm,
  raceName,
  result,
  trailPrediction,
} from "./trail.js";

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
    expect(course("Mountain Race 120,5 km D+ 7 000, B race")).toEqual({ km: 120.5, climbM: 7000 });
    expect(course("Trail des Cerfs 30 km 1500 m+")).toEqual({ km: 30, climbM: 1500 });
  });

  it("leaves out what the line doesn't say", () => {
    expect(course("Marathon de Paris, A race")).toEqual({ km: null, climbM: null });
  });
});

describe("result and raceName", () => {
  it("reads a past race's clock or DNF", () => {
    expect(result("Night Race 80 km 2000 m D+, 15:30:00").hours).toBe(15.5);
    expect(result("Mountain Race 160 km 10000 m D+, 47h17").hours).toBeCloseTo(47.2833, 3);
    expect(result("Mountain Race 160 km 10000 m D+, DNF")).toEqual({ dnf: true });
    expect(result("Saintélyon 81 km 2100 m D+, A race, goal under 12 h")).toEqual({});
  });

  it("names a race without its course or result", () => {
    expect(raceName("Col Trail, The Ridge 43 km 2800 m D+, 8:33:13")).toBe("Col Trail, The Ridge");
    expect(raceName("Island Crossing 175 km 10500 m D+, A race")).toBe("Island Crossing");
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

describe("ground", () => {
  it("reads a race line's ground, in English or French", () => {
    expect(ground("Island Crossing 175 km 10500 m D+, technical")).toBe("technical");
    expect(ground("Night Trail 80 km 2000 m D+, roulant, 13:45:00")).toBe("runnable");
    expect(ground("Hill Race 40 km 1500 m D+, 5:10:00")).toBeNull();
  });
});

describe("fitCurve, with grounds", () => {
  // On the curve 0.05 × e^1.3, runnable 20% faster, technical 25% slower.
  const factor = { runnable: 0.8, technical: 1.25 };
  const at = (e, g = null) => ({ effortKm: e, ground: g, hours: onCurve(e) * (factor[g] ?? 1) });
  const points = [
    at(40),
    at(100),
    at(250),
    at(90, "runnable"),
    at(210, "runnable"),
    at(120, "technical"),
    at(300, "technical"),
  ];

  it("finds each ground's factor beside the runner's own exponent", () => {
    const fit = fitCurve(points);
    expect(fit.b).toBeCloseTo(1.3, 5);
    expect(Math.exp(fit.grounds.runnable)).toBeCloseTo(0.8, 5);
    expect(Math.exp(fit.grounds.technical)).toBeCloseTo(1.25, 5);
    expect(fit.spread).toBeCloseTo(0, 5);
  });

  it("fits a ground only with 2 events of it, and mixed ones to measure against", () => {
    expect(fitCurve(points.slice(0, 4)).grounds).toEqual({});
    // Every event tagged: the rarer ground joins mixed.
    const tagged = [at(90, "runnable"), at(210, "runnable")].concat(
      [40, 120, 250, 300].map((e) => at(e, "technical")),
    );
    expect(Object.keys(fitCurve(tagged).grounds)).toEqual(["technical"]);
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

describe("trailPrediction, the plan's results", () => {
  const runs = [
    // The course, with the watch: its moving time is the result's.
    trail(1, "2026-08-21", 175, 10_000, 49, { movingDuration: 38 * 3600 }),
    // A run to the start and the race back: 166 km on an 80 km course.
    trail(2, "2024-11-30", 166, 5251, 30),
    // A DNF recorded to the drop, 161 km in.
    trail(3, "2026-05-13", 161, 5040, 38.5),
  ];
  const races = [
    { date: "2026-08-21", text: "Mountain Race 170 km 10000 m D+, 49:30:00" },
    { date: "2024-11-30", text: "Night Race 80 km 2000 m D+, 15:30:00" },
    { date: "2026-05-13", text: "Long Race 220 km 8000 m D+, DNF" },
    // Older than the 3 years: a listed result counts all the same.
    { date: "2018-08-24", text: "Mountain Race 160 km 10000 m D+, 47:00:00" },
  ];
  const result = trailPrediction(runs, "2026-10-28", races);

  it("takes the official course and clock, the watch's moving time when it ran the course", () => {
    expect(result.events.map((e) => [e.date, e.why, e.name, e.time, e.moving])).toEqual([
      ["2026-08-21", "result", "Mountain Race", "49h30", "38h00"],
      ["2024-11-30", "result", "Night Race", "15h30", null],
      ["2018-08-24", "result", "Mountain Race", "47h00", null],
    ]);
    expect(result.events[1].effortKm).toBe(100);
  });

  it("never fits a DNF, and keeps it in sight", () => {
    expect(result.training.map((d) => [d.date, d.note])).toEqual([["2026-05-13", "DNF"]]);
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

  it("predicts a race ahead on its ground, and says when that ground can't be fitted", () => {
    const tagged = trailPrediction(
      history,
      "2026-10-28",
      races.concat({ date: "2027-10-14", text: "Island Crossing 175 km 10500 m D+, technical" }),
    );
    expect(tagged.races.at(-1)).toMatchObject({ ground: "technical", groundFitted: false });
    expect(tagged.races.at(-1).hours).toBeCloseTo(onCurve(280), 0);
  });

  it("predicts nothing without an event", () => {
    const none = trailPrediction([trail(1, "2026-08-20", 10, 200, 1)], "2026-10-28");
    expect(none).toMatchObject({ fit: null, assumed: null, grid: [], curve: [] });
  });
});

describe("trailPrediction, recent form", () => {
  // Older events on the curve; the last two seasons' 15% under it.
  const race = (id, day, km, climb, factor) =>
    trail(id, day, km, climb, onCurve(effortKm(km, climb)) * factor, {
      eventType: { typeKey: "race" },
    });
  const older = [race(1, "2023-12-01", 30, 1000, 1), race(2, "2024-05-01", 150, 5000, 1)];
  const recent = [race(3, "2025-06-01", 80, 2000, 0.85), race(4, "2026-06-01", 200, 5000, 0.85)];
  const ahead = [{ date: "2027-06-01", text: "Long One 200 km 4000 m D+" }];

  it("says how far the last 24 months lean from the curve, beside each time", () => {
    const result = trailPrediction([...older, ...recent], "2026-10-28", ahead);
    expect(result.recentForm).toMatchObject({ from: "2024-10-28", events: 2 });
    expect(result.recentForm.pct).toBeLessThan(0);
    const [race] = result.races;
    const minutes = (t) => Number(t.split("h")[0]) * 60 + Number(t.split("h")[1]);
    expect(minutes(race.formTime)).toBeLessThan(minutes(race.time));
    expect(result.grid[0].formTime).not.toBeNull();
  });

  it("says nothing on one recent event", () => {
    const result = trailPrediction(
      [...older, race(5, "2024-06-01", 60, 1500, 1), recent[1]],
      "2026-10-28",
      ahead,
    );
    expect(result.recentForm).toBeNull();
    expect(result.races[0].formTime).toBeNull();
  });
});

describe("trailPrediction, out of sample", () => {
  const race = (id, day, km, climb, factor) =>
    trail(id, day, km, climb, onCurve(effortKm(km, climb)) * factor, {
      eventType: { typeKey: "race" },
    });
  const lengths = [
    [30, 1000],
    [50, 2000],
    [80, 3000],
    [120, 5000],
    [160, 8000],
    [200, 9000],
  ];
  const events = (factors) =>
    lengths.map(([km, climb], i) => race(i + 1, `2025-0${i + 1}-01`, km, climb, factors[i]));

  it("predicts each event without it, and says how many the band held", () => {
    const { fit } = trailPrediction(events([1, 1.2, 0.85, 1.1, 0.9, 1]), "2026-10-28");
    expect(fit.outOfSample.events).toBe(6);
    // A race the curve hasn't seen lands further than the events it went through.
    expect(fit.outOfSample.pct).toBeGreaterThan(fit.spreadPct);
    expect(fit.outOfSample.inBand).toBeLessThan(6);
  });

  it("misses nothing on events right on the curve", () => {
    const { fit } = trailPrediction(events([1, 1, 1, 1, 1, 1]), "2026-10-28");
    // Only the events' rounding (hours, effort-km) is left: under 1%.
    expect(fit.outOfSample).toMatchObject({ events: 6, pct: 0 });
  });
});

describe("trailPrediction, preparation", () => {
  const race = (id, day, km, climb) =>
    trail(id, day, km, climb, onCurve(effortKm(km, climb)), { eventType: { typeKey: "race" } });
  const run = (id, day, km) =>
    activity({
      activityId: id,
      startTimeLocal: `${day} 07:00:00`,
      activityType: { typeKey: "running" },
      distance: km * 1000,
      duration: km * 360,
    });
  const ride = activity({
    activityId: 90,
    startTimeLocal: "2026-07-01 07:00:00",
    activityType: { typeKey: "road_biking" },
    distance: 80000,
    duration: 3 * 3600,
  });

  it("sums the running km of the 12 weeks before each event, never another sport's", () => {
    const result = trailPrediction(
      [
        run(10, "2026-01-01", 5),
        run(11, "2026-06-01", 20),
        run(12, "2026-08-20", 15),
        ride,
        race(1, "2024-06-01", 40, 1500),
        race(2, "2025-06-01", 100, 4000),
        race(3, "2026-08-21", 200, 8000),
      ],
      "2026-10-28",
    );
    const prepOf = (date) => result.events.find((e) => e.date === date).prepRunKm;
    // The race day's own km, the ride and the run of 2026-01-01, out of the window, don't count.
    expect(prepOf("2026-08-21")).toBe(35);
    // The history covers those 12 weeks and holds no run: 0, a rest.
    expect(prepOf("2025-06-01")).toBe(0);
    // The history starts inside them: unknown, not 0.
    expect(prepOf("2024-06-01")).toBeNull();
  });
});

describe("trailPrediction, too few events for a curve", () => {
  // Two events, too close in length to fit: 100 effort-km in 20 h, 120 in 25 h.
  const two = [
    trail(1, "2026-08-20", 80, 2000, 20, { eventType: { typeKey: "race" } }),
    trail(2, "2025-06-01", 100, 2000, 25, { eventType: { typeKey: "race" } }),
  ];

  it("scales from the event closest to the next race, and says it assumed", () => {
    const result = trailPrediction(two, "2026-10-28", [
      { date: "2027-06-01", text: "Long One 200 km 4000 m D+" },
    ]);
    expect(result.fit).toBeNull();
    expect(result.assumed).toMatchObject({
      exponent: 1.15,
      spreadPct: 16,
      anchor: { date: "2025-06-01", effortKm: 120 },
    });
    const [race] = result.races;
    expect(race.hours).toBeCloseTo(25 * 2 ** 1.15, 1);
    expect(race).toMatchObject({ moving: null, stops: null, within: false });
  });

  it("scales from the latest event without a race ahead, its range wider further away", () => {
    const result = trailPrediction(two, "2026-10-28");
    expect(result.assumed.anchor.date).toBe("2026-08-20");
    // The curve's point nearest the 100 effort-km anchor (101): the narrowest band.
    const near = result.curve.find((c) => c.effortKm === 101);
    expect(near.high / near.hours).toBeCloseTo(Math.exp(0.15), 2);
    const at400 = result.curve.at(-1);
    expect(at400.high / at400.hours).toBeCloseTo(Math.exp(0.15 + 0.1 * 2), 2);
  });
});
