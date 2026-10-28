import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Unit tests never reach Garmin: the page's client takes a fetch, the server's proxy too.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Clock times on one zone, whatever the machine's: what a test reads doesn't move.
    env: { TZ: "UTC" },
    globals: true,
    setupFiles: ["./src/setupTests.js"],
    include: ["src/**/*.test.{js,jsx}", "server/**/*.test.js", "scripts/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{js,jsx}", "server/**/*.js"],
      exclude: ["**/*.test.{js,jsx}", "src/**/*.style.{js,jsx}", "src/main.jsx"],
      // Terminus's thresholds.
      thresholds: {
        lines: 75,
        functions: 65,
        branches: 65,
        statements: 75,
      },
    },
  },
});
