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
partial), plus `lastWeek.load`, `lastWeek.hrv`, `lastWeek.restingHr`, `lastWeek.sleep` and
`lastWeek.notes` for the rolling 7 days to today:

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
| `restingHr`                              | `days`, `average` (bpm), `baseline` (median of the 28 days before), `raised`: days ≥ 5 bpm over it; null with no reading                            |
| `sleep`                                  | `nights`, `averageHours`, `averageScore` (Garmin's 0–100), `under7h`: nights under 7 h; null with no reading                                        |
| `notes`                                  | the runner's plan entries overlapping the week, "planned: recovery week", "health: cold"                                                            |

`lastWeek.hrv.days[]` has each night: `date`, `lastNightAvg`, `status` (Garmin's: `BALANCED`,
`UNBALANCED`, `LOW`…), `balancedLow`, `balancedUpper`. `coverage.hrvFirst` is the first night
with a reading: before it, `hrv` is null and HRV says nothing. Same for `restingHrFirst` and
`sleepFirst`.

`plan` (null without `data/plan.md`): `nextRace` (`date`, `text`, `daysTo`), `races[]`, and
`ignored`, the plan's lines the export couldn't read: name them so the runner can fix them.

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
| Resting HR raised    | `restingHr.raised` ≥ 3 days in a week        | a supporting sign only: resting HR responds to fatigue less reliably than HRV (Buchheit, _Front Physiol_ 2014)                    |
| Short sleep          | `sleep.under7h` ≥ 3 nights in a week         | under 7 h is below the adult range (Hirshkowitz et al., _Sleep Health_ 2015); a reason for HRV under band, not a load flag        |

The "10% rule" has little evidence behind it (Buist et al., _Am J Sports Med_ 2008): don't
cite it as a rule.

A week with `partial: true` has low totals and `kmChange` by construction: never flag its
volume, say it's partial. Its `ratio` is still a whole rolling 7 days and counts.

Split the flags in two:

- **Now:** the rolling 7 days (`lastWeek.load`) and the last two weeks of `weeks[]` that
  aren't partial. These decide the verdict.
- **Earlier:** flags 3 to 8 weeks back. Context only: they never set the verdict, but say how
  they lead to now ("the drop follows September's spike").

Read each flag with the week's `notes`: an abrupt drop on a `planned` or `health` week is
explained, so say what explains it instead of asking; a spike in a race week is the race.
With no plan, ask as below. Short sleep beside HRV under band on a light week points to
sleep, not training: say so.

## 4. Verdict

About now only, one of:

- **Steady:** no flag now, `lastWeek.load.ratio` 0.8–1.3.
- **Lighter:** `lastWeek.load.ratio` under 0.8 and no rising flag now (spike, sustained high
  ratio, volume jump). Not a warning: ask whether it was planned.
- **Watch:** one rising flag now with HRV in its band (or no HRV), a ratio of 1.3–1.5, or
  HRV under band now without rising load (illness, stress, sleep: say which the notes and
  `sleep` point to, else ask).
- **Overreaching risk:** a rising flag now **and** HRV under band now; or, with no HRV, a
  rising flag now plus resting HR raised now, or a load spike now plus a volume jump or a
  sustained high ratio now. Resting HR raised beside HRV under band makes it firmer: say so.

Abrupt drop and grey-zone drift never raise the verdict past Watch. A rising flag with HRV in
its band says the load is being absorbed so far: say so, it's the most useful line here.

Be honest about what the data can't show: soreness and how training feels, unless the plan's
`health` notes say it, and no HRV, resting HR or sleep before their `coverage` first dates. Overreaching is felt before it shows
in load: invite the runner to weigh how they feel.

## 5. Write

```
**Load check, <until>** — <Steady | Lighter | Watch | Overreaching risk>

Load ratio now <lastWeek.load.ratio> (7-day <acute> / 28-day <chronic> per week)
HRV last 7 nights: <average> ms, <belowBand> under / <aboveBand> over band (or "no reading")
Resting HR <average> bpm against <baseline>, <raised> days raised · Sleep <averageHours> h, <under7h> nights under 7 h
Next race: <text> in <daysTo> days (only with a plan)

| Week | km | h | Load | Ratio | Δ km | Easy % | HRV (under band) | Sleep < 7 h | Notes |
|------|----|---|------|-------|------|--------|------------------|-------------|-------|
(last 8 weeks, oldest first; a partial week marked "(so far)")

**Now**
- <flag>: <week, numbers, why it matters> (or "No flags.")

**Earlier** (only when there is one)
- <flag>: <week, numbers>, and how it leads to now

**What to do with it**
<one or two sentences: hold volume, add an easy week, nothing to change>
```

End with: _Based on Garmin's activity and wellness summaries; a warning light, not a diagnosis, and not
medical advice._

## 6. Publish the page

After the write-up, the same reading as a page in Ledger's style (`scripts/reports/load-check.html`).
The page takes its numbers from `metrics.json` itself: you write only words.

1. Write `data/reports/load-check.notes.json` (shape below). Text may quote numbers from
   `metrics.json`, as the write-up does; never one of your own.
2. Run `npm run report -- load-check`. It checks the notes, writes `data/reports/load-check.html`
   and prints the page's link, if it has one. On an error, fix the notes it names and run it
   again.
3. Publish `data/reports/load-check.html` with the Artifact tool. With a link: read that
   artifact first, then publish with it as `url`, so the page updates in place. Without one:
   publish it new (icon `chart`), then record its link with
   `npm run report -- load-check --url <link>`.
4. End the reply with the link. The page uploads the account's data to claude.ai, private
   until the runner shares it: never share it yourself.

```json
{
  "verdict": "Steady | Lighter | Watch | Overreaching risk",
  "takeaway": "one sentence: the verdict and why",
  "now": [{ "flag": "Load spike", "text": "week, numbers, why it matters" }],
  "earlier": [{ "flag": "…", "text": "…, and how it leads to now" }],
  "action": "the What to do with it sentence"
}
```

`now` empty shows "No flags".
