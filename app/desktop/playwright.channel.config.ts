import { defineConfig, devices } from "@playwright/test";

// Keep focused channel checks isolated from concurrent production builds.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  retries: 0,
  workers: 1,
  reporter: "list",
  outputDir: "../../.local/channel-e2e-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4175",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  testMatch: ["**/korean-channel.spec.ts", "**/message-copy-link.spec.ts"],
  webServer: {
    command: "python3 -m http.server 4175 -d ../../.local/channel-e2e",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
  },
});
