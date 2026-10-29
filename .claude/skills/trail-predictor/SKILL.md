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

| Field          | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fit`          | the model through the events: moving = c × effortKm^`exponent`, plus stops = r × moving² (`stopsAt30h`: the stops after 30 h on the move); `events`, `spreadPct` (how far events' clocks typically sit from it, ±), `fromEffortKm`–`toEffortKm` (the range it was calibrated on), `terminus`; null under 3 events                                                                                                                                                                                                            |
| `fit.grounds`  | `runnable` and `technical`: `events` and `pct`, the factor on the time on the move against untagged (mixed) courses; null for a ground with too few events. A plan line names its ground ("…, technical, 38:40:46"); the curve and the grid are mixed                                                                                                                                                                                                                                                                        |
| `fit.terminus` | the same events on Terminus's pace model, moving time only: `basePace` (m:ss /km), `basePaceSPerKm`, `basePaceByGround` (the base pace on each fitted ground), `fatigueCoefficient` (Terminus's presets: Low 0.001, Moderate 0.002, High 0.003, Very high 0.004), `spreadPct`                                                                                                                                                                                                                                                |
| `events[]`     | `date`, `name`, `km`, `climbM`, `effortKm`, `time` (the race clock), `moving`, `stops`, `speed` (effort-km per hour on the move), `why` (`result`: a past race of the plan with its official course and clock, `moving` and `stops` null unless the watch ran that course; `race`: Garmin's flag; `plan`: a plan race's date without a result; `ultra`: 100 effort-km or more), `ground`, `offPct` (time against the curve, + slower), `prepRunKm` (running km of the 12 weeks before; null where the history doesn't reach) |
| `training[]`   | long days (30 effort-km or more) that aren't events, and DNFs (`note` "DNF"): shown, never fitted                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `races[]`      | the plan's races ahead: `date`, `text`, `name`, `km`, `climbM`, `effortKm`, `ground`, `groundFitted` (false: its ground was too rare to fit, read as mixed), `time`, `moving`, `stops`, `low`–`high` (the spread around it), `within` (inside the calibrated range); `effortKm` null when the line gives no km or no D+                                                                                                                                                                                                      |
| `assumed`      | null with a curve. Without one (under 3 events, or events within twice each other's length): `anchor` (`date`, `name`, `effortKm`, `time`), the one event every time scales from, with `exponent` (assumed, not the runner's), `spreadPct` at the anchor's length and `perDoublingPct` added per doubling away; `grid`, `races` and `curve` then scale from it, `moving` and `stops` null                                                                                                                                    |
| `recentForm`   | `from`, `events`, `pct`: how far the events since `from` (24 months) sit from the curve, on average (− faster); null under 2 such events. `races[].formTime` and `grid[].formTime` are each time at that form, beside it, never instead                                                                                                                                                                                                                                                                                      |
| `grid[]`       | the model's `time`, `moving`, `stops`, `low`, `high` at 50, 100, 150, 200 and 300 effort-km; `curve[]` is the line the page draws                                                                                                                                                                                                                                                                                                                                                                                            |

Effort-km is ITRA's: one kilometre per 100 m of climb. `time` is the race clock (Garmin's
`elapsedDuration`, pauses included); `moving` the time on the move; `stops` the difference:
aid stations and sleep. The curve is fitted on moving time and the stops are added on top, so
a short race doesn't inherit an ultra's sleep.

If `fit` is null, there's no curve:

- With `assumed`, give its times, all of low trust: they scale from one race (`anchor`) with
  an assumed exponent, not the runner's. Say so in the first line, and name the events there
  are.
- Without `assumed` there's no event at all: say so.

Either way, go to **Ask for results** below before the write-up. A race ahead with `effortKm`
null: say which plan line needs its km and D+ ("Saintélyon 81 km 2100 m D+").

### Ask for results

The runner's past results replace the watch's guesses and the assumed exponent. Do this when
`fit` is null, and offer it when the events are thin (none between 50 and 150 effort-km) or
an outlier looks like a DNF or a run to the start.

1. Ask for their results: a link to their UTMB (utmb.world/…/runner/…) or ITRA runner page,
   or the results pasted. Races from before their Garmin count too.
2. With a link, fetch it. An ITRA page often comes back empty (it loads its results in the
   browser): ask for the UTMB page or a paste instead. Never log in or guess a page.
3. Draft one plan line per race, in the plan's format:
   `- YYYY-MM-DD <name> <km> km <D+> m D+, <h:mm:ss>` (or `…, DNF`). Leave out stop races
   (a fixed time), relays and team results. Add `runnable` or `technical` only when the
   runner says what the course is: a ground is the course, never how the race went.
4. Show the lines and ask the runner to check them against their results. A fetched page
   passes through a summarising model and can misread a digit: never write a line they
   haven't confirmed. Ask about any race the watch recorded differently (a DNF, a run to the
   start, a watch paused): the result line wins over the watch.
5. Once confirmed, add them under `## Races` in `data/plan.md`. Without that file, create
   it with the template's headings (`scripts/plan.example.md`) and none of its example lines:
   those would read as the runner's own. Run `npm run export` and start again from step 2.

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
- **Fitness now.** The curve weighs every event alike, old or new. `recentForm` says how far
  the last 24 months lean from it: quote its `pct` and `events`, and the `formTime` beside
  each prediction. On 2 or 3 events, call it a lean, not a measure. It is the races, not the
  training: a race months away will be run on the training still to come.
- **Readiness** (a race ahead whose `plan.races[].daysTo` is 21 or less, only then): the
  training going into it, beside the prediction, never changing it. Quote
  `lastWeek.load.ratio` and the last 3 `weeks[].ratio`, the latest non-null
  `months[].efficiency` against the months before it, and `lastWeek.hrv` (`belowBand`) and
  `lastWeek.restingHr` (`raised`). Read the ratio with the load-check skill's bands: under 0.6
  the week before a race is a taper, not a warning; over 1.3 that close to it, say so. HRV
  under band or resting HR raised: say the body is carrying something. Never turn any of it
  into a time or a percentage: no past event has calibrated how far readiness moves a finish.
  Any field null: say it's missing, don't infer it.
- **Preparation.** Set each event's `offPct` beside its `prepRunKm`, among events of a similar
  length: it may tell on the ultras and not on short races (it did on the first runner's: the
  ultras over 190 effort-km lined up, the shorter events didn't). Say whether the slowest and
  fastest events against the curve had the lightest and heaviest preparations, and whether
  another reason the runner gave fits better. It is shown, never fitted: a lean on a handful
  of events, never a time or a percentage of your own. For a race ahead, the preparation isn't
  run yet: say the time assumes one like the events', not which one.
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
(without a curve: **scaled from <anchor.name>** (<anchor.effortKm> effort-km in <anchor.time>), exponent <assumed.exponent> assumed, ±<spreadPct>% widening <perDoublingPct> points per doubling)

| Race | Effort-km | Predicted | On form | Range | Trust |
|------|-----------|-----------|---------|-------|-------|
(one row per race ahead; without one, the grid at 50, 100, 200, 300 effort-km)

**Reading it**
- <what anchors the curve, and the stretch it guesses>
- <the events furthest off and why>
- <form now against the curve>
- <readiness, only for a race 21 days away or less: load ratio, efficiency, HRV and resting HR going into it>

**To sharpen it**
<one line: the event or plan line that would firm the curve up>

**In Terminus** (with a curve only) base pace <fit.terminus.basePace>/km, fatigue <fit.terminus.fatigueCoefficient> (the preset it sits nearest), stops at the life bases as above
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
