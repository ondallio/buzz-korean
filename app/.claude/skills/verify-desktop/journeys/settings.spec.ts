// Feature: features/settings.md
import { expect, test } from "@playwright/test";

import { bootApp, Evidence, installMockBridge } from "./_support";

// Always rendered in mock mode. Others (Invites, Admin, Agents, Custom emoji,
// Channel templates) depend on membership snapshots or feature gates, so the
// journey visits whatever else is rendered and records it.
const CORE_SECTIONS = [
  "profile",
  "appearance",
  "notifications",
  "shortcuts",
  "hosted-communities",
  "experimental",
  "updates",
] as const;

test("settings: open from profile menu, every nav section, color mode persists, back", async ({
  page,
}, testInfo) => {
  await installMockBridge(page);
  const ev = new Evidence(page, testInfo, "settings");
  await bootApp(page);

  // settings-open: profile menu -> Settings.
  await page.getByTestId("open-settings").click();
  const popover = page.getByTestId("profile-popover");
  await expect(popover).toBeVisible();
  await ev.capture("profile-menu", "click [data-testid=open-settings]");
  await page.getByTestId("profile-popover-settings").click();
  const view = page.getByTestId("settings-view");
  await expect(view).toBeVisible();

  // settings-nav: group labels and every always-on section.
  const groups = await page
    .locator('[aria-label$=" settings sections"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  ev.note({ event: "nav-groups", groups });
  expect(groups).toEqual(
    expect.arrayContaining([
      "Personal settings sections",
      "Communities settings sections",
      "App settings sections",
    ]),
  );
  const rendered = await page
    .locator('[data-testid^="settings-nav-"]')
    .evaluateAll((els) =>
      els.map((e) => (e.getAttribute("data-testid") ?? "").replace("settings-nav-", "")),
    );
  expect(rendered).toEqual(expect.arrayContaining([...CORE_SECTIONS]));
  const navLabels: Record<string, string> = {};
  for (const section of rendered) {
    const button = page.getByTestId(`settings-nav-${section}`);
    navLabels[section] = (await button.innerText()).trim();
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId(`settings-panel-${section}`)).toBeVisible();
  }
  ev.writeJson("nav-labels", navLabels);
  await ev.capture("nav-last-section", "clicked every settings-nav-* button");

  // settings-appearance: Dark color mode is applied and persisted.
  await page.getByTestId("settings-nav-appearance").click();
  await expect(page.getByTestId("settings-theme")).toBeVisible();
  await page.getByTestId("appearance-mode-dark").click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
    .toBe(true);
  const stored = await page.evaluate(() => ({
    theme: localStorage.getItem("buzz-theme"),
  }));
  ev.writeJson("theme-localstorage", stored);
  await ev.capture("appearance-dark", "click [data-testid=appearance-mode-dark]");

  // Second view: reload keeps dark mode.
  await page.reload();
  await bootApp(page);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
    .toBe(true);

  // settings-close: back to app returns to the chat shell.
  await page.getByTestId("open-settings").click();
  await page.getByTestId("profile-popover-settings").click();
  await expect(view).toBeVisible();
  await page.getByTestId("settings-back-to-app").click();
  await expect(view).toBeHidden();
  await expect(page.getByTestId("app-sidebar")).toBeVisible();

  // Restore light mode so later journeys start from the default.
  await page.getByTestId("open-settings").click();
  await page.getByTestId("profile-popover-settings").click();
  await page.getByTestId("settings-nav-appearance").click();
  await page.getByTestId("appearance-mode-light").click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
    .toBe(false);
});
