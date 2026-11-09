// Feature: features/send-message.md
import { expect, test } from "@playwright/test";

import { bootApp, Evidence, installMockBridge } from "./_support";

type SignedEvent = { content: string; kind: number; tags: string[][] };

async function signedMessages(page: import("@playwright/test").Page) {
  return page.evaluate(
    () =>
      (
        (window as { __BUZZ_E2E_SIGNED_EVENTS__?: SignedEvent[] })
          .__BUZZ_E2E_SIGNED_EVENTS__ ?? []
      ).filter((e) => e.kind === 9),
  );
}

test("send message: button, Enter, Shift+Enter, empty guard, relay side effect", async ({
  page,
}, testInfo) => {
  await installMockBridge(page);
  const ev = new Evidence(page, testInfo, "send-message");
  await bootApp(page);

  await page.getByTestId("channel-random").click();
  await expect(page.getByTestId("chat-title")).toHaveText("random");
  const input = page.getByTestId("message-input");
  const send = page.getByTestId("send-message");
  const timeline = page.getByTestId("message-timeline");
  const stamp = Date.now();

  // send-empty: nothing typed -> no kind-9 event is signed.
  const before = (await signedMessages(page)).length;
  await input.click();
  await page.keyboard.press("Enter");
  expect((await signedMessages(page)).length).toBe(before);

  // send-button.
  const viaButton = `verify button ${stamp}`;
  await input.fill(viaButton);
  await ev.capture("draft", `fill message-input '${viaButton}'`);
  await send.click();
  await expect(timeline).toContainText(viaButton);
  await expect(input).toHaveText("");
  await ev.capture("sent-button", "click [data-testid=send-message]");

  // send-enter + multiline: Shift+Enter inserts a newline, Enter sends.
  const lineA = `verify enter ${stamp}`;
  const lineB = "second line";
  await input.click();
  await page.keyboard.type(lineA);
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type(lineB);
  await page.keyboard.press("Enter");
  await expect(timeline).toContainText(lineA);
  await expect(timeline).toContainText(lineB);

  // Side effect at the relay boundary: signed kind-9 events, h-tagged.
  const sent = (await signedMessages(page)).filter((e) =>
    e.content.includes(String(stamp)),
  );
  ev.writeJson("signed-kind9-events", sent);
  expect(sent.map((e) => e.content)).toEqual([viaButton, `${lineA}\n${lineB}`]);
  for (const e of sent) {
    expect(e.tags.some((t) => t[0] === "h")).toBe(true);
  }

  // Second view: leave and come back; messages are still in #random.
  await page.getByTestId("channel-general").click();
  await expect(page.getByTestId("chat-title")).toHaveText("general");
  await expect(timeline).not.toContainText(viaButton);
  await page.getByTestId("channel-random").click();
  await expect(timeline).toContainText(viaButton);
  await expect(timeline).toContainText(lineA);
  await ev.capture("after-revisit", "general -> random", timeline);
});
