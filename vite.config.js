import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import THEME from "@totorototo/trail-tokens";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import { createGarminMiddleware } from "./server/garmin.js";

// The key lives in the repo's own .env, gitignored.
const ENV_DIR = dirname(fileURLToPath(import.meta.url));

// The browser chrome takes dark's background, as the suite's.
const CHROME_COLOR = THEME.colors.dark["--color-background"];

function themeColorPlugin() {
  return {
    name: "theme-color",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { name: "theme-color", content: CHROME_COLOR },
        injectTo: "head",
      },
    ],
  };
}

// /api/garmin/* on the dev and preview servers: the server holds the key, the page never.
// why loadEnv with the GARMIN_ prefix: only VITE_ variables reach the bundle, so the key
// stays in Node; and loadEnv reads .env files, which process.env alone would not.
function garminApiPlugin(apiKey) {
  const middleware = createGarminMiddleware({ apiKey });
  return {
    name: "garmin-api",
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ENV_DIR, "GARMIN_");
  return {
    plugins: [react(), themeColorPlugin(), garminApiPlugin(env.GARMIN_PERSONAL_API_KEY)],
  };
});
