---
name: aerobic-progress
description: Show how the runner's aerobic fitness is trending through easy-run efficiency (grade-adjusted speed per heartbeat) month by month, season against season and year against year. Use when asked "am I getting fitter", about aerobic base, efficiency, heart rate at a given pace, or progress over months.
---

# Aerobic progress

Every number comes from `data/metrics.json`, written by `npm run export` from the same sums
the app shows (`src/utils/insights.js`, `metrics.js`'s `efficiency`). **Never compute a figure
yourself**: quote it, or say it isn't there. Your job is to interpret.

## 1. Get fresh numbers

1. Read `data/metrics.json`. If it's missing, its `until` isn't today, or its `version` isn't
   `1`, run `npm run export` (it needs `GARMIN_PERSONAL_API_KEY` in `.env`; if that fails, say
   so and stop, never guess numbers).
2. If `empty` is true, say there are no activities and stop.

## 2. Read

`months[]`, one entry per calendar month since `first`:

| Field            | Meaning                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `month`          | "YYYY-MM"                                                                                                                                                |
| `efficiency`     | median metres per minute (grade adjusted when the watch has it) per heartbeat, over the month's easy runs; **null under 3 easy runs**: a gap, not a zero |
| `easyRuns`       | how many easy runs (≥ 80% of HR time in Z1–2) that median rests on                                                                                       |
| `runKm`, `hours` | the month's volume, to set efficiency against                                                                                                            |
| `intensity`      | `easyPct` / `moderatePct` / `hardPct` % of heart-rate time                                                                                               |

Also `coverage.runsWithHR` and `coverage.runsWithZones` against `coverage.runs`: runs without
zones can't be classed as easy, so they never count.

## 3. Interpret

- **Higher is better:** more ground covered per heartbeat at easy effort. This is the
  "efficiency factor" idea (speed ÷ heart rate) used in endurance coaching; the app's version
  is grade-adjusted and kept to easy runs so terrain and effort move it less.
- **Compare like with like.** Heat, humidity and altitude raise heart rate at the same speed,
  so a summer dip is expected. Put each recent month beside **the same month a year earlier**
  before calling a trend.
- **Size of a change:** month-to-month moves under about 3% are noise; a change that holds
  for three months or more, or a year-on-year change above about 5%, is worth naming. These
  thresholds are a reading guide for this metric, not published cut-offs: say so if asked.
- **Thin months:** a month on 3–4 easy runs is weak evidence. Say how many runs a claim rests on.
- **Context:** set efficiency next to `runKm`. A rise after a block of steady volume is the
  classic aerobic-base signal; a rise while volume collapsed may be fewer, flatter, cooler runs.

## 4. Write

```
**Aerobic progress, <first month shown> – <until's month>**

Latest: <efficiency> m/min per beat in <month> (<easyRuns> easy runs)
Same month last year: <efficiency or "no data"> → <better / worse / about the same>

| Month | Efficiency | Easy runs | Run km |
|-------|------------|-----------|--------|
(last 12 months, gaps shown as —)

**Trend**
<2–4 sentences: direction, seasonality, what it rests on>

**Worth trying** (optional, one line)
```

End with: _Based on Garmin's activity summaries; heat, terrain and sensor accuracy move these
numbers; not medical advice._
