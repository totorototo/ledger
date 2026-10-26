// Synthetic Garmin answers, in the shape the Personal API returns (field names checked against
// a real account, values made up). Never paste a real account's data here.

export const profile = {
  displayName: "runner",
  measurementSystem: "metric",
  timeZone: "Europe/Paris",
};

export const activity = (overrides = {}) => ({
  activityId: 1,
  activityName: "Morning trail",
  startTimeLocal: "2026-10-20 07:30:00",
  activityType: { typeId: 6, typeKey: "trail_running", parentTypeId: 1 },
  distance: 21_100,
  duration: 9000,
  elevationGain: 1250,
  averageHR: 148,
  ...overrides,
});
