// Feature: features/channel-context-menu.md
import { expect, test } from "@playwright/test";

import {
  bootApp,
  CHANNEL_IDS,
  Evidence,
  installMockBridge,
  MOCK_PUBKEY,
} from "./_support";

const STAR_KEY = `buzz-channel-stars.v1:${MOCK_PUBKEY}`;
const MUTE_KEY = `buzz-channel-mutes.v1:${MOCK_PUBKEY}`;

test("channel context menu: items, copy submenu, star, mute, persistence", async ({
  page,
}, testInfo) => {
  await installMockBridge(page);
  const ev = new Evidence(page, testInfo, "channel-context-menu");
  await bootApp(page);
  await page.getByTestId("channel-general").click();
  await expect(page.getByTestId("chat-title")).toHaveText("general");

  const row = page.getByTestId("channel-engineering");
  // Closed Radix menus stay mounted while they animate out; scope to open ones.
  const menu = page.locator('[role="menu"][data-state="open"]').first();

  // ctx-open (pointer): right-click a channel row.
  await row.click({ button: "right" });
  await expect(menu).toBeVisible();
  for (const name of ["Copy", "Move to section", "Mute channel", "Star channel"]) {
    await expect(menu.getByRole("menuitem", { name })).toBeVisible();
  }
  const items = await menu.getByRole("menuitem").allInnerTexts();
  ev.note({ event: "menu-items", channel: "engineering", items });
  await ev.capture("menu-open", "right-click channel-engineering", undefined);

  // ctx-copy: submenu exposes copy name / id.
  await menu.getByRole("menuitem", { name: "Copy" }).hover();
  await expect(page.getByRole("menuitem", { name: "Copy channel name" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Copy channel ID" })).toBeVisible();
  await ev.capture("copy-submenu", "hover menuitem 'Copy'");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator('[role="menu"][data-state="open"]')).toHaveCount(0);

  // ctx-star: Star channel -> row moves into the Starred section.
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Star channel" }).click();
  const starred = page.getByTestId("starred-list");
  await expect(starred.getByTestId("channel-engineering")).toBeVisible();
  const starState = await page.evaluate((k) => localStorage.getItem(k), STAR_KEY);
  expect(starState).toContain(CHANNEL_IDS.engineering);
  ev.writeJson("star-localstorage", JSON.parse(starState ?? "null"));
  await ev.capture("starred", "menuitem 'Star channel'", page.getByTestId("app-sidebar"));

  // ctx-mute: Mute channel -> label flips to Unmute.
  await page.getByTestId("channel-engineering").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Mute channel" }).click();
  await expect
    .poll(() => page.evaluate((k) => localStorage.getItem(k), MUTE_KEY))
    .toContain(CHANNEL_IDS.engineering);
  ev.writeJson(
    "mute-localstorage",
    JSON.parse((await page.evaluate((k) => localStorage.getItem(k), MUTE_KEY)) ?? "null"),
  );

  // Reopen (pointer). There is no keyboard path to this menu: Playwright's
  // Shift+F10 does not raise `contextmenu`, and rows have no menu button.
  await page.getByTestId("channel-engineering").first().click({ button: "right" });
  await expect(menu.getByRole("menuitem", { name: "Unmute channel" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Unstar channel" })).toBeVisible();
  await ev.capture("menu-after-toggle", "reopen menu after star+mute");
  await page.keyboard.press("Escape");

  // Persistence: reload and confirm the second view still shows both states.
  await page.reload();
  await bootApp(page);
  await expect(page.getByTestId("starred-list").getByTestId("channel-engineering")).toBeVisible();
  await page.getByTestId("channel-engineering").first().click({ button: "right" });
  await expect(menu.getByRole("menuitem", { name: "Unmute channel" })).toBeVisible();
  await ev.capture("after-reload", "reload + right-click channel-engineering");

  // Restore: unstar + unmute so the journey leaves no state behind.
  await menu.getByRole("menuitem", { name: "Unmute channel" }).click();
  await page.getByTestId("channel-engineering").first().click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Unstar channel" }).click();
  await expect(page.getByTestId("starred-list")).toBeHidden();
});
