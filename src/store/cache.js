// The whole history, kept in the browser between visits, so a visit reads only what is new.
// why IndexedDB, not persist's localStorage: persist writes the whole store on every set (the
// history read sets once per page), localStorage is synchronous and holds ~5 MB of strings.
import { createStore, del, get, set } from "idb-keyval";

// Bump it when the page starts reading a field KEPT drops: the old cache is then read again.
export const CACHE_VERSION = 1;

// The fields the pages and src/utils/metrics.js read. A Garmin list item has ~100.
// why trim what is read too, not only what is cached: a field missing here then shows up
// as missing at once, not only on the visit after the cache was written.
const KEPT = [
  "activityId",
  "activityName",
  "startTimeLocal",
  "activityType",
  "distance",
  "duration",
  "movingDuration",
  "elevationGain",
  "averageHR",
  "maxHR",
  "averageSpeed",
  "avgGradeAdjustedSpeed",
  "activityTrainingLoad",
  "hrTimeInZone_1",
  "hrTimeInZone_2",
  "hrTimeInZone_3",
  "hrTimeInZone_4",
  "hrTimeInZone_5",
];

export function trim(activity) {
  const kept = {};
  for (const key of KEPT) if (activity[key] !== undefined) kept[key] = activity[key];
  return kept;
}

// One entry per account (the profile's displayName): { version, activities }.
// Every call fails soft: no IndexedDB (a private window, the tests' jsdom) is no cache.
export function createActivityCache() {
  let store = null;
  const db = () => (store ??= createStore("garmin", "history"));

  return {
    async load(account) {
      try {
        const saved = await get(account, db());
        return saved?.version === CACHE_VERSION ? saved.activities : null;
      } catch {
        return null;
      }
    },
    async save(account, activities) {
      try {
        await set(account, { version: CACHE_VERSION, activities }, db());
      } catch {
        // No cache: the next visit reads the history again.
      }
    },
    async clear(account) {
      try {
        await del(account, db());
      } catch {
        // Nothing to clear.
      }
    },
  };
}

// The tests' cache, and the shape any cache has.
export function memoryCache(entries = {}) {
  const saved = new Map(Object.entries(entries));
  return {
    load: async (account) => saved.get(account) ?? null,
    save: async (account, activities) => void saved.set(account, activities),
    clear: async (account) => void saved.delete(account),
    saved,
  };
}
