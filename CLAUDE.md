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
- `metrics.json` is built only from the pages' own sums (`metrics.js`, `training.js`,
  `yearStats.js`), so a skill's numbers match the app's. Changing a field's meaning or
  removing one means bumping `METRICS_VERSION` and the version the skills check.
- The skills (`.claude/skills/*/SKILL.md`) quote numbers from `metrics.json` and interpret
  them; they never compute one. A number a skill needs and doesn't find goes into
  `insights`, with a test.

## Tests

- Unit tests never reach Garmin: the client and the middleware both take a `fetch`, the store
  a fake client and `memoryCache()`. `server/*.test.js` run in Vitest's node environment.
- e2e (`npm run e2e`) runs the built app in Chromium with `/api/garmin` routed by the test
  (`e2e/helpers.js`), so it needs no key.

## Data

- Never commit an account's data. `.gitignore` blocks `.env`, `*.fit`, `*.zip`, `*.gpx`.
- Fixtures (`src/test/fixtures.js`, `e2e/helpers.js`) are synthetic, in the API's shape.
