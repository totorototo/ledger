---
name: load-check
description: Check the runner's recent training load for warning signs — load-ratio spikes, sudden jumps in weekly volume, easy vs hard balance — and say whether it looks like overreaching. Use when asked "am I overdoing it", "is my load OK", about injury risk, ramp rate, or acute:chronic ratio.
---

# Load check

Every number comes from `data/metrics.json`, written by `npm run export` from the same sums
the app shows (`src/utils/insights.js`). **Never compute a figure yourself**: quote it, or say
it isn't there. Your job is to interpret.

## 1. Get fresh numbers

1. Read `data/metrics.json`. If it's missing, its `until` isn't today, or its `version` isn't
   `1`, run `npm run export` (it needs `GARMIN_PERSONAL_API_KEY` in `.env`; if that fails, say
   so and stop, never guess numbers).
2. If `empty` is true, say there are no activities and stop.

## 2. Read

The last 8 entries of `weeks[]` (Monday-start weeks, the last one ends at `until` and may be
partial), plus `lastWeek.load` and `lastWeek.hrv` for the rolling 7 days to today:

| Field                                    | Meaning                                                                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `week`                                   | the Monday it starts                                                                                                                                |
| `km`, `hours`, `climbM`, `runKm`, `load` | the week's totals (every sport; `runKm` running only)                                                                                               |
| `kmChange`                               | `km` against the week before, "+35%"                                                                                                                |
| `acute`, `chronic`, `ratio`              | at the week's end: 7-day load, 28-day load per week, their ratio                                                                                    |
| `intensity`                              | `easyPct` / `moderatePct` / `hardPct` % of heart-rate time (Z1–2 / Z3 / Z4–5)                                                                       |
| `partial`                                | true when the week ends after `until`: its totals are of the days so far                                                                            |
| `hrv`                                    | `nights`, `average` (ms), `belowBand` / `aboveBand`: nights outside the balanced band of the runner's own baseline (Garmin's); null with no reading |
| `effects`                                | sessions per Garmin training-effect label (`TEMPO`, `RECOVERY`…)                                                                                    |

`lastWeek.hrv.days[]` has each night: `date`, `lastNightAvg`, `status` (Garmin's: `BALANCED`,
`UNBALANCED`, `LOW`…), `balancedLow`, `balancedUpper`. `coverage.hrvFirst` is the first night
with a reading: before it, `hrv` is null and HRV says nothing.

Check `coverage.withLoad` against `coverage.kept`: if many activities have no load, the ratio
understates the real load: say so.

## 3. Flags

Raise a flag for each that holds, quoting the week and the numbers:

| Flag                 | Rule                                         | Source                                                                                                                            |
| -------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Load spike           | `ratio` > 1.5                                | Gabbett, _Br J Sports Med_ 2016                                                                                                   |
| Sustained high ratio | `ratio` > 1.3 two weeks running              | same; the "sweet spot" is about 0.8–1.3                                                                                           |
| Volume jump          | `kmChange` > +30% on a week of more than 2 h | Nielsen et al., _J Orthop Sports Phys Ther_ 2014: novice runners who raised weekly distance more than 30% were injured more often |
| Grey-zone drift      | `intensity.moderatePct` > 30% for 3+ weeks   | Seiler 2010: ~80% easy is the norm in endurance sport                                                                             |
| Abrupt drop          | `ratio` < 0.6                                | not a risk in itself: ask whether it was planned (illness, injury, taper)                                                         |
| HRV under band       | `hrv.belowBand` ≥ 3 nights in a week         | Plews et al., _Sports Med_ 2013: HRV falling under the athlete's own baseline is the sign the load isn't being absorbed           |

The "10% rule" has little evidence behind it (Buist et al., _Am J Sports Med_ 2008): don't
cite it as a rule.

A week with `partial: true` has low totals and `kmChange` by construction: never flag its
volume, say it's partial. Its `ratio` is still a whole rolling 7 days and counts.

Split the flags in two:

- **Now:** the rolling 7 days (`lastWeek.load`) and the last two weeks of `weeks[]` that
  aren't partial. These decide the verdict.
- **Earlier:** flags 3 to 8 weeks back. Context only: they never set the verdict, but say how
  they lead to now ("the drop follows September's spike").

## 4. Verdict

About now only, one of:

- **Steady:** no flag now, `lastWeek.load.ratio` 0.8–1.3.
- **Lighter:** `lastWeek.load.ratio` under 0.8 and no rising flag now (spike, sustained high
  ratio, volume jump). Not a warning: ask whether it was planned.
- **Watch:** one rising flag now with HRV in its band (or no HRV), a ratio of 1.3–1.5, or
  HRV under band now without rising load (illness, stress, sleep: ask).
- **Overreaching risk:** a rising flag now **and** HRV under band now; or, with no HRV, a
  load spike now plus a volume jump or a sustained high ratio now.

Abrupt drop and grey-zone drift never raise the verdict past Watch. A rising flag with HRV in
its band says the load is being absorbed so far: say so, it's the most useful line here.

Be honest about what the data can't show: no sleep, resting heart rate or soreness (not
exported yet), and no HRV before `coverage.hrvFirst`. Overreaching is felt before it shows
in load: invite the runner to weigh how they feel.

## 5. Write

```
**Load check, <until>** — <Steady | Lighter | Watch | Overreaching risk>

Load ratio now <lastWeek.load.ratio> (7-day <acute> / 28-day <chronic> per week)
HRV last 7 nights: <average> ms, <belowBand> under / <aboveBand> over band (or "no reading")

| Week | km | h | Load | Ratio | Δ km | Easy % | HRV (under band) |
|------|----|---|------|-------|------|--------|------------------|
(last 8 weeks, oldest first; a partial week marked "(so far)")

**Now**
- <flag>: <week, numbers, why it matters> (or "No flags.")

**Earlier** (only when there is one)
- <flag>: <week, numbers>, and how it leads to now

**What to do with it**
<one or two sentences: hold volume, add an easy week, nothing to change>
```

End with: _Based on Garmin's activity summaries; a warning light, not a diagnosis, and not
medical advice._
