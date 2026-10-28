// The whole history read from Node, for `npm run export` (scripts/export.mjs): the same key,
// token and paging as the proxy and the store, without a browser or a Vite server.

import { trim } from "../src/store/cache.js";
import { createTokenSource, GARMIN_BASE_URL, GarminError } from "./garmin.js";

const ACTIVITIES_PATH = "/activitylist-service/activities/search/activities";

// Garmin answers 500 past a `limit` of 100, as the store's MAX_PAGE_SIZE.
export const PAGE_SIZE = 100;

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
