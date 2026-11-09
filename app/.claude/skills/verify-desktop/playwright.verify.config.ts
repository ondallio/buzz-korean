// Playwright config for verify-desktop journeys. Driven by
// scripts/verify-desktop.sh, which owns the static server (no webServer here,
// so a stale 4173 server can never be silently reused).
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.VERIFY_BASE_URL;
if (!baseURL) {
  throw new Error(
    "VERIFY_BASE_URL is unset; run journeys through scripts/verify-desktop.sh drive",
  );
}

export default defineConfig({
  testDir: "./journeys",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  outputDir: process.env.VERIFY_PW_OUTPUT_DIR ?? "/tmp/verify-desktop-pw-output",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    viewport: { width: 1280, height: 720 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
