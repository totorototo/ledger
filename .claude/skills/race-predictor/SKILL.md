---
name: race-predictor
description: Predict the runner's race times for 5 km, 10 km, half marathon and marathon from their best efforts of the last 12 weeks (Daniels' VDOT), say how far to trust each one, and how the score has moved month by month. Use when asked "what could I run", for a race time prediction, a goal time, a pacing target, or "am I getting faster".
---

# Race predictor

Every number comes from `data/metrics.json`, written by `npm run export` from the same sums
the app shows (`src/utils/insights.js`, `src/utils/race.js`). **Never compute a figure
yourself**: no time, pace, percentage or adjustment of your own. Quote it, or say it isn't
there. Your job is to interpret.

## 1. Get fresh numbers

1. Read `data/metrics.json`. If it's missing, its `until` isn't today, its `version` isn't
   `1`, or it has no `race`, run `npm run export` (it needs `GARMIN_PERSONAL_API_KEY` in
   `.env`; if that fails, say so and stop, never guess numbers).
2. If `empty` is true, say there are no activities and stop.

## 2. Read

`race`, for the 12 weeks `from`–`until`:

| Field                                         | Meaning                                                                                                                                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `effort`                                      | the best effort: `date`, `name`, `distance` (`5k`, `10k`, `half`, `marathon`), `time`, `pace`, `vdot`, and the run it sits in: `runKm`, `averageHR`, `easy`, `effect` (Garmin's label) |
| `predictions[]`                               | `distance`, `time`, `pace`: what `effort`'s score gives at each distance                                                                                                               |
| `bestByDistance[]`                            | the best effort at each distance, same fields as `effort`                                                                                                                              |
| `top[]`                                       | the 5 best efforts, best first                                                                                                                                                         |
| `runs`, `runsWithSplits`                      | runs in the window, and how many carry Garmin's splits                                                                                                                                 |
| `longestRunKm`, `runsOver25Km`, `weeklyRunKm` | the long runs and the weekly running volume (12-week average) a half or a marathon rests on                                                                                            |

An effort is Garmin's fastest stretch of that distance **inside** a run, not the run itself:
`runKm` is the whole run's length; `easy`, `effect` and `averageHR` are the whole run's too.

`months[].bestVdot`: each month's best score; null in a month without a split (Garmin has
them from 2024 on). `plan.nextRace` and `plan.races[]` (null without `data/plan.md`).

If `effort` is null, say no run of the last 12 weeks carries a split and stop.

## 3. How far to trust each prediction

VDOT (Daniels & Gilbert, _Oxygen Power_, 1979; Daniels, _Daniels' Running Formula_) assumes
the effort was **all out**, on a **flat road**, and that the runner has **trained for the
distance** predicted. Check each:

- **All out?** Training splits are rarely races. `effect` `VO2MAX`, `LACTATE_THRESHOLD` or
  `ANAEROBIC_CAPACITY`, or a `name` that reads as a race: close to a race effort. `TEMPO`:
  probably a little held back. `AEROBIC_BASE`, `RECOVERY` or `easy: true`: well short of all
  out. Short of all out, every prediction is a **floor**: the runner could race faster. Say
  so; don't say by how much.
- **Distance from the effort.** The further a prediction sits from `effort.distance`, the
  less it holds: from a 5k, the 10k is close, the half fair, the marathon a long stretch.
- **Trained for it?** Predictions from short efforts run too fast over the marathon for
  runners on low volume (Vickers & Vertosick, _BMC Sports Sci Med Rehabil_ 2016). Read the
  half against `longestRunKm` and the marathon against `weeklyRunKm` and `runsOver25Km`:
  under about 50 km a week, or no run over 25 km in the window, call the marathon time the
  best case, not a target. Under about 30 km a week, the same for the half.
- **Speed against endurance.** Compare `bestByDistance`: a 10k scoring well under the 5k
  when both were hard runs says endurance lags speed, so the longer predictions run fast.
  Leave out efforts from runs far longer than the split (an ultra's half split) or easy
  ones: they say nothing about racing that distance.
- **Outlier.** If `top[0]` scores well over `top[1]` and the others and sits alone in its
  run, it may be a GPS fault: say so and name `top[1]` as the safer reference.
- **Terrain.** Splits on hilly or trail runs are slower than the runner's flat pace, so they
  rarely set `effort`; but a trail or ultra race in the plan is out of VDOT's reach
  (climb, terrain, hours): say no road prediction applies to it.

## 4. Trend

The last 12 `months[].bestVdot`, oldest first. A month without a hard run reads low, so
read the trend over several months, not one; name the best month and how far `effort.vdot`
sits from it, in VDOT points as the numbers stand.

## 5. Write

```
**Race predictor, <until>** — from <effort.distance> in <effort.time> on <effort.date> (VDOT <effort.vdot>, <effect>)

| Distance | Time | Pace | Trust |
|----------|------|------|-------|
| 5 km | … | … | <high / fair / low, a few words why> |
(one row per prediction)

Next race: <plan.nextRace.text> in <daysTo> days: <the matching prediction, or "trail/ultra: no road prediction applies"> (only with a plan)

**Reading it**
- <all out or not, and what that makes the times: estimate or floor>
- <half and marathon against the volume and long runs, quoting them>
- <speed against endurance, if bestByDistance says something>

**Trend** <months and their scores, in one or two lines>

**To sharpen it**
<one line: the effort that would make the prediction firmer, e.g. a 5 km or 10 km time trial or race>
```

End with: _Predicted from Garmin's fastest splits with Daniels' VDOT tables, assuming a flat road
race run all out and training for the distance; an estimate, not a promise._
