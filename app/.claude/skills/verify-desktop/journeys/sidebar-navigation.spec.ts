// Feature: features/sidebar-navigation.md
import { expect, test } from "@playwright/test";

import {
  bootApp,
  Evidence,
  installMockBridge,
  openChannelBrowser,
} from "./_support";

test("sidebar navigation: channels, history, primary menu, channel browser", async ({
  page,
}, testInfo) => {
  await installMockBridge(page);
  const ev = new Evidence(page, testInfo, "sidebar-navigation");
  await bootApp(page);
  const sidebar = page.getByTestId("app-sidebar");
  const title = page.getByTestId("chat-title");

  // nav-channel: pointer click on a sidebar channel row.
  await page.getByTestId("channel-general").click();
  await expect(title).toHaveText("general");
  await page.getByTestId("channel-random").click();
  await expect(title).toHaveText("random");
  await expect(page).toHaveURL(/#\/channels\//);
  ev.note({ event: "url", after: "click channel-random", url: page.url() });
  await ev.capture("random-open", "click [data-testid=channel-random]");

  // nav-history: toolbar back/forward buttons.
  await page.getByTestId("global-back").click();
  await expect(title).toHaveText("general");
  await page.getByTestId("global-forward").click();
  await expect(title).toHaveText("random");

  // nav-history (keyboard): platform chord, from inside the composer.
  const isMac = await page.evaluate(() =>
    /mac|iphone|ipad|ipod/i.test(navigator.platform),
  );
  await page.getByTestId("message-input").click();
  await page.keyboard.press(isMac ? "Meta+[" : "Alt+ArrowLeft");
  await expect(title).toHaveText("general");
  await page.keyboard.press(isMac ? "Meta+]" : "Alt+ArrowRight");
  await expect(title).toHaveText("random");
  ev.note({ event: "keyboard-history", ok: true, isMac });

  // nav-primary: Inbox (no test id; located by accessible name).
  await page
    .getByTestId("sidebar-primary-menu")
    .getByRole("button", { name: "Inbox", exact: true })
    .click();
  await expect(page.getByTestId("home-inbox-list")).toBeVisible();
  await ev.capture("inbox", "click sidebar-primary-menu button 'Inbox'");

  // nav-primary: Workflows.
  await page.getByTestId("open-workflows-view").click();
  await expect(page).toHaveURL(/#\/workflows$/);
  await expect(page.getByTestId("workflows-view")).toBeVisible();
  await ev.capture("workflows", "click [data-testid=open-workflows-view]");

  // nav-browse: channel browser via Cmd/Ctrl+Shift+O.
  await openChannelBrowser(page);
  const browser = page.getByTestId("channel-browser-dialog");
  await expect(browser).toBeVisible();
  await expect(page.locator('[data-testid^="browse-channel-"]').first()).toBeVisible();
  await ev.capture("channel-browser", "keydown Mod+Shift+O", browser);
  await page.keyboard.press("Escape");
  await expect(browser).toBeHidden();

  await ev.capture("sidebar-final", "after Escape", sidebar);
});
