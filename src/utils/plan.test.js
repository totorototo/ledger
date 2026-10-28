import { parsePlan } from "./plan.js";

describe("parsePlan", () => {
  it("reads dated lines and ranges under their heading, by date", () => {
    const { entries, ignored } = parsePlan(`# Plan

Some prose, not a list.

## Races
- 2026-12-05 Saintélyon 81 km, A race

## Planned
- 2026-11-16..2026-11-22 recovery week

## Health
- 2026-10-12   sore left calf
`);
    expect(entries).toEqual([
      { kind: "health", from: "2026-10-12", to: "2026-10-12", text: "sore left calf" },
      { kind: "planned", from: "2026-11-16", to: "2026-11-22", text: "recovery week" },
      { kind: "race", from: "2026-12-05", to: "2026-12-05", text: "Saintélyon 81 km, A race" },
    ]);
    expect(ignored).toEqual([]);
  });

  it("says which bullets it couldn't read rather than dropping them", () => {
    const { entries, ignored } = parsePlan(`- 2026-12-05 before any heading
## Races
- sometime in spring
## Notes
- 2026-01-01 under an unknown heading
`);
    expect(entries).toEqual([]);
    expect(ignored).toEqual([
      "- 2026-12-05 before any heading",
      "- sometime in spring",
      "- 2026-01-01 under an unknown heading",
    ]);
  });
});
