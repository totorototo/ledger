import { defineConfig, devices } from "@playwright/test";

// Port 4203: Retrace previews on 4173, Waymark on 4183, Regimen on 4193, Terminus on 5173, and
// a local run would reuse their server.
// The page's /api/garmin calls are routed by each test (e2e/helpers.js): no run reaches
// Garmin, with or without a key in .env.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4203",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: process.env.CI
      ? "npm run preview -- --port 4203 --strictPort"
      : "npm run build && npm run preview -- --port 4203 --strictPort",
    url: "http://localhost:4203",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Lets a machine with a preinstalled Chromium skip `playwright install`.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
});
