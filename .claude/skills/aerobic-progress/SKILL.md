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
| `cadence`        | median steps per minute over **every** run of the month (not only easy ones)                                                                             |
| `power`          | median average power (W) over every run with power; `runsWithPower` says how many                                                                        |
| `hrv`            | the month's nights: `average` (ms), `belowBand` / `aboveBand` against the runner's own band; null with no reading                                        |
| `restingHr`      | the month's `average` resting heart rate (bpm); null with no reading                                                                                     |
| `sleep`          | the month's `averageHours` and `under7h` nights; null with no reading                                                                                    |

Also `coverage.runsWithHR` and `coverage.runsWithZones` against `coverage.runs`: runs without
zones can't be classed as easy, so they never count.

`zones` is the running zones as set **now** (`floors`: each zone's lowest bpm, `maxHR`,
`method`): "easy" is under `floors[2]` bpm today. Garmin keeps no history of them, and each
run was classed with the zones of its day.

`plan.races` (with a plan): races ahead, for context.

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
- **Where efficiency has gaps** (no easy runs), `cadence` and `power` carry on, but they are
  over every run: a month of harder running has higher power for that reason alone. Read
  them with `intensity`, and as context, never as a fitness verdict by themselves. Power
  before mid-2023 rests on few runs (`runsWithPower`).
- **Terrain moves cadence most:** long trail runs and ultras include walking, so their
  cadence (and power) sits far under road running's. A month of a few long trail runs (high
  `runKm` over few `runs`) isn't comparable with a road month: say so rather than call it a
  drop.
- **Zones:** if the runner says their max HR or zones changed, months before the change
  were classed as easy against other bounds: name the change before comparing across it.
- **Resting HR over months:** a slow fall in the monthly `average` is a classic sign of
  aerobic fitness; month-to-month moves of 1–2 bpm are noise. It starts at
  `coverage.restingHrFirst`. A month of short sleep (`under7h` high) can hold it up.
- **HRV over months:** a monthly `average` rising with fewer nights under band is the
  recovery side of getting fitter; it starts at `coverage.hrvFirst`.
- **Context:** set efficiency next to `runKm`. A rise after a block of steady volume is the
  classic aerobic-base signal; a rise while volume collapsed may be fewer, flatter, cooler runs.

## 4. Write

```
**Aerobic progress, <first month shown> – <until's month>**

Latest: <efficiency> m/min per beat in <month> (<easyRuns> easy runs)
Same month last year: <efficiency or "no data"> → <better / worse / about the same>

| Month | Efficiency | Easy runs | Run km | Cadence | Power | HRV | Resting HR |
|-------|------------|-----------|--------|---------|-------|-----|------------|
(last 12 months, gaps shown as —)

**Trend**
<2–4 sentences: direction, seasonality, what it rests on>

**Worth trying** (optional, one line)
```

End with: _Based on Garmin's activity and wellness summaries; heat, terrain and sensor accuracy move these
numbers; not medical advice._

## 5. Publish the page

After the write-up, the same reading as a page in Ledger's style (`scripts/reports/aerobic-progress.html`).
The page takes its numbers from `metrics.json` itself: you write only words.

1. Write `data/reports/aerobic-progress.notes.json` (shape below). Text may quote numbers from
   `metrics.json`, as the write-up does; never one of your own.
2. Run `npm run report -- aerobic-progress`. It checks the notes, writes `data/reports/aerobic-progress.html`
   and prints the page's link, if it has one. On an error, fix the notes it names and run it
   again.
3. Publish `data/reports/aerobic-progress.html` with the Artifact tool. With a link: read that
   artifact first, then publish with it as `url`, so the page updates in place. Without one:
   publish it new (icon `chart`), then record its link with
   `npm run report -- aerobic-progress --url <link>`.
4. End the reply with the link. The page uploads the account's data to claude.ai, private
   until the runner shares it: never share it yourself.

```json
{
  "headline": "two to four words: the state of the trend (\"Up on last year\", \"Unread since July\")",
  "takeaway": "one sentence: latest against the same month a year earlier",
  "trend": ["the Trend sentences, one per item"],
  "worthTrying": "the Worth trying line, or null"
}
```
