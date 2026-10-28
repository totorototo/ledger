# Ledger: project rules

Web app that reads the runner's own Garmin Connect data through Garmin's Personal API
(activities, profile for now). React 19, styled-components, zustand, Vite 8, Vitest,
Playwright, pure JS.

The app's name is **Ledger** (masthead, tab title, footer). Never brand it "Garmin": it
reads Garmin Connect data but isn't Garmin's, and the footer says so.

## The key stays on the server

- The Personal API key is `GARMIN_PERSONAL_API_KEY` in `.env` at the repo's root
  (gitignored), read by `vite.config.js` with `loadEnv(…, "GARMIN_")`. Never give it a
  `VITE_` prefix: Vite inlines those into the bundle.
- `server/garmin.js` is the only code in the page's path that sees the key or a token:
  middleware on Vite's dev and preview servers that answers `/api/garmin/*`. It exchanges the
  key for a JWT (`Authorization: ApiKey …`), keeps it in memory until an hour before its
  `exp`, and forwards GETs with `Authorization: Bearer …`. One forced re-exchange on a 401.
  Nothing but GET.
- The page (`src/api/garmin.js`) calls same-origin `/api/garmin/<Garmin path>` and never
  holds a credential. Paths come from Garmin's client
  (github.com/garmin/connect-personal-api-python, `client.py`): copy new ones from there.
- No static deploy: without the middleware the page has no API. Hosting it means a server
  function doing what `server/garmin.js` does, plus access control: anyone who reaches the
  proxy reads the account. Same for `vite --host` on a shared network.

## Reading activities

- The store (`src/store/store.js`) is a factory taking the client and the cache: tests
  pass fakes. A newer `connect` drops an older one's answer
  (generation).
- Garmin answers 500 past a `limit` of 100: never ask for larger pages.
- Probed 2026-10-26: a `start` past the end answers `[]` (200), so parallel pages are safe;
  an `endDate` a year or more ahead answers `[]` for the whole range, so the incremental read
  sends `startDate` alone.
- Probed 2026-10-28: list items carry training effect (`aerobicTrainingEffect`,
  `trainingEffectLabel`…), power, cadence and `differenceBodyBattery` from mid-2023 on, never
  `vO2MaxValue`. HRV (`/hrv-service/hrv/daily/{start}/{end}`) answers up to a year per request
  (400 days → 400), 204 for a range with no readings; this account's start in 2024-01.
  Daily summaries (`heartRate.restingValue`) answer up to 365 days, sleep summaries up to 31
  (an object keyed "0", "1"…); both start 2024-01 here, older daily summaries carry no heart
  rate. Heart-rate zones are the current settings only. Activity detail carries no RPE/feel.
  Runs carry `fastestSplit_5000/10000/21098/42195` (best stretch inside the run) from 2024 on;
  the Personal API has no race-prediction endpoint, so `src/utils/race.js` scores them (VDOT).
  `eventType.typeKey` is "race" on one activity in 1074: trail events (`src/utils/trail.js`) are
  also a plan's past races or any day of 100 effort-km or more. Their time is
  `elapsedDuration` (the race clock): `duration` stops while the watch is paused (2h20 short on
  one 30 h race here). A plan race line with a result (`…, 15:26:19` or `…, DNF`) wins over
  the watch: the official course and clock, at any age; a DNF day is never an event. A line may name its ground
  (`runnable`, `technical`): one factor each on the time on the move, against untagged courses. The watch
  is no result sheet: a DNF recorded to the drop reads as a slow finish.
- The cached history (IndexedDB, one entry per account) is merged by `activityId`; only
  Refresh sees an activity edited or deleted on an older day.
- Every activity is trimmed to `KEPT` in `src/store/cache.js`: reading a new field means
  adding it there and bumping `CACHE_VERSION`.
- Only the theme, the view, the picked activity types and the measure go through zustand's
  persist (localStorage). The history never does.

## Pages

- The type filter and the measure drive every chart and total below them; Training alone
  ignores the filter. Filter as the pages render, never at fetch time: changing it costs no
  request.
- Sums are pure functions in `src/utils/` (`yearStats.js`, `metrics.js`, `training.js`),
  never in components.
- The Year page compares with another year (`against` in the store, the year before when none
  is picked; kept as the shown year changes, not persisted): the tiles' changes and the
  running total's dashed line follow it, both cut at today's date when either year is the
  current one.
- Training is one year only (the whole history on one axis was unreadable), read with the
  year before so January's 28-day load is whole. It screens first and says what it set aside:
  a number never silently drops data.
- `startTimeLocal` is the watch's clock with no zone: read it as a string, never through
  `Date`.
- Design system: tokens come from `@totorototo/trail-tokens`;
  `src/theme/Theme.js` only re-exports it. Never edit token values here. Shared control
  styles are fragments in `src/theme/controls.js`. Component styles go in `*.style.js` next
  to the component.
- Spacing is the design system's 4px grid: `var(--space-4)`, never a rem or px literal.

## Insights

- `npm run export` (`scripts/export.mjs`) reads the history from Node with the same key,
  token source and pages of 100 (`server/export.js`), trims it with `trim`, and writes
  `data/activities.json` and `data/metrics.json` (`insights` in `src/utils/insights.js`).
  `data/` is gitignored: it is the account's data.
- Wellness goes into `data/wellness.json`: HRV (`readHrv`) and resting HR (`readRestingHr`)
  a year per request back from today, stopping at the first year with no reading; sleep
  (`readSleep`) a month per request from the first of those, without stopping (a month off
  the watch happens); the running zones as set now. The skills read HRV against Garmin's
  balanced band, never a baseline of ours; resting HR has no Garmin band, so its baseline is
  the median of the 28 days before (`restingSummary`).
- `data/plan.md` is the runner's own races, planned blocks and health notes (template
  `scripts/plan.example.md`), parsed by `parsePlan` (`src/utils/plan.js`): a line it can't read
  is listed in `plan.ignored`, never dropped silently.
- `metrics.json` is built only from the pages' own sums (`metrics.js`, `training.js`,
  `yearStats.js`), so a skill's numbers match the app's. Changing a field's meaning or
  removing one means bumping `METRICS_VERSION` and the version the skills check.
- The skills (`.claude/skills/*/SKILL.md`) quote numbers from `metrics.json` and interpret
  them; they never compute one. A number a skill needs and doesn't find goes into
  `insights`, with a test.

## Reports

- Each skill ends by publishing its reading as a page: it writes only words to
  `data/reports/<skill>.notes.json`, and `npm run report -- <skill>` (`scripts/report.mjs`,
  pure picking in `scripts/reports/build.js`) takes the numbers from `metrics.json` itself and
  fills `scripts/reports/<skill>.html`. A note the builder can't read fails the build by name.
- The pages are Ledger in Trail Suite's voice (`scripts/reports/base.css`): mono titles,
  numbers and labels, ledger rows on 10% hairlines, violet for trends, the theme's own grounds
  (light #c4c4c4). No cards, pills or gradients.
- `data/reports/` (gitignored) holds the pages and `links.json`, each page's claude.ai link:
  a run updates its page in place. Publishing uploads the account's data to claude.ai, private
  until the runner shares it.

## Tests

- Unit tests never reach Garmin: the client and the middleware both take a `fetch`, the store
  a fake client and `memoryCache()`. `server/*.test.js` run in Vitest's node environment.
- e2e (`npm run e2e`) runs the built app in Chromium with `/api/garmin` routed by the test
  (`e2e/helpers.js`), so it needs no key.

## Data

- Never commit an account's data. `.gitignore` blocks `.env`, `*.fit`, `*.zip`, `*.gpx`.
- Fixtures (`src/test/fixtures.js`, `e2e/helpers.js`) are synthetic, in the API's shape.
