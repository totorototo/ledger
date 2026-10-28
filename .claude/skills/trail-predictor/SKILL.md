---
name: trail-predictor
description: Predict the runner's trail and ultra finish times from their own past events (a power curve on effort-km, km + D+ / 100, for the time on the move, plus stops), for the races ahead in their plan and as a what-if table, say how far to trust each, and give the same fit as Terminus's pace settings. Use when asked about a trail or ultra goal time, "how long will this race take me", a trail race with climb, or how their ultras compare.
---

# Trail predictor

Every number comes from `data/metrics.json`, written by `npm run export` from the same sums
the app shows (`src/utils/insights.js`, `src/utils/trail.js`). **Never compute a figure
yourself**: no time, ratio, percentage or adjustment of your own. Quote it, or say it isn't
there. Your job is to interpret.

For a flat road race (5 km to marathon), the race-predictor skill answers better: say so.

## 1. Get fresh numbers

1. Read `data/metrics.json`. If it's missing, its `until` isn't today, its `version` isn't
   `1`, or it has no `trail`, run `npm run export` (it needs `GARMIN_PERSONAL_API_KEY` in
   `.env`; if that fails, say so and stop, never guess numbers).
2. If `empty` is true, say there are no activities and stop.

## 2. Read

`trail`, over the 3 years `from`–`until`:

| Field          | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fit`          | the model through the events: moving = c × effortKm^`exponent`, plus stops = r × moving² (`stopsAt30h`: the stops after 30 h on the move); `events`, `spreadPct` (how far events' clocks typically sit from it, ±), `fromEffortKm`–`toEffortKm` (the range it was calibrated on), `terminus`; null under 3 events                                                                                                                     |
| `fit.grounds`  | `runnable` and `technical`: `events` and `pct`, the factor on the time on the move against untagged (mixed) courses; null for a ground with too few events. A plan line names its ground ("…, technical, 38:40:46"); the curve and the grid are mixed                                                                                                                                                                                 |
| `fit.terminus` | the same events on Terminus's pace model, moving time only: `basePace` (m:ss /km), `basePaceSPerKm`, `basePaceByGround` (the base pace on each fitted ground), `fatigueCoefficient` (Terminus's presets: Low 0.001, Moderate 0.002, High 0.003, Very high 0.004), `spreadPct`                                                                                                                                                         |
| `events[]`     | `date`, `name`, `km`, `climbM`, `effortKm`, `time` (the race clock), `moving`, `stops`, `speed` (effort-km per hour on the move), `why` (`result`: a past race of the plan with its official course and clock, `moving` and `stops` null unless the watch ran that course; `race`: Garmin's flag; `plan`: a plan race's date without a result; `ultra`: 100 effort-km or more), `ground`, `offPct` (time against the curve, + slower) |
| `training[]`   | long days (30 effort-km or more) that aren't events, and DNFs (`note` "DNF"): shown, never fitted                                                                                                                                                                                                                                                                                                                                     |
| `races[]`      | the plan's races ahead: `date`, `text`, `name`, `km`, `climbM`, `effortKm`, `ground`, `groundFitted` (false: its ground was too rare to fit, read as mixed), `time`, `moving`, `stops`, `low`–`high` (the spread around it), `within` (inside the calibrated range); `effortKm` null when the line gives no km or no D+                                                                                                               |
| `grid[]`       | the model's `time`, `moving`, `stops`, `low`, `high` at 50, 100, 150, 200 and 300 effort-km; `curve[]` is the line the page draws                                                                                                                                                                                                                                                                                                     |

Effort-km is ITRA's: one kilometre per 100 m of climb. `time` is the race clock (Garmin's
`elapsedDuration`, pauses included); `moving` the time on the move; `stops` the difference:
aid stations and sleep. The curve is fitted on moving time and the stops are added on top, so
a short race doesn't inherit an ultra's sleep.

If `fit` is null, say there aren't 3 events in 3 years to draw a curve, name the events there
are, and stop. A race ahead with `effortKm` null: say which plan line needs its km and D+
("Saintélyon 81 km 2100 m D+").

## 3. How far to trust each time

The curve is Riegel's power law (_Am Sci_ 1981) fitted on the runner's own events: their own
fatigue exponent, not road running's 1.06. Check:

- **Inside or outside.** A race `within` the calibrated range is read off the curve between
  real events; outside it, the curve extends its shape: say it's a guess.
- **What anchors it.** Look at where the events sit. A stretch of effort-km with no event (all
  events long, one short) rests on the curve's shape: name the stretch and the event that
  anchors each end.
- **Spread.** `spreadPct` is how far a race lands from the curve on a normal day: the
  `low`–`high` range is that, not a guarantee. Name the event furthest off each way
  (`offPct`) and what sets it apart if its name or numbers say (a night race, a flatter or
  steeper course).
- **Terrain beyond the climb.** Effort-km knows distance and climb, not the ground,
  altitude, heat, night or the time limit's pressure. `fit.grounds` measures the ground the
  runner tagged: quote its factor and its number of events, and say when it is small against
  `spreadPct` (the tags then explain little of the spread). A ground is tagged by the course,
  never by how the race went: suggest a tag only from what the course is. Set a race ahead
  beside the event that looks most like it.
- **Fitness now.** The curve averages 3 years. If the latest events sit under or over it,
  form has moved: say which way.
- **Stops.** An event far off the curve may be off on its stops, not its running: compare its
  `moving` and `stops` with another event of its length (a night's sleep, a long aid station).
  A race ahead's `stops` is the runner's usual, not a plan.
- **Training days** sit slower than the curve, as they should: don't read them as form.
- **Results over the watch.** A `result` event is the official sheet; a plan line with
  "DNF" takes its day out. Events of another `why` are guessed from the watch, of the last 3
  years only: a DNF recorded to the drop or a run with its approach can pass as a race. If one
  looks like it (an outlier), say so and suggest listing that race's result in `data/plan.md`
  (`- 2025-11-29 Night Trail 80 km 2000 m D+, 13:45:00`, or `…, DNF`): the runner's ITRA or
  UTMB page has them all.

## 4. Write

```
**Trail predictor, <until>** — curve through <fit.events> events, exponent <exponent>, ±<spreadPct>%

| Race | Effort-km | Predicted | Range | Trust |
|------|-----------|-----------|-------|-------|
(one row per race ahead; without one, the grid at 50, 100, 200, 300 effort-km)

**Reading it**
- <what anchors the curve, and the stretch it guesses>
- <the events furthest off and why>
- <form now against the curve>

**To sharpen it**
<one line: the event or plan line that would firm the curve up>

**In Terminus** base pace <fit.terminus.basePace>/km, fatigue <fit.terminus.fatigueCoefficient> (the preset it sits nearest), stops at the life bases as above
```

Terminus applies its own night slowdown and weather on top; the fit's events already carry
their nights, so say a plan from these settings errs a little slow.

End with: _Predicted from your own events with a power curve on effort-km; terrain, weather,
night and aid stations move a trail time far more than a road one; an estimate, not a
promise._

## 5. Publish the page

After the write-up, the same reading as a page in Ledger's style
(`scripts/reports/trail-predictor.html`). The page takes its numbers from `metrics.json`
itself: you write only words.

1. Write `data/reports/trail-predictor.notes.json` (shape below). Text may quote numbers from
   `metrics.json`, as the write-up does; never one of your own.
2. Run `npm run report -- trail-predictor`. It checks the notes, writes
   `data/reports/trail-predictor.html` and prints the page's link, if it has one. On an
   error, fix the notes it names and run it again.
3. Publish `data/reports/trail-predictor.html` with the Artifact tool. With a link: read that
   artifact first, then publish with it as `url`, so the page updates in place. Without one:
   publish it new (icon `chart`), then record its link with
   `npm run report -- trail-predictor --url <link>`.
4. End the reply with the link. The page uploads the account's data to claude.ai, private
   until the runner shares it: never share it yourself.

```json
{
  "headline": "two to six words: the answer (\"Saintélyon in about 13h\", \"100 effort-km in 12h\")",
  "takeaway": "one sentence: the prediction and how far to trust it",
  "reading": ["the Reading it bullets"],
  "sharpen": "the To sharpen it line, or null"
}
```
