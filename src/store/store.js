import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

import { createGarminClient } from "../api/garmin.js";
import { byYear } from "../utils/yearStats.js";
import { createActivityCache, trim } from "./cache.js";

// A year, or the whole history, is read in pages of Garmin's largest: it answers 500 past 100.
export const MAX_PAGE_SIZE = 100;

// Pages asked for at once after a full first one, when reading the whole history.
// why only a few: Garmin publishes no rate limit, and a page past the end is a wasted request.
// why not for a year: one rarely runs past two pages, so most of a guess would be wasted.
export const PARALLEL_PAGES = 4;

// What persist saves under, in localStorage.
const STORAGE_KEY = "garmin";

// The system's variant, until the user picks one (persist then restores theirs).
function systemTheme() {
  const prefersDark =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

// Each activity once, the first seen kept: a page read twice, or an activity shifted across
// pages by an upload during the read, isn't counted twice.
function unique(activities) {
  const seen = new Set();
  return activities.filter(({ activityId }) => !seen.has(activityId) && seen.add(activityId));
}

// Newest first, as Garmin sends them; the watch's local start sorts as a string.
const newestFirst = (a, b) => (b.startTimeLocal ?? "").localeCompare(a.startTimeLocal ?? "");

// The cache's key: one account's history never shows for another's.
const accountOf = (profile) => profile?.displayName ?? "me";

// The history's slot, and every year's filled from it, so the Year page needs no request.
function fromHistory(activities, years, extra = {}) {
  const perYear = byYear(activities, new Date().getFullYear());
  const filled = { ...years };
  for (const { year, activities: list } of perYear) {
    filled[year] = { status: "ready", activities: list, error: null };
  }
  return {
    history: {
      status: "ready",
      count: activities.length,
      activities,
      // The Year page stops there: nothing before it.
      firstYear: perYear[0]?.year ?? null,
      error: null,
      ...extra,
    },
    years: filled,
  };
}

// why a factory, as Regimen's: tests hand it a fake client and cache, the page the real ones.
export const createStore = (getClient = createGarminClient, cache = createActivityCache()) => {
  let client = null;
  const garmin = () => (client ??= getClient());
  // A reconnect drops whatever the last one is still loading: each result checks it first.
  let generation = 0;
  // The history read under way, and the connect it belongs to: asked twice, it runs once.
  let historyRun = null;

  // Every activity matching `filters`: the first page, then `parallel` at once until one
  // comes back short. Null when a newer connect started meanwhile: the caller drops it.
  // `onPage` hears the running count.
  async function readAll(filters, { parallel = 1, onPage } = {}) {
    const mine = generation;
    const read = async (start) =>
      ((await garmin().activities({ start, limit: MAX_PAGE_SIZE, ...filters })) ?? []).map(trim);
    const all = [];
    let pages = [await read(0)];
    for (;;) {
      if (mine !== generation) return null;
      for (const page of pages) {
        all.push(...page);
        if (page.length < MAX_PAGE_SIZE) {
          onPage?.(all.length);
          return unique(all);
        }
      }
      onPage?.(all.length);
      const from = all.length;
      pages = await Promise.all(
        Array.from({ length: parallel }, (_, i) => read(from + i * MAX_PAGE_SIZE)),
      );
    }
  }

  // why devtools outside persist: it then logs persist's rehydration as well as our actions.
  return create(
    devtools(
      persist(
        (set, get) => {
          // The history read loadHistory runs once per connect.
          async function readHistory() {
            const { history, profile } = get();
            if (history?.synced) return;
            const mine = generation;
            const kept = history?.status === "ready" ? history.activities : null;
            const put = (value, action) => set({ history: value }, false, action);
            if (kept) put({ ...history, syncing: true, error: null }, "loadHistory/syncing");
            else {
              put(
                { status: "loading", count: 0, activities: [], error: null },
                "loadHistory/loading",
              );
            }
            try {
              const read = kept
                ? // why no endDate: Garmin answers [] when it is a year or more ahead
                  // (probed 2026-10-26), and a startDate alone reads up to today.
                  await readAll({
                    startDate: kept[0]?.startTimeLocal?.slice(0, 10) ?? "1970-01-01",
                  })
                : await readAll(
                    {},
                    {
                      parallel: PARALLEL_PAGES,
                      onPage: (count) => put({ ...get().history, count }, "loadHistory/page"),
                    },
                  );
              if (read === null) return;
              // The new read first: an activity edited on its day is the new one.
              const activities = kept ? unique([...read, ...kept]).sort(newestFirst) : read;
              cache.save(accountOf(profile), activities);
              set(
                fromHistory(activities, get().years, { synced: true }),
                false,
                "loadHistory/ready",
              );
            } catch (err) {
              if (mine !== generation) return;
              // What was kept still shows: a failed read of what's new doesn't take it away.
              if (kept)
                put(
                  { ...get().history, syncing: false, synced: true, error: err.message },
                  "loadHistory/stale",
                );
              else
                put(
                  { status: "error", count: 0, activities: [], error: err.message },
                  "loadHistory/error",
                );
            }
          }

          return {
            theme: systemTheme(),
            // idle → loading → ready, or error when the proxy or Garmin refused.
            status: "idle",
            error: null,
            // The proxy's status for the error: 503 means no key in .env.
            errorStatus: null,
            profile: null,
            // Which page shows once connected: a year, or every year ("all").
            view: "year",
            // What the charts plot, page-wide: "distance", "duration" or "elevationGain".
            measure: "distance",
            year: new Date().getFullYear(),
            // The activity types the pages sum (typeKeys, null for none); empty sums them all.
            types: [],
            // Per year: { status: loading | ready | error, activities, error }. Kept until
            // Refresh, so going back to a year already read costs nothing.
            years: {},
            // Every activity since the first: { status, count (read so far), activities, error }.
            history: null,

            setMeasure(measure) {
              set({ measure }, false, "setMeasure");
            },

            toggleTheme() {
              const theme = get().theme === "dark" ? "light" : "dark";
              set({ theme }, false, "toggleTheme");
            },

            setView(view) {
              set({ view }, false, "setView");
            },

            // A legend entry is one type or several ("Other"): all picked → drop them all,
            // else pick the missing ones.
            toggleTypes(typeKeys) {
              const { types } = get();
              const all = typeKeys.every((key) => types.includes(key));
              const next = all
                ? types.filter((key) => !typeKeys.includes(key))
                : [...types, ...typeKeys.filter((key) => !types.includes(key))];
              set({ types: next }, false, "toggleTypes");
            },

            clearTypes() {
              set({ types: [] }, false, "clearTypes");
            },

            showYear(year) {
              set({ year }, false, "showYear");
              get().loadYear(year);
            },

            // The profile, then the history this browser kept, shown at once; then what is new
            // since, in the background. `fresh` (Refresh) skips the kept history: it reads it
            // all again, which also catches activities edited or deleted since.
            async connect({ fresh = false } = {}) {
              const mine = ++generation;
              set(
                { status: "loading", error: null, errorStatus: null, years: {}, history: null },
                false,
                "connect/loading",
              );
              try {
                const profile = await garmin().profileSettings();
                if (mine !== generation) return;
                const cached = fresh ? null : await cache.load(accountOf(profile));
                if (mine !== generation) return;
                set(
                  { status: "ready", profile, ...(cached && fromHistory(cached, {})) },
                  false,
                  "connect/ready",
                );
                // why read the history on every connect, not only on the All-time page: it is
                // what gets cached, so the next visit starts from it whichever page is open.
                get().loadHistory();
              } catch (err) {
                if (mine !== generation) return;
                set(
                  { status: "error", error: err.message, errorStatus: err.status ?? null },
                  false,
                  "connect/error",
                );
              }
            },

            refresh() {
              return get().connect({ fresh: true });
            },

            async loadYear(year) {
              const entry = get().years[year];
              if (entry?.status === "loading" || entry?.status === "ready") return;
              const mine = generation;
              const put = (value, action) =>
                set({ years: { ...get().years, [year]: value } }, false, action);
              put({ status: "loading", activities: [], error: null }, "loadYear/loading");
              try {
                const activities = await readAll({
                  startDate: `${year}-01-01`,
                  endDate: `${year}-12-31`,
                });
                if (activities === null) return;
                put({ status: "ready", activities, error: null }, "loadYear/ready");
              } catch (err) {
                if (mine !== generation) return;
                put({ status: "error", activities: [], error: err.message }, "loadYear/error");
              }
            },

            // The whole history: with none kept, read with no dates (about one request per
            // 100 activities); with one kept, only from its newest day on, merged into it.
            // Resolves when done, so the caller (or a test) can wait for it.
            loadHistory() {
              if (historyRun?.generation !== generation) {
                const run = { generation, promise: null };
                run.promise = readHistory().finally(() => {
                  if (historyRun === run) historyRun = null;
                });
                historyRun = run;
              }
              return historyRun.promise;
            },
          };
        },
        {
          name: STORAGE_KEY,
          storage: createJSONStorage(() => localStorage),
          // why only the theme, the view, the types and the measure: Garmin's data is kept
          // in IndexedDB by cache.js, where a write costs no main-thread JSON of it all.
          partialize: (state) => ({
            theme: state.theme,
            view: state.view,
            types: state.types,
            measure: state.measure,
          }),
          // why a migration: version 1 could persist the Activities view, which is gone.
          version: 2,
          migrate: (saved) => ({
            ...saved,
            view: saved?.view === "activities" ? "year" : saved?.view,
          }),
        },
      ),
      { name: "garmin", enabled: import.meta.env.DEV },
    ),
  );
};

const useStore = createStore();

export default useStore;
