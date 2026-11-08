import { expect, test } from "@playwright/test";
import { bootApp, Evidence, installMockBridge, openSettings } from "./_support";

const CORE_SETTINGS = [
  "profile",
  "appearance",
  "notifications",
  "shortcuts",
  "hosted-communities",
  "experimental",
  "updates",
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("buzz.locale.v1", "ko"));
  await installMockBridge(page);
  await bootApp(page);
});

test.afterEach(async ({ page }, info) => {
  const ev = new Evidence(page, info, "localization-runtime");
  const missing = await page.evaluate(() => {
    const getter = (
      window as unknown as {
        __BUZZ_E2E_MISSING_TRANSLATIONS__?: () => string[];
      }
    ).__BUZZ_E2E_MISSING_TRANSLATIONS__;
    return typeof getter === "function" ? getter() : null;
  });
  const key =
    info.title
      .toLowerCase()
      .match(/search|settings|agent|project|workflow/)?.[0] ?? "unknown";
  ev.writeJson(key, { getterAvailable: missing !== null, missing });
  expect(missing, "fresh test build must expose the read-only translation audit").not.toBeNull();
  expect(missing, "English fallback is not completed Korean copy").toEqual([]);
});

test("Korean search keeps original message content and DM scope", async ({
  page,
}, info) => {
  const ev = new Evidence(page, info, "localization-search");
  await page.getByTestId("channel-general").click();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByTestId("search-results")).toBeVisible();
  const input = page.getByTestId("search-dialog-input");
  await input.fill("welcome");
  await expect(page.getByTestId("search-results")).toContainText(
    "Welcome to #general",
  );
  await expect(
    page.getByTestId("search-current-channel-control"),
  ).toContainText("검색");
  await ev.capture(
    "results",
    "searched original English user content in Korean interface",
    page.getByTestId("search-results"),
  );
  await expect(page.getByTestId("search-results")).not.toContainText(
    "Message in",
  );
  await page.keyboard.press("Escape");
  await page.getByTestId("channel-alice-tyler").click();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(
    page.getByTestId("search-current-channel-control"),
  ).toContainText("alice");
  await expect(
    page.getByTestId("search-current-channel-control"),
  ).toContainText("검색");
  await ev.capture(
    "dm-scope",
    "opened search from DM",
    page.getByTestId("search-results"),
  );
});

test("Korean settings sections render and remain usable at narrow width and 150 percent CSS layout scale", async ({
  page,
}, info) => {
  const ev = new Evidence(page, info, "localization-settings");
  await openSettings(page);
  await expect(page.getByTestId("settings-nav-appearance")).toBeVisible();
  const names = await page
    .locator('[data-testid^="settings-nav-"]')
    .evaluateAll((nodes) =>
      nodes.map((node) =>
        (node.getAttribute("data-testid") ?? "").replace("settings-nav-", ""),
      ),
    );
  expect(names.length).toBeGreaterThan(0);
  expect(names).toEqual(expect.arrayContaining(CORE_SETTINGS));
  const visited = [];
  for (const name of names) {
    const button = page.getByTestId(`settings-nav-${name}`);
    await expect(button).toHaveAccessibleName(/[가-힣]/);
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    const panel = page.getByTestId(`settings-panel-${name}`);
    await expect(panel).toBeVisible();
    visited.push({
      section: name,
      label: await button.innerText(),
      headings: await panel.locator("h1,h2,h3").allTextContents(),
    });
  }
  ev.writeJson("visited-sections", visited);
  await page.getByTestId("settings-nav-appearance").click();
  await page.setViewportSize({ width: 800, height: 800 });
  await expect(page.getByTestId("interface-language")).toBeInViewport();
  const horizontalOverflow = await page
    .getByTestId("settings-view")
    .evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(horizontalOverflow).toBe(false);
  await ev.capture(
    "narrow",
    "800px wide Korean settings",
    page.getByTestId("settings-view"),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1.5";
  });
  await expect(page.getByTestId("interface-language")).toBeInViewport();
  const clipped = await page
    .getByTestId("interface-language")
    .evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(clipped).toBe(false);
  await ev.capture(
    "scaled-viewport",
    "150 percent CSS layout scale viewport capture; this is not native or browser zoom",
  );
});

test("Korean agent creation opens its actual translated avatar emoji picker", async ({
  page,
}, info) => {
  const ev = new Evidence(page, info, "localization-agents");
  await page.getByTestId("open-agents-view").click();
  await expect(page.getByTestId("new-agent-card")).toBeVisible();
  await expect(page.getByTestId("new-agent-card")).toHaveAccessibleName(
    /[가-힣]/,
  );
  await ev.capture("library", "opened agent library");
  await page.getByTestId("new-agent-card").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("에이전트");
  await ev.capture("editor", "opened new agent form", dialog);
  await dialog
    .getByRole("button", { name: "아바타 추가", exact: true })
    .click();
  await page.getByRole("tab", { name: "이모지", exact: true }).click();
  const picker = page.locator("em-emoji-picker");
  const search = picker.locator('input[type="search"]');
  await expect(search).toHaveAttribute("placeholder", "검색");
  await expect(picker.locator('[aria-label="스마일리 및 사람"]')).toBeVisible();
  await ev.capture(
    "emoji-picker",
    "opened real new-agent avatar emoji picker; Korean search placeholder and people category verified",
    picker,
  );
  await search.fill("smile");
  await expect(search).toHaveValue("smile");
  ev.writeJson("emoji-language", {
    placeholder: await search.getAttribute("placeholder"),
    peopleCategory: await picker
      .locator('[aria-label="스마일리 및 사람"]')
      .getAttribute("aria-label"),
    query: await search.inputValue(),
  });
});

test("Korean project overview translates activity verbs and status while preserving seeded repository and commit content", async ({
  page,
}, info) => {
  const ev = new Evidence(page, info, "localization-projects");
  await page.getByTestId("open-projects-view").click();
  await expect(page.getByTestId("projects-overview-layout")).toBeVisible();
  await expect(
    page.getByTestId("projects-activity-card").first(),
  ).toBeVisible();
  await ev.capture(
    "overview",
    "opened project overview with original English fixture names, descriptions and commit titles",
  );
  await expect(
    page.getByTestId("projects-activity-timeline"),
  ).not.toContainText(
    /created the repository|pushed a commit to|opened a review in/,
  );
  await expect(
    page
      .getByTestId("projects-activity-timeline")
      .getByText("Open", { exact: true }),
  ).toHaveCount(0);
});

test("Korean workflow editor translates its title and keeps the original channel name", async ({
  page,
}, info) => {
  const ev = new Evidence(page, info, "localization-workflows");
  await page.getByTestId("open-workflows-view").click();
  await expect(page.getByTestId("workflows-view")).toBeVisible();
  await page.getByTestId("new-workflow-card").click();
  await expect(page.getByTestId("channel-combobox-list")).toBeVisible();
  await page
    .getByTestId("channel-combobox-list")
    .getByRole("option", { name: "agents", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    page.getByRole("button", { name: "워크플로 이름 편집" }),
  ).toBeVisible();
  await expect(
    page.getByTestId("workflow-dialog-primary-action"),
  ).toHaveAccessibleName(/[가-힣]/);
  await ev.capture(
    "editor",
    "opened workflow form with raw agents channel name",
  );
  await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(
    "워크플로 만들기",
  );
});
