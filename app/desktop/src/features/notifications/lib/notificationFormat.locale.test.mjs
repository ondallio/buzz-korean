import assert from "node:assert/strict";
import test from "node:test";

import { setLocale } from "../../../shared/i18n/index.ts";
import { formatMessageNotification } from "./notificationFormat.ts";

test.afterEach(() => setLocale("en"));

test("Korean notification copy preserves user content, sender and channel names", () => {
  setLocale("ko");
  const content = "New message: 원문 그대로 @mention /run command";
  assert.deepEqual(
    formatMessageNotification({
      source: "mention",
      senderName: "Taylor",
      channelName: "ship-room",
      content,
    }),
    { title: "#ship-room에서 Taylor님이 회원님을 언급했습니다", body: content },
  );
  assert.deepEqual(
    formatMessageNotification({ source: "dm", senderName: "Reply", content }),
    { title: "Reply", body: content },
  );
});

test("Korean notifications localize source-specific empty-content fallbacks", () => {
  setLocale("ko");
  const cases = [
    ["dm", "다이렉트 메시지", "새 메시지"],
    ["thread_reply", "답글", "새 답글"],
    ["mention", "멘션", "Buzz에서 확인이 필요한 항목이 있습니다."],
    ["approval", "승인 요청", "워크플로가 승인을 기다리고 있습니다."],
    ["needs_action", "확인 필요", "Buzz에서 확인이 필요한 항목이 있습니다."],
  ];
  for (const [source, title, body] of cases) {
    assert.deepEqual(formatMessageNotification({ source, content: "  " }), {
      title,
      body,
    });
  }
});

test("native notification formatting reflects language switches without reimporting", () => {
  const message = {
    source: "approval",
    senderName: "Taylor",
    channelName: "ops",
    content: "",
  };
  assert.equal(
    formatMessageNotification(message).title,
    "Taylor requested approval in #ops",
  );
  setLocale("ko");
  assert.equal(
    formatMessageNotification(message).title,
    "#ops에서 Taylor님이 승인을 요청했습니다",
  );
  setLocale("en");
  assert.equal(
    formatMessageNotification(message).title,
    "Taylor requested approval in #ops",
  );
});
