// @vitest-environment node
import { describe, expect, it } from "vitest";

import { activity } from "../src/test/fixtures.js";
import {
  createExportClient,
  HRV_DAYS,
  PAGE_SIZE,
  readHistory,
  readHrv,
  readRestingHr,
  readSleep,
  readZones,
  SLEEP_DAYS,
} from "./export.js";

const BASE = "https://garmin.test";
const jwt = (exp) => `h.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.s`;

// A fake Garmin: tokens in turn, then `pages` answered by their `start`.
function fakeGarmin({ tokens = [jwt(10_000)], data }) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (init?.method === "POST") return new Response(tokens.shift() ?? tokens.at(-1));
    return data(new URL(url), init);
  };
  return { fetch, calls };
}

const page = (from, length) =>
  Array.from({ length }, (_, i) => activity({ activityId: from + i, extra: "dropped" }));

describe("createExportClient", () => {
  it("refuses to start without a key", () => {
    expect(() => createExportClient({ apiKey: "" })).toThrow(/GARMIN_PERSONAL_API_KEY/);
  });

  it("sends the bearer token and pages of 100", async () => {
    const { fetch, calls } = fakeGarmin({ data: () => Response.json([]) });
    const client = createExportClient({
      apiKey: "k",
      baseUrl: BASE,
      fetch,
      now: () => 0,
    });
    await client.activities(200);
    const get = calls.find((c) => !c.init.method);
    expect(get.url).toContain("start=200&limit=100");
    expect(get.init.headers.Authorization).toBe(`Bearer ${jwt(10_000)}`);
  });

  it("exchanges the key again once on a 401", async () => {
    const fresh = jwt(20_000);
    const { fetch } = fakeGarmin({
      tokens: [jwt(10_000), fresh],
      data: (_, init) =>
        init.headers.Authorization === `Bearer ${fresh}`
          ? Response.json([])
          : new Response("", { status: 401 }),
    });
    const client = createExportClient({
      apiKey: "k",
      baseUrl: BASE,
      fetch,
      now: () => 0,
    });
    expect(await client.activities(0)).toEqual([]);
  });

  it("reads HRV over a date range, and nothing (204) as no night", async () => {
    const { fetch, calls } = fakeGarmin({
      data: (url) =>
        url.pathname.endsWith("/2026-10-01/2026-10-27")
          ? Response.json({
              hrvSummaries: [{ calendarDate: "2026-10-27", lastNightAvg: 38 }],
            })
          : new Response(null, { status: 204 }),
    });
    const client = createExportClient({
      apiKey: "k",
      baseUrl: BASE,
      fetch,
      now: () => 0,
    });
    expect(await client.hrv("2026-10-01", "2026-10-27")).toHaveLength(1);
    expect(await client.hrv("2020-01-01", "2020-12-30")).toEqual([]);
    expect(calls.at(-1).url).toBe(`${BASE}/hrv-service/hrv/daily/2020-01-01/2020-12-30`);
  });

  it("reads daily summaries' data array, sleep's numbered object and the zones", async () => {
    const { fetch, calls } = fakeGarmin({
      data: (url) =>
        url.pathname.includes("dailysummaries")
          ? Response.json({ data: [{ calendarDate: "2026-10-27" }] })
          : url.pathname.includes("sleep")
            ? Response.json({
                0: { calendarDate: "2026-10-26" },
                1: { calendarDate: "2026-10-27" },
              })
            : Response.json([{ sport: "RUNNING" }]),
    });
    const client = createExportClient({
      apiKey: "k",
      baseUrl: BASE,
      fetch,
      now: () => 0,
    });
    expect(await client.daily("2026-10-27", "2026-10-27")).toHaveLength(1);
    expect(calls.at(-1).url).toBe(
      `${BASE}/usersummary-service/v2/dailysummaries?startDate=2026-10-27&endDate=2026-10-27`,
    );
    expect(await client.sleep("2026-10-26", "2026-10-27")).toHaveLength(2);
    expect(await client.zones()).toEqual([{ sport: "RUNNING" }]);
  });

  it("throws on Garmin's errors", async () => {
    const { fetch } = fakeGarmin({
      data: () => new Response("", { status: 500 }),
    });
    const client = createExportClient({
      apiKey: "k",
      baseUrl: BASE,
      fetch,
      now: () => 0,
    });
    await expect(client.activities(0)).rejects.toThrow("Garmin answered 500.");
  });
});

describe("readHistory", () => {
  it("reads until a short page, each activity once and trimmed", async () => {
    const starts = [];
    const client = {
      activities: async (start) => {
        starts.push(start);
        // The second page repeats the first's last activity, as an upload mid-read shifts it.
        return start === 0 ? page(0, PAGE_SIZE) : page(PAGE_SIZE - 1, 3);
      },
    };
    const counts = [];
    const all = await readHistory(client, { onPage: (n) => counts.push(n) });
    expect(starts).toEqual([0, PAGE_SIZE]);
    expect(all).toHaveLength(PAGE_SIZE + 2);
    expect(all[0]).not.toHaveProperty("extra");
    expect(counts).toEqual([PAGE_SIZE, PAGE_SIZE + 2]);
  });
});

describe("readHrv", () => {
  const entry = (date, value) => ({
    calendarDate: date,
    lastNightAvg: value,
    weeklyAvg: value,
    status: "BALANCED",
    feedbackPhrase: "HRV_BALANCED_6",
    baseline: {
      lowUpper: 29,
      balancedLow: 32,
      balancedUpper: 46,
      markerValue: 0.5,
    },
  });

  it("reads a year at a time back from `until`, stopping at the first year with no reading", async () => {
    const ranges = [];
    const client = {
      hrv: async (start, end) => {
        ranges.push([start, end]);
        if (end === "2026-10-27") return [entry("2026-10-27", 38), entry("2026-01-02", 41)];
        if (end === "2025-10-27") return [entry("2025-03-01", 35), entry("2025-03-02", null)];
        return [];
      },
    };
    const nights = await readHrv(client, "2026-10-27", "2018-12-18");
    expect(ranges).toEqual([
      ["2025-10-28", "2026-10-27"],
      ["2024-10-28", "2025-10-27"],
      ["2023-10-29", "2024-10-27"],
    ]);
    expect(ranges.every(([s, e]) => (new Date(e) - new Date(s)) / 864e5 + 1 <= HRV_DAYS)).toBe(
      true,
    );
    // Oldest first, nights with no reading left out, each trimmed to what the skills read.
    expect(nights.map((n) => n.date)).toEqual(["2025-03-01", "2026-01-02", "2026-10-27"]);
    expect(nights[2]).toEqual({
      date: "2026-10-27",
      lastNightAvg: 38,
      weeklyAvg: 38,
      status: "BALANCED",
      balancedLow: 32,
      balancedUpper: 46,
    });
  });

  it("never asks for a day before `since`", async () => {
    const ranges = [];
    const client = {
      hrv: async (start, end) => {
        ranges.push([start, end]);
        return [entry(end, 40)];
      },
    };
    await readHrv(client, "2026-10-27", "2026-03-01");
    expect(ranges).toEqual([["2026-03-01", "2026-10-27"]]);
  });
});

describe("readRestingHr", () => {
  it("keeps the days with a resting heart rate, stopping at the first year without", async () => {
    const ranges = [];
    const client = {
      daily: async (start, end) => {
        ranges.push([start, end]);
        if (end === "2026-10-27")
          return [
            {
              calendarDate: "2026-10-26",
              heartRate: { restingValue: 55, minValue: 50 },
            },
            { calendarDate: "2026-10-27", heartRate: {} },
          ];
        // Older years carry activity totals, no heart rate.
        return [{ calendarDate: "2022-06-01", movement: {} }];
      },
    };
    expect(await readRestingHr(client, "2026-10-27", "2018-12-18")).toEqual([
      { date: "2026-10-26", resting: 55 },
    ]);
    expect(ranges).toHaveLength(2);
  });
});

describe("readSleep", () => {
  it("reads a month at a time down to `since`, past a month without a night", async () => {
    const ranges = [];
    const client = {
      sleep: async (start, end) => {
        ranges.push([start, end]);
        if (end === "2026-10-27")
          return [
            {
              calendarDate: "2026-10-27",
              sleepTimeSeconds: 27_000,
              sleepScores: { overall: { value: 81 } },
            },
            { calendarDate: "2026-10-26", sleepTimeSeconds: 0 },
          ];
        if (start === "2026-08-01")
          return [{ calendarDate: "2026-08-20", sleepTimeSeconds: 25_200 }];
        return [];
      },
    };
    const nights = await readSleep(client, "2026-10-27", "2026-08-01");
    expect(ranges).toEqual([
      ["2026-09-27", "2026-10-27"],
      ["2026-08-27", "2026-09-26"],
      ["2026-08-01", "2026-08-26"],
    ]);
    expect(ranges.every(([s, e]) => (new Date(e) - new Date(s)) / 864e5 + 1 <= SLEEP_DAYS)).toBe(
      true,
    );
    expect(nights).toEqual([
      { date: "2026-08-20", hours: 7, score: null },
      { date: "2026-10-27", hours: 7.5, score: 81 },
    ]);
  });
});

describe("readZones", () => {
  const zones = (sport, z3) => ({
    sport,
    trainingMethod: "HR_MAX",
    maxHeartRateUsed: 188,
    restingHeartRateUsed: 56,
    lactateThresholdHeartRateUsed: 171,
    zone1Floor: 94,
    zone2Floor: 113,
    zone3Floor: z3,
    zone4Floor: 162,
    zone5Floor: 169,
  });

  it("reads the running zones, else the default ones", async () => {
    const both = {
      zones: async () => [zones("DEFAULT", 132), zones("RUNNING", 152)],
    };
    expect(await readZones(both)).toEqual({
      sport: "RUNNING",
      method: "HR_MAX",
      maxHR: 188,
      restingHR: 56,
      thresholdHR: 171,
      floors: [94, 113, 152, 162, 169],
    });
    expect(await readZones({ zones: async () => [zones("DEFAULT", 132)] })).toMatchObject({
      sport: "DEFAULT",
      floors: [94, 113, 132, 162, 169],
    });
    expect(await readZones({ zones: async () => [] })).toBeNull();
  });
});
