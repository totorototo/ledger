---
name: weekly-review
description: Review the runner's last 7 days of training against the 4 weeks before them — volume, load, intensity, notable sessions, and one or two takeaways. Use when asked how the week went, for a weekly review or recap, or "how was my training this week".
---

# Weekly review

Every number comes from `data/metrics.json`, written by `npm run export` from the same sums
the app shows (`src/utils/insights.js`). **Never compute a figure yourself**: quote it, or say
it isn't there. Your job is to interpret.

## 1. Get fresh numbers

1. Read `data/metrics.json`. If it's missing, its `until` isn't today, or its `version` isn't
   `1`, run `npm run export` (it needs `GARMIN_PERSONAL_API_KEY` in `.env`; if that fails, say
   so and stop, never guess numbers).
2. If `empty` is true, say there are no activities and stop.

## 2. Read

All under `lastWeek` (the 7 days `from`–`until`, every sport, Garmin's faults screened out):

| Field                   | Meaning                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `volume`                | `count`, `km`, `hours`, `climbM`, `runs`, `runKm`, `load` (Garmin's training load, summed)                                                                                                        |
| `previous4WeeksAverage` | the same fields, averaged per week over the 28 days before `from` (only the weeks the history covers)                                                                                             |
| `weeksCovered`          | how many of those 4 weeks the history covers; under 4 on a new account: say the average rests on less                                                                                             |
| `change`                | `km`, `hours`, `load` as "+12%", "−8%", "±0%"; null when the 4 weeks were empty                                                                                                                   |
| `load`                  | `acute` (7-day load), `chronic` (28-day load per week), `ratio` (acute / chronic)                                                                                                                 |
| `intensity`             | `hours` with heart rate, and `easyPct` / `moderatePct` / `hardPct` as % of that time (Z1–2 / Z3 / Z4–5)                                                                                           |
| `sessions[]`            | `date`, `name`, `type`, `km`, `hours`, `climbM`, `averageHR`, `load`, `easy` (≥ 80% of HR time in Z1–2), `effect` (Garmin's label: `TEMPO`, `RECOVERY`…), `aerobicTE` / `anaerobicTE` (0–5)       |
| `effects`               | sessions per `effect` label                                                                                                                                                                       |
| `hrv`                   | `nights`, `average` (ms), `belowBand` / `aboveBand` against the runner's own balanced band, and `days[]` (`date`, `lastNightAvg`, `status`, `balancedLow`, `balancedUpper`); null with no reading |

Also check `coverage` (how many activities carry load or heart rate) and `faults` dated in
the week: mention them if they change the picture.

## 3. Interpret

- **Volume:** say whether the week was bigger, smaller or about the same, by `change`. Treat
  ±10% as "about the same".
- **Load ratio:** about 0.8–1.3 is steady; above 1.5 the week rose much faster than recent
  training (Gabbett, _Br J Sports Med_ 2016, "The training–injury prevention paradox"). Under
  0.8 is a lighter week, fine if planned (taper, recovery, illness).
- **Intensity:** endurance athletes typically spend about 80% of their time easy (Seiler,
  _Int J Sports Physiol Perform_ 2010). Point out a week far below that (a lot of Z3 "grey
  zone") without calling it wrong: one week is one week.
- **HRV:** nights in the band mean the week was absorbed; three or more under it, with a
  heavier week, mean it wasn't yet (Plews et al., _Sports Med_ 2013). Under band on a light
  week points away from training (illness, stress, sleep): say that, don't guess which.
- **Session labels:** set `effects` beside the intensity split. A week of mostly `TEMPO` or
  `THRESHOLD` labels is the grey zone by another name; `RECOVERY` and `AEROBIC_BASE` are the
  easy end.
- **Notable sessions:** the longest by time, the biggest climb, the highest load, any hard
  session (`easy: false`). Two or three at most.
- Takeaways: one or two, concrete, about the coming week ("keep next week near this
  volume", "the long run carried half the week's load"). No training plans.

## 4. Write

```
**Week of <from> – <until>**

<runKm> km running · <hours> h · <climbM> m climb · <count> sessions
vs 4-week average: km <change.km> · time <change.hours> · load <change.load>
Load ratio <ratio> (7-day <acute> / 28-day <chronic> per week)
Intensity: <easyPct>% easy · <moderatePct>% moderate · <hardPct>% hard
Sessions: <effects, as "2 tempo · 1 recovery">
HRV: <average> ms, <belowBand> nights under / <aboveBand> over band (or "no reading")

**Stand-out sessions**
- <date> <name> (<effect>): <why it stands out, with its numbers>

**Takeaways**
1. …
```

Then one line of caveats when they apply: activities without load or heart rate, screened
faults. End with: _Based on Garmin's activity summaries; not medical advice._
