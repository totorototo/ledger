// The whole history read from Node, for `npm run export` (scripts/export.mjs): the same key,
// token and paging as the proxy and the store, without a browser or a Vite server.

import { trim } from "../src/store/cache.js";
import { addDays } from "../src/utils/metrics.js";
import { createTokenSource, GARMIN_BASE_URL, GarminError } from "./garmin.js";

const ACTIVITIES_PATH = "/activitylist-service/activities/search/activities";
const HRV_PATH = "/hrv-service/hrv/daily";
const DAILY_PATH = "/usersummary-service/v2/dailysummaries";
const SLEEP_PATH = "/sleep-service/sleep/dailySleepSummariesByDate";
const ZONES_PATH = "/biometric-service/heartRateZones/v2";

// Garmin answers 500 past a `limit` of 100, as the store's MAX_PAGE_SIZE.
export const PAGE_SIZE = 100;

// Days of HRV per request: Garmin answers 400 at 400 days (probed 2026-10-28).
export const HRV_DAYS = 365;
// Daily summaries answer 400 past 365 days, sleep past 31 (both probed 2026-10-28).
export const DAILY_DAYS = 365;
export const SLEEP_DAYS = 31;

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
    fetch(url, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });

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
    // Each day's wellness summary; resting heart rate is `heartRate.restingValue`.
    daily: async (start, end) =>
      (await get(DAILY_PATH, { startDate: start, endDate: end }))?.data ?? [],
    // Each night's sleep; Garmin answers an object keyed "0", "1"… rather than an array.
    sleep: async (start, end) =>
      Object.values((await get(SLEEP_PATH, { startDate: start, endDate: end })) ?? {}),
    // The heart-rate zones as set now, one entry per sport: Garmin keeps no history of them.
    zones: async () => (await get(ZONES_PATH)) ?? [],
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

// Days from `since` to `until`, oldest first, `days` per request back from `until`: `pick`
// turns an entry into a record, or null when it holds no reading. With `stop`, the first
// request with no reading ends the read.
// why stop there: the history starts with the first watch, wellness readings with the first
// one that measured them; years before it are requests that answer nothing.
export async function readBack(read, { until, since, days, pick, stop = true }) {
  const records = new Map();
  for (let end = until; end >= since; end = addDays(end, -days)) {
    const start = addDays(end, -(days - 1));
    const found = (await read(start < since ? since : start, end)).map(pick).filter(Boolean);
    if (stop && !found.length) break;
    for (const record of found) records.set(record.date, record);
  }
  return [...records.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Every night's HRV from `since` to `until`: a year per request.
export const readHrv = (client, until, since) =>
  readBack(client.hrv, {
    until,
    since,
    days: HRV_DAYS,
    pick: (entry) => (entry.lastNightAvg != null ? night(entry) : null),
  });

// Every day's resting heart rate from `since` to `until`: a year per request. Older years
// carry activity totals but no heart rate, so they end the read like HRV's.
export const readRestingHr = (client, until, since) =>
  readBack(client.daily, {
    until,
    since,
    days: DAILY_DAYS,
    pick: (entry) =>
      entry.heartRate?.restingValue != null
        ? { date: entry.calendarDate, resting: entry.heartRate.restingValue }
        : null,
  });

// Every night's sleep from `since` to `until`: a month per request, so no stop on an empty
// one. A month without the watch on happens; `since` is where the wellness readings start.
export const readSleep = (client, until, since) =>
  readBack(client.sleep, {
    until,
    since,
    days: SLEEP_DAYS,
    stop: false,
    pick: (entry) =>
      entry.sleepTimeSeconds > 0
        ? {
            date: entry.calendarDate,
            hours: Math.round((entry.sleepTimeSeconds / 3600) * 10) / 10,
            score: entry.sleepScores?.overall?.value ?? null,
          }
        : null,
  });

// The running zones as set now (the default ones without a running set): what "easy" (Z1–2)
// means in the intensity split today. The floors are each zone's lowest heart rate.
export async function readZones(client) {
  const list = await client.zones();
  const zones = list.find((z) => z.sport === "RUNNING") ?? list.find((z) => z.sport === "DEFAULT");
  if (!zones) return null;
  return {
    sport: zones.sport,
    method: zones.trainingMethod ?? null,
    maxHR: zones.maxHeartRateUsed ?? null,
    restingHR: zones.restingHeartRateUsed ?? null,
    thresholdHR: zones.lactateThresholdHeartRateUsed ?? null,
    floors: [1, 2, 3, 4, 5].map((z) => zones[`zone${z}Floor`] ?? null),
  };
}
