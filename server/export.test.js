// @vitest-environment node
import { describe, expect, it } from "vitest";

import { activity } from "../src/test/fixtures.js";
import { createExportClient, PAGE_SIZE, readHistory } from "./export.js";

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
