// The page's /api/garmin calls answered here, so the built app runs without Garmin or a key.
// Synthetic data, in the Personal API's shape (src/test/fixtures.js).

export const PROFILE = { displayName: "runner", measurementSystem: "metric" };

export const ACTIVITIES = [
  {
    activityId: 1,
    activityName: "Morning trail",
    startTimeLocal: "2026-10-20 07:30:00",
    activityType: { typeKey: "trail_running" },
    distance: 21_100,
    duration: 9000,
    elevationGain: 1250,
  },
];

// A run's heart rate, zones and load: most runs easy, every third one hard, and the easy
// heart rate a little lower each year, so the efficiency line has a trend to show.
function effort(year, day, duration, distance) {
  const hard = day % 18 === 9;
  const easyHR = 150 - (year % 10) * 3 + (day % 5);
  const hardShare = hard ? 0.45 : 0.05;
  return {
    averageSpeed: distance / duration,
    averageHR: hard ? 168 : easyHR,
    activityTrainingLoad: Math.round((duration / 60) * (hard ? 2.4 : 1.3)),
    hrTimeInZone_1: Math.round(duration * 0.35),
    hrTimeInZone_2: Math.round(duration * (0.55 - hardShare)),
    hrTimeInZone_3: Math.round(duration * 0.1),
    hrTimeInZone_4: Math.round(duration * hardShare),
  };
}

// A made-up year: a run every 6th day, longer in summer, and a ride each month.
export function yearOfActivities(year) {
  const activities = [];
  for (let month = 1; month <= 12; month += 1) {
    const mm = String(month).padStart(2, "0");
    const summer = 1 + Math.sin(((month - 3) / 12) * 2 * Math.PI) * 0.5;
    for (let day = 3; day <= 27; day += 6) {
      activities.push({
        activityId: year * 1000 + month * 40 + day,
        activityName: "Trail",
        startTimeLocal: `${year}-${mm}-${String(day).padStart(2, "0")} 07:30:00`,
        activityType: { typeKey: "trail_running" },
        distance: Math.round(12_000 * summer),
        duration: Math.round(5400 * summer),
        elevationGain: Math.round(600 * summer),
        ...effort(year, day, Math.round(5400 * summer), Math.round(12_000 * summer)),
      });
    }
    activities.push({
      activityId: year * 1000 + month * 40,
      activityName: "Ride",
      startTimeLocal: `${year}-${mm}-15 17:00:00`,
      activityType: { typeKey: "cycling" },
      distance: 45_000,
      duration: 6000,
      elevationGain: 400,
      averageHR: 128,
      activityTrainingLoad: 90,
      hrTimeInZone_1: 2400,
      hrTimeInZone_2: 3000,
      hrTimeInZone_3: 600,
    });
  }
  return activities.reverse();
}

// Newest first, as Garmin lists them: the list's activity, then three made-up years.
export function history() {
  const thisYear = new Date().getFullYear();
  return [...ACTIVITIES, ...[1, 2, 3].flatMap((back) => yearOfActivities(thisYear - back))];
}

export async function routeGarmin(page, { status = 200 } = {}) {
  await page.route("**/api/garmin/**", (route) => {
    if (status !== 200) {
      return route.fulfill({ status, json: { error: "GARMIN_PERSONAL_API_KEY is not set." } });
    }
    const { pathname, searchParams } = new URL(route.request().url());
    if (!pathname.includes("/activitylist-service/")) return route.fulfill({ json: PROFILE });
    // The history, narrowed to whole days and sliced as Garmin pages it.
    const startDate = searchParams.get("startDate") ?? "0000-00-00";
    const endDate = searchParams.get("endDate") ?? "9999-99-99";
    const start = Number(searchParams.get("start"));
    const limit = Number(searchParams.get("limit"));
    const matching = history().filter(({ startTimeLocal }) => {
      const day = startTimeLocal.slice(0, 10);
      return day >= startDate && day <= endDate;
    });
    return route.fulfill({ json: matching.slice(start, start + limit) });
  });
}
