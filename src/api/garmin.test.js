import { describe, expect, it, vi } from "vitest";

import { createGarminClient, GarminApiError } from "./garmin.js";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("createGarminClient", () => {
  it("asks the proxy, not Garmin, with the list's offset and size", async () => {
    const fetch = vi.fn(async () => json(200, [{ activityId: 1 }]));
    const client = createGarminClient(fetch);
    expect(await client.activities({ start: 20, limit: 10 })).toEqual([{ activityId: 1 }]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/garmin/activitylist-service/activities/search/activities?start=20&limit=10",
      { headers: { Accept: "application/json" } },
    );
  });

  it("narrows the list to dates only when asked", async () => {
    const fetch = vi.fn(async () => json(200, []));
    const client = createGarminClient(fetch);
    await client.activities({
      start: 0,
      limit: 100,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    });
    expect(fetch.mock.calls[0][0]).toBe(
      "/api/garmin/activitylist-service/activities/search/activities" +
        "?start=0&limit=100&startDate=2025-01-01&endDate=2025-12-31",
    );
  });

  it("reads an empty answer as null", async () => {
    const client = createGarminClient(async () => new Response("", { status: 200 }));
    expect(await client.profileSettings()).toBeNull();
  });

  it("carries the proxy's error and status", async () => {
    const client = createGarminClient(async () => json(503, { error: "No key." }));
    const error = await client.profileSettings().catch((err) => err);
    expect(error).toBeInstanceOf(GarminApiError);
    expect(error).toMatchObject({ status: 503, message: "No key." });
  });

  it("names the status when Garmin's body says nothing usable", async () => {
    const client = createGarminClient(async () => new Response("<html>", { status: 500 }));
    await expect(client.activities()).rejects.toThrow("Garmin answered 500.");
  });
});
