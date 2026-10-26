# Ledger: project rules

Web app that reads the runner's own Garmin Connect data through Garmin's Personal API
(activities, profile for now). Same architecture as the Trail Suite apps (Regimen is the
template): React 19 + styled-components + zustand, Vite 8, Vitest, Playwright. Pure JS, no
Zig layer yet.

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

- The store (`src/store/store.js`) is a factory taking the client and the cache, as Regimen's
  takes the worker: tests pass fakes. A newer `connect` drops an older one's answer
  (generation).
- The activity list is read in pages of 100 (`readAll`) until one comes back short; Garmin
  answers 500 past a `limit` of 100. A year (`startDate`/`endDate`, both whole days) is read
  page after page: it rarely needs two. The whole history (no dates) reads the first page,
  then `PARALLEL_PAGES` at once.
- The history is read on every connect, in the background, and fills every year's slot, so
  the Year page then needs no request.
- It is kept in IndexedDB (`src/store/cache.js`, idb-keyval), one entry per account. Connect
  shows it at once, then reads only from its newest day on and merges by `activityId`.
  Refresh (`refresh()`) skips it and reads everything again: the only way an activity edited
  or deleted on an older day is seen.
- The toolbar says "Updating…" while that read runs (`history.syncing`) and "Couldn't
  update · showing saved data" when it fails (`history.error` on a ready history).
- Every activity is trimmed to the fields the pages read (`KEPT` in `cache.js`): reading a new field means adding it there and bumping `CACHE_VERSION`.
- Only the theme, the view, the picked activity types and the measure go through zustand's
  persist (localStorage).
- Probed 2026-10-26: a `start` past the end answers `[]` (200), so parallel pages are safe;
  an `endDate` a year or more ahead answers `[]` for the whole range, so the incremental read
  sends `startDate` alone.

## Pages

- The type filter and the measure sit in the page header (`.controls`) and drive every chart
  and total below them; Training alone ignores the filter. The filter (`filterByType`, the
  chart legend) is applied as the pages render, never at fetch time, so changing it costs no
  request. The sums are pure functions in `src/utils/yearStats.js`.
- The running total (`RunningTotal.jsx`) is the day-by-day cumulative sum (`runningTotal`,
  indexed by `dayOfYear`, read from the string like `monthOf`). The Year page also reads the
  year before for "vs last year at this date"; All time draws every year from the history.
- The Year page's Training section (`Training.jsx`, series in `src/utils/training.js`) takes
  its sums from `src/utils/metrics.js` (`screen`, `loadSeries`, `efficiency`, `intensity`,
  `isEasy`). One year
  only (the whole history on one axis was unreadable), read with the year before so January's
  28-day load is whole. Every sport counts, the year is screened first and the coverage line
  says what was set aside and how many rows carry load or heart rate. A month under
  `MIN_EASY_RUNS` easy runs is a gap, not a point.
- `startTimeLocal` is the watch's clock with no zone: written as is, never through `Date`.
- Design system (Trail Suite): tokens come from `@totorototo/trail-tokens`;
  `src/theme/Theme.js` only re-exports it. Never edit token values here. Shared control
  styles are fragments in `src/theme/controls.js`. Component styles go in `*.style.js` next
  to the component.
- Spacing is the design system's 4px grid: `var(--space-4)`, never a rem or px literal.

## Tests

- Unit tests never reach Garmin: the client and the middleware both take a `fetch`, the store
  a fake client and `memoryCache()`. `server/*.test.js` run in Vitest's node environment.
- e2e (`npm run e2e`) runs the built app in Chromium with `/api/garmin` routed by the test
  (`e2e/helpers.js`), so it needs no key.

## Data

- Never commit an account's data. `.gitignore` blocks `.env`, `*.fit`, `*.zip`, `*.gpx`.
- Fixtures (`src/test/fixtures.js`, `e2e/helpers.js`) are synthetic, in the API's shape.
