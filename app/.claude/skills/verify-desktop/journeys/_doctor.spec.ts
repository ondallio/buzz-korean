// Doctor probe: the instance is worth driving only if the mock-bridge app
// boots to a usable sidebar with the seeded #general channel.
import { expect, test } from "@playwright/test";

import { bootApp, installMockBridge } from "./_support";

test("doctor: app boots with mock bridge", async ({ page }) => {
  await installMockBridge(page);
  await bootApp(page);
  await expect(page.getByTestId("channel-general")).toBeVisible();
  const hasBridge = await page.evaluate(
    () => typeof (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
  );
  expect(hasBridge).toBe("object");
});
