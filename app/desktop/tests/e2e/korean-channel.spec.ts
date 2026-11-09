import { expect, test } from "@playwright/test";
import { installMockBridge } from "../helpers/bridge";
import { waitForAnimations } from "../helpers/animations";

test("Korean and English settings persist while conversation and search stay usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem("buzz.locale.v1"))
      localStorage.setItem("buzz.locale.v1", "en");
  });
  await installMockBridge(page);
  await page.goto("/");
  await expect(page.getByTestId("app-sidebar")).toBeVisible();
  await page.getByTestId("channel-random").click();
  const draft = "언어 전환 중인 한글 메시지";
  await page.getByTestId("message-input").fill(draft);
  await page.getByTestId("open-settings").click();
  await page.getByTestId("profile-popover-settings").click();
  await page.getByTestId("settings-nav-appearance").click();
  const picker = page.getByTestId("interface-language");
  await expect(picker).toHaveValue("en");
  await picker.selectOption("ko");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByTestId("settings-nav-profile")).toHaveAccessibleName(
    "프로필",
  );
  await expect(page.getByTestId("language-settings")).toContainText("언어");
  await picker.selectOption("en");
  await expect(page.getByTestId("settings-nav-profile")).toHaveAccessibleName(
    "Profile",
  );
  await picker.selectOption("ko");
  await page.getByTestId("settings-back-to-app").click();
  await page.getByTestId("channel-random").click();
  await expect(page.getByTestId("message-input")).toHaveText(draft);
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("message-timeline")).toContainText(draft);
  await page.reload();
  await expect(page.getByTestId("app-sidebar")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  expect(
    await page.evaluate(() => localStorage.getItem("buzz.locale.v1")),
  ).toBe("ko");
  await page.getByTestId("open-search").click();
  await page.getByTestId("search-dialog-input").fill("언어");
  await expect(page.getByTestId("search-dialog-input")).toHaveValue("언어");
  await page.keyboard.press("Escape");
  await page.getByTestId("channel-random").click({ button: "right" });
  await expect(
    page.locator('[role="menu"][data-state="open"]').first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 800, height: 700 });
  await waitForAnimations(page);
  await page.getByTestId("open-settings").click();
  await page.getByTestId("profile-popover-settings").click();
  await page.getByTestId("settings-nav-appearance").click();
  await expect(picker).toBeInViewport();
  expect(errors).toEqual([]);
});

test.describe("Korean operating system", () => {
  test.use({ locale: "ko-KR" });
  test("first launch follows OS without saving a manual preference", async ({
    page,
  }) => {
    await installMockBridge(page);
    await page.goto("/");
    await expect(page.getByTestId("app-sidebar")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    expect(
      await page.evaluate(() => localStorage.getItem("buzz.locale.v1")),
    ).toBeNull();
  });
});
