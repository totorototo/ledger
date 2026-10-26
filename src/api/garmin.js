// The page's side of the Personal API: same-origin GETs to /api/garmin, which the Vite server
// signs and forwards (server/garmin.js). No key, no token here. Paths as Garmin's own client.

export class GarminApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// The proxy's errors are { error }; Garmin's own bodies vary, so the status says it then.
async function errorMessage(response) {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    // Not JSON.
  }
  return `Garmin answered ${response.status}.`;
}

export function createGarminClient(fetchImpl = (...args) => fetch(...args)) {
  async function get(path, params) {
    const query = params ? `?${new URLSearchParams(params)}` : "";
    const response = await fetchImpl(`/api/garmin${path}${query}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new GarminApiError(response.status, await errorMessage(response));
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  return {
    profileSettings: () => get("/userprofile-service/userprofile/settings"),
    // Newest first; `start` is an offset into the list, not a date. Garmin answers 500 past
    // a `limit` of 100. `startDate` and `endDate` ("2026-01-01") both count their whole day.
    activities: ({ start = 0, limit = 20, startDate, endDate } = {}) =>
      get("/activitylist-service/activities/search/activities", {
        start,
        limit,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      }),
  };
}
