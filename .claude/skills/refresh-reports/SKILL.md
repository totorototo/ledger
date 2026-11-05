---
name: refresh-reports
description: Rerun every report on fresh data and republish each page to its existing link. Run by the Monday scheduled task in Claude Desktop, or by hand with /refresh-reports.
disable-model-invocation: true
---

# Refresh reports

This run is usually unattended: nobody can answer a question, so never wait for one. Where a
skill says to ask the runner, put the question in the page's notes and carry on.

## 1. Check the data

Run `npm run export` first, every time. If it fails, publish nothing and end with the last line
below: the published pages stay as the last good ones. Then read `until` and `version` from
`data/metrics.json` (`jq '{until, version}' data/metrics.json`): if `until` isn't today or
`version` isn't 1, stop the same way.

## 2. The pages with a skill

Run each of these skills in full, in this order, through to publishing its page: `weekly-review`,
`load-check`, `race-predictor`, `aerobic-progress`, `trail-predictor`.

- Always write new notes from today's numbers, even when notes already exist. Rebuilding from old
  notes publishes old words over new numbers.
- Read `metrics.json` with `jq` or by line range: it's too large to read whole.
- Keep the write-ups short: the page is the result of this run.

## 3. The pages without a skill

For `race-form` and `training-breaks`: run `npm run report -- <page>`, read its link from what it
prints, read that artifact, then publish `data/reports/<page>.html` to that link.

## 4. Failures

If one page fails, leave its published version alone, note why, and carry on with the next. Never
publish a page whose build failed, and never compute a number to fill a gap.

## 5. Finish

List each page with its link or its failure. The last line of your reply must be exactly
`REFRESH OK` if all 7 pages were published, otherwise `REFRESH FAILED: <the pages that failed>`.
