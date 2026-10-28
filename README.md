# Ledger

Your own Garmin Connect activities in the browser: yearly and all-time totals, training load
and running efficiency, read through Garmin's
[Personal API](https://developer.garmin.com/gc-developer-program/personal/personal-api).

Ledger is a personal project, not a Garmin product. It reads only the account whose API key
you give it, and only ever sends GET requests.

## What it shows

- **Year:** distance, time and elevation per month and per sport, a running total against
  the year before at the same date, and a Training section: weekly acute/chronic load, monthly
  efficiency on easy runs, and time in easy, grey and hard intensity.
- **All time:** every year since your first activity, each one opening its Year page.
- **Filters:** pick activity types from the chart legend, and switch the measure between
  distance, duration and elevation gain. Both apply page-wide.

## Setup

Requires Node 20 or later.

1. Create a Personal API key in Garmin Connect (Settings → Personal API Key). It is shown
   once.
2. Put it in `.env` at the repo's root. The file is gitignored.

   ```shell
   GARMIN_PERSONAL_API_KEY=…
   ```

3. Install and run, then open http://localhost:5173:

   ```shell
   npm install
   npm run dev
   ```

## How it works

```
browser ──/api/garmin/*──▶ Vite dev server ──Bearer token──▶ Garmin Personal API
(no key)                   server/garmin.js
                           (holds the key)
```

- **The key never reaches the browser.** The Vite middleware swaps it for a short-lived
  token and forwards the page's requests. That's also why there is no static build to
  deploy: without the middleware the page has no API. Run it on your own machine, and don't
  expose it with `vite --host` on a shared network.
- **Your history is kept in the browser** (IndexedDB). On later visits, Ledger shows it
  immediately and fetches only activities since the newest one it has, usually a single
  request. **Refresh** fetches everything again, which also picks up activities edited or
  deleted on Garmin.

## Scripts

| Script                  | What it does                                         |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | Dev server with the Garmin proxy                     |
| `npm run build`         | Production build to `dist/`                          |
| `npm run preview`       | Serves `dist/`, with the proxy                       |
| `npm test`              | Vitest in watch mode (`npm run test:run` runs once)  |
| `npm run test:coverage` | Unit tests with coverage                             |
| `npm run e2e`           | Playwright on the built app, Garmin stubbed (no key) |
| `npm run lint`          | ESLint                                               |
| `npm run format`        | Prettier                                             |
| `npm run icons`         | Writes `public/` icons from `src/theme/mark.js`      |
| `npm run export`        | Writes your history and its sums to `data/` (local)  |

## Insights with Claude Code

`npm run export` reads your whole history, nightly HRV, resting heart rate, sleep and running
zones with the key in `.env` and writes three files to `data/` (gitignored):
`activities.json`, the history, `wellness.json`, the daily readings, and `metrics.json`, the
weekly, monthly and yearly sums the app shows plus the readings' (`src/utils/insights.js`).

For context Garmin doesn't hold (races, planned rest weeks, illness or injury), copy
`scripts/plan.example.md` to `data/plan.md` and keep it current: the next export adds it to
`metrics.json`. The skills in `.claude/skills/` read
`metrics.json` and only interpret it; they never compute their own numbers:

| Skill              | Ask it                                                   |
| ------------------ | -------------------------------------------------------- |
| `weekly-review`    | How did this week go, against the 4 weeks before?        |
| `load-check`       | Is my load rising too fast? Load ratio, volume jumps, Z3 |
| `aerobic-progress` | Am I getting fitter? Easy-run efficiency month by month  |

## Project layout

| Path         | What's there                                                   |
| ------------ | -------------------------------------------------------------- |
| `src/`       | The React app: components, zustand store, IndexedDB cache      |
| `src/utils/` | Pure sums: year totals, running totals, training metrics       |
| `server/`    | The Garmin proxy middleware (the only code that holds the key) |
| `e2e/`       | Playwright tests, with Garmin's answers stubbed                |

## License

MIT. See [LICENSE](LICENSE).
