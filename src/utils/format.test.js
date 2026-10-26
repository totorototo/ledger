import { describe, expect, it } from "vitest";

import {
  formatDistance,
  formatDuration,
  formatGainTotal,
  formatKm,
  formatKmTotal,
  formatTypeKey,
} from "./format.js";

describe("format", () => {
  it("writes distances and climbs", () => {
    expect(formatKm(21_100)).toBe("21.1 km");
    expect(formatKm(undefined)).toBe("–");
  });

  it("groups a year's totals", () => {
    expect(formatKmTotal(1_234_567)).toBe("1,235 km");
    expect(formatGainTotal(45_210.6)).toBe("45,211 m D+");
    expect(formatKmTotal(null)).toBe("–");
    expect(formatDistance(29_140)).toBe("29.1 km");
    expect(formatDistance(1_260_000)).toBe("1,260 km");
  });

  it("writes durations as the suite does", () => {
    expect(formatDuration(5400)).toBe("1h30");
    expect(formatDuration(600)).toBe("10 min");
  });

  it("names an activity type", () => {
    expect(formatTypeKey("trail_running")).toBe("Trail running");
    expect(formatTypeKey(undefined)).toBe("Activity");
  });
});
