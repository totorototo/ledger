// The whole history read from Node, for `npm run export` (scripts/export.mjs): the same key,
// token and paging as the proxy and the store, without a browser or a Vite server.

import { trim } from "../src/store/cache.js";
import { addDays } from "../src/utils/metrics.js";
import { createTokenSource, GARMIN_BASE_URL, GarminError } from "./garmin.js";

const ACTIVITIES_PATH = "/activitylist-service/activities/search/activities";
const HRV_PATH = "/hrv-service/hrv/daily";

// Garmin answers 500 past a `limit` of 100, as the store's MAX_PAGE_SIZE.
export const PAGE_SIZE = 100;

// Days of HRV per request: Garmin answers 400 at 400 days (probed 2026-10-28).
export const HRV_DAYS = 365;

// A GET on the Personal API, with the proxy's one forced re-exchange on a 401.
export function createExportClient({
  apiKey,
  baseUrl = GARMIN_BASE_URL,
  fetch = globalThis.fetch,
  now = () => Date.now() / 1000,
}) {
  if (!apiKey) throw new GarminError(503, "GARMIN_PERSONAL_API_KEY is not set in .env.");
  const tokens = createTokenSource({ apiKey, baseUrl, fetch, now });
  const send = (url, token) =>
    fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });

  async function get(path, params) {
    const url = `${baseUrl}${path}${params ? `?${new URLSearchParams(params)}` : ""}`;
    let response = await send(url, await tokens.get());
    if (response.status === 401) response = await send(url, await tokens.get(true));
    if (!response.ok) throw new GarminError(response.status, `Garmin answered ${response.status}.`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  return {
    activities: (start) => get(ACTIVITIES_PATH, { start, limit: PAGE_SIZE }),
    // Each night from `start` to `end` ("YYYY-MM-DD", both counted); 204 (none) reads as [].
    hrv: async (start, end) => (await get(`${HRV_PATH}/${start}/${end}`))?.hrvSummaries ?? [],
  };
}

// Every activity, newest first, trimmed to the fields the pages read, each once: page after
// page until one comes back short. One page at a time: an export has no one waiting on it.
export async function readHistory(client, { onPage } = {}) {
  const seen = new Set();
  const all = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const page = (await client.activities(start)) ?? [];
    for (const activity of page.map(trim)) {
      if (!seen.has(activity.activityId)) {
        seen.add(activity.activityId);
        all.push(activity);
      }
    }
    onPage?.(all.length);
    if (page.length < PAGE_SIZE) return all;
  }
}

// A night as the skills read it: Garmin's reading, its status and the balanced band of the
// athlete's own baseline. The rest (feedback phrase, timestamps) goes.
const night = (entry) => ({
  date: entry.calendarDate,
  lastNightAvg: entry.lastNightAvg ?? null,
  weeklyAvg: entry.weeklyAvg ?? null,
  status: entry.status ?? null,
  balancedLow: entry.baseline?.balancedLow ?? null,
  balancedUpper: entry.baseline?.balancedUpper ?? null,
});

// Every night's HRV from `since` to `until`, oldest first: a year per request, back from
// `until`, stopping at the first year with no reading.
// why stop there: the history starts with the first watch, HRV with the first one that
// measured it; years before it are requests that answer nothing.
export async function readHrv(client, until, since) {
  const nights = new Map();
  for (let end = until; end >= since; end = addDays(end, -HRV_DAYS)) {
    const start = addDays(end, -(HRV_DAYS - 1));
    const list = await client.hrv(start < since ? since : start, end);
    if (!list.some((entry) => entry.lastNightAvg != null)) break;
    for (const entry of list)
      if (entry.lastNightAvg != null) nights.set(entry.calendarDate, night(entry));
  }
  return [...nights.values()].sort((a, b) => a.date.localeCompare(b.date));
}
