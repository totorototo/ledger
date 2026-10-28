import { describe, expect, it, vi } from "vitest";

import { activity, profile } from "../test/fixtures.js";
import { memoryCache } from "./cache.js";
import { createStore, MAX_PAGE_SIZE, PARALLEL_PAGES } from "./store.js";

const page = (count, from = 0) =>
  Array.from({ length: count }, (_, i) => activity({ activityId: from + i }));

function fakeClient(overrides = {}) {
  return {
    profileSettings: vi.fn(async () => profile),
    activities: vi.fn(async () => []),
    ...overrides,
  };
}

describe("store", () => {
  it("starts idle, loads the profile on connect, then reads the history behind it", async () => {
    const client = fakeClient();
    const store = createStore(() => client, memoryCache());
    expect(store.getState().status).toBe("idle");
    await store.getState().connect();
    const state = store.getState();
    expect(state.status).toBe("ready");
    expect(state.profile.displayName).toBe("runner");
    expect(state.view).toBe("year");
    await store.getState().loadHistory();
    expect(client.activities).toHaveBeenCalledOnce();
    expect(client.activities).toHaveBeenCalledWith({ start: 0, limit: MAX_PAGE_SIZE });
  });

  it("keeps the proxy's status with the error", async () => {
    const refused = Object.assign(new Error("No key."), { status: 503 });
    const store = createStore(() =>
      fakeClient({ profileSettings: vi.fn(async () => Promise.reject(refused)) }),
    );
    await store.getState().connect();
    expect(store.getState()).toMatchObject({ status: "error", error: "No key.", errorStatus: 503 });
  });

  it("drops an older connect's answer", async () => {
    let release;
    const slow = new Promise((resolve) => (release = resolve));
    const client = fakeClient({
      profileSettings: vi
        .fn()
        .mockImplementationOnce(() => slow)
        .mockImplementation(async () => ({ ...profile, displayName: "second" })),
    });
    const store = createStore(() => client, memoryCache());
    const first = store.getState().connect();
    await store.getState().connect();
    release({ ...profile, displayName: "first" });
    await first;
    expect(store.getState().profile.displayName).toBe("second");
  });

  it("reads a whole year, page after page, then keeps it", async () => {
    const pages = { 0: page(MAX_PAGE_SIZE), [MAX_PAGE_SIZE]: page(7, MAX_PAGE_SIZE) };
    const client = fakeClient({
      activities: vi.fn(async ({ start, startDate }) => (startDate ? (pages[start] ?? []) : [])),
    });
    const store = createStore(() => client, memoryCache());
    await store.getState().connect();
    await store.getState().loadHistory();
    client.activities.mockClear();
    await store.getState().loadYear(2025);
    expect(client.activities).toHaveBeenCalledTimes(2);
    expect(client.activities).toHaveBeenLastCalledWith({
      start: MAX_PAGE_SIZE,
      limit: MAX_PAGE_SIZE,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    });
    expect(store.getState().years[2025]).toMatchObject({ status: "ready" });
    expect(store.getState().years[2025].activities).toHaveLength(MAX_PAGE_SIZE + 7);
    await store.getState().loadYear(2025);
    expect(client.activities).toHaveBeenCalledTimes(2);
  });

  it("forgets the years on refresh, and drops a year still loading", async () => {
    let release;
    const client = fakeClient({
      activities: vi.fn(async ({ startDate }) =>
        startDate ? new Promise((resolve) => (release = resolve)) : page(3),
      ),
    });
    const store = createStore(() => client, memoryCache());
    await store.getState().connect();
    const loading = store.getState().loadYear(2025);
    await store.getState().connect();
    release(page(3));
    await loading;
    expect(store.getState().years[2025]).toBeUndefined();
  });

  it("keeps a year's error with the year", async () => {
    const client = fakeClient({
      activities: vi.fn(async ({ startDate }) => {
        if (startDate) throw new Error("Garmin answered 500.");
        return page(3);
      }),
    });
    const store = createStore(() => client, memoryCache());
    await store.getState().connect();
    store.getState().showYear(2024);
    await vi.waitFor(() => expect(store.getState().years[2024].status).toBe("error"));
    expect(store.getState().year).toBe(2024);
    expect(store.getState().years[2024].error).toBe("Garmin answered 500.");
  });

  it("keeps the year compared with, and reads it", async () => {
    const client = fakeClient({ activities: vi.fn(async () => []) });
    const store = createStore(() => client, memoryCache());
    await store.getState().connect();
    store.getState().compareWith(2021);
    expect(store.getState().against).toBe(2021);
    await vi.waitFor(() => expect(store.getState().years[2021].status).toBe("ready"));
    expect(client.activities).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: "2021-01-01", endDate: "2021-12-31" }),
    );
    // A comparison is a question of the moment: not persisted.
    expect(JSON.parse(localStorage.getItem("garmin")).state.against).toBeUndefined();
  });

  it("reads the whole history, counting as it goes, and files it by year", async () => {
    const at = (i) =>
      activity({ activityId: i, startTimeLocal: `${2019 + (i % 3) * 2}-05-01 08:00:00` });
    const all = Array.from({ length: MAX_PAGE_SIZE + 5 }, (_, i) => at(i));
    const client = fakeClient({
      activities: vi.fn(async ({ start, limit }) => all.slice(start, start + limit)),
    });
    const store = createStore(() => client, memoryCache());
    const counts = [];
    const stop = store.subscribe((state) => counts.push(state.history?.count));
    await store.getState().connect();
    await store.getState().loadHistory();
    stop();
    expect(client.activities).toHaveBeenCalledWith({ start: 0, limit: MAX_PAGE_SIZE });
    expect(client.activities).toHaveBeenCalledTimes(1 + PARALLEL_PAGES);
    expect(counts).toContain(MAX_PAGE_SIZE);
    const { history, years } = store.getState();
    expect(history).toMatchObject({ status: "ready", count: MAX_PAGE_SIZE + 5, firstYear: 2019 });
    // 2019, 2021 and 2023 have activities; the years between and since are read as empty.
    expect(years[2019].activities).toHaveLength(35);
    expect(years[2020]).toMatchObject({ status: "ready", activities: [] });
    expect(years[new Date().getFullYear()].status).toBe("ready");
    await store.getState().loadYear(2021);
    expect(client.activities).toHaveBeenCalledTimes(1 + PARALLEL_PAGES);
  });

  it("counts an activity once when an upload shifts it across pages", async () => {
    const all = page(MAX_PAGE_SIZE + 5);
    const client = fakeClient({
      // The second page starts one early, as if one activity arrived between the reads.
      activities: vi.fn(async ({ start, limit }) =>
        start === 0 ? all.slice(0, limit) : all.slice(start - 1, start - 1 + limit),
      ),
    });
    const store = createStore(() => client, memoryCache());
    await store.getState().connect();
    await store.getState().loadHistory();
    expect(store.getState().history.count).toBe(MAX_PAGE_SIZE + 5);
  });

  it("keeps only the fields the pages read", async () => {
    const client = fakeClient({
      activities: vi.fn(async () => [activity({ deviceId: 42, summarizedDiveInfo: {} })]),
    });
    const cache = memoryCache();
    const store = createStore(() => client, cache);
    await store.getState().connect();
    await store.getState().loadHistory();
    const [kept] = store.getState().history.activities;
    expect(kept).toEqual(activity());
    expect(cache.saved.get("runner")).toEqual([activity()]);
  });

  describe("with a history kept from a visit before", () => {
    const old = [
      activity({ activityId: 2, startTimeLocal: "2026-10-20 07:30:00", distance: 5000 }),
      activity({ activityId: 1, startTimeLocal: "2025-03-01 07:30:00" }),
    ];

    it("shows it on connect, then reads only from its newest day and merges", async () => {
      const fresh = [
        activity({ activityId: 3, startTimeLocal: "2026-10-25 09:00:00" }),
        // Edited on Garmin since: the new read wins.
        activity({ activityId: 2, startTimeLocal: "2026-10-20 07:30:00", distance: 6000 }),
      ];
      const client = fakeClient({ activities: vi.fn(async () => fresh) });
      const cache = memoryCache({ runner: old });
      const store = createStore(() => client, cache);
      await store.getState().connect();
      expect(store.getState().history).toMatchObject({ status: "ready", count: 2 });
      expect(store.getState().years[2025].activities).toHaveLength(1);
      await store.getState().loadHistory();
      expect(client.activities).toHaveBeenCalledOnce();
      expect(client.activities).toHaveBeenCalledWith({
        start: 0,
        limit: MAX_PAGE_SIZE,
        startDate: "2026-10-20",
      });
      const ids = store.getState().history.activities.map((a) => a.activityId);
      expect(ids).toEqual([3, 2, 1]);
      expect(store.getState().history.activities[1].distance).toBe(6000);
      expect(cache.saved.get("runner").map((a) => a.activityId)).toEqual([3, 2, 1]);
      // Read once per connect.
      await store.getState().loadHistory();
      expect(client.activities).toHaveBeenCalledOnce();
    });

    it("keeps showing it when the read of what's new fails", async () => {
      const client = fakeClient({
        activities: vi.fn(async () => Promise.reject(new Error("Garmin answered 500."))),
      });
      const store = createStore(() => client, memoryCache({ runner: old }));
      await store.getState().connect();
      await store.getState().loadHistory();
      expect(store.getState().history).toMatchObject({
        status: "ready",
        count: 2,
        error: "Garmin answered 500.",
      });
    });

    it("reads it all again on refresh, dropping what was deleted", async () => {
      const client = fakeClient({ activities: vi.fn(async () => [old[0]]) });
      const cache = memoryCache({ runner: old });
      const store = createStore(() => client, cache);
      await store.getState().refresh();
      expect(store.getState().history.status).toBe("loading");
      await store.getState().loadHistory();
      expect(client.activities).toHaveBeenCalledWith({ start: 0, limit: MAX_PAGE_SIZE });
      expect(store.getState().history.count).toBe(1);
      expect(cache.saved.get("runner")).toHaveLength(1);
    });
  });

  it("picks types, alone or in a group, and clears them", () => {
    const store = createStore(() => fakeClient(), memoryCache());
    expect(store.getState().types).toEqual([]);
    store.getState().toggleTypes(["cycling"]);
    store.getState().toggleTypes(["trail_running", "hiking"]);
    store.getState().toggleTypes(["cycling"]);
    expect(store.getState().types).toEqual(["trail_running", "hiking"]);
    // A group half picked is completed, then dropped whole.
    store.getState().toggleTypes(["hiking", "walking"]);
    expect(store.getState().types).toEqual(["trail_running", "hiking", "walking"]);
    store.getState().toggleTypes(["hiking", "walking"]);
    expect(store.getState().types).toEqual(["trail_running"]);
    store.getState().clearTypes();
    expect(store.getState().types).toEqual([]);
  });

  it("sets the page's measure", () => {
    const store = createStore(() => fakeClient(), memoryCache());
    expect(store.getState().measure).toBe("distance");
    store.getState().setMeasure("elevationGain");
    expect(store.getState().measure).toBe("elevationGain");
  });

  it("flips the theme", () => {
    const store = createStore(() => fakeClient(), memoryCache());
    const before = store.getState().theme;
    store.getState().toggleTheme();
    expect(store.getState().theme).not.toBe(before);
  });
});
