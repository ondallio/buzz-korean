import assert from "node:assert/strict";
import test from "node:test";
import { setLocale } from "@/shared/i18n";
import { parsePromptText } from "./agentSessionTranscriptHelpers.ts";
import { buildTranscript } from "./agentSessionTranscript.ts";
import { buildCompactToolSummary } from "./agentSessionToolSummary.ts";
import { getActivityHeadline } from "./agentSessionTranscriptPresentation.ts";
import {
  getAgentTranscript,
  syncAgentObserverEvents,
  resetAgentObserverStore,
} from "../observerRelayStore.ts";

const pubkey = "a".repeat(64);
const eventId = "c".repeat(64);
const event = {
  seq: 1,
  timestamp: "2026-06-18T00:00:00Z",
  kind: "acp_write",
  agentIndex: 0,
  channelId: "canonical-channel-id",
  sessionId: "s",
  turnId: "t",
};
const frame = `<buzz-event type="@mention">\nEvent ID: ${eventId}\nFrom: Alice (hex: ${pubkey})\nContent: USER ORIGINAL 한국어\n</buzz-event>`;
const tool = {
  ...event,
  kind: "acp_read",
  payload: {
    method: "session/update",
    params: {
      sessionId: "s",
      update: {
        sessionUpdate: "tool_call",
        toolCallId: "read1",
        title: "read_file",
        status: "completed",
        rawInput: { path: "/tmp/USER_FILE.ts" },
      },
    },
  },
};
test.afterEach(() => {
  setLocale("en");
  resetAgentObserverStore();
});
for (const language of ["en", "ko"]) {
  test(`semantic prompt retains canonical content and full identity in ${language}`, () => {
    setLocale(language);
    const result = parsePromptText(frame);
    assert.equal(result.userText, "USER ORIGINAL 한국어");
    assert.equal(result.userPubkey, pubkey);
    assert.equal(result.userEventId, eventId);
    assert.equal(result.userTitle, "@Mention");
    assert.equal(result.sections[0].kind, "buzz-event");
    assert.deepEqual(result.sections[0].attributes, { type: "@mention" });
    const items = buildTranscript([
      {
        ...event,
        payload: {
          method: "session/prompt",
          params: { prompt: [{ type: "text", text: frame }] },
        },
      },
    ]);
    const message = items.find((item) => item.type === "message");
    assert.ok(message, "original user row remains present");
    assert.equal(message.text, "USER ORIGINAL 한국어");
    assert.equal(message.authorPubkey, pubkey);
    assert.equal(message.messageId, eventId);
    assert.equal(message.channelId, "canonical-channel-id");
  });
}
test("same observer-cached item changes presentation without a new event or cache mutation", () => {
  setLocale("en");
  syncAgentObserverEvents(pubkey, [tool]);
  const sameItem = getAgentTranscript(pubkey)[0];
  const original = JSON.stringify(sameItem);
  assert.equal(buildCompactToolSummary(sameItem).label, "Read file");
  setLocale("ko");
  assert.equal(getAgentTranscript(pubkey)[0], sameItem);
  assert.equal(buildCompactToolSummary(sameItem).label, "파일 읽기");
  assert.equal(buildCompactToolSummary(sameItem).action.verb, "읽음");
  assert.equal(getActivityHeadline(sameItem), "파일 읽기 · /tmp/USER_FILE.ts");
  assert.equal(JSON.stringify(sameItem), original);
  setLocale("en");
  assert.equal(buildCompactToolSummary(sameItem).label, "Read file");
});

test("legacy bracket event parsing retains the same identity in Korean", () => {
  setLocale("ko");
  const text = `[Buzz event: @mention]\nEvent ID: ${eventId}\nFrom: Alice (hex: ${pubkey})\nContent: USER ORIGINAL 한국어`;
  const result = parsePromptText(text);
  assert.equal(result.userText, "USER ORIGINAL 한국어");
  assert.equal(result.userPubkey, pubkey);
  assert.equal(result.userEventId, eventId);
  assert.equal(result.sections[0].kind, "buzz-event");
  assert.deepEqual(result.sections[0].attributes, { type: "@mention" });
});

test("all fixed activity verbs have Korean presentation while provider labels remain raw", async () => {
  const { formatActivityVerb } = await import("./agentSessionPresentation.ts");
  for (const [english, korean] of [
    ["Added", "추가함"],
    ["Archived", "보관함"],
    ["Captured", "캡처함"],
    ["Checked", "확인함"],
    ["Compacted", "압축함"],
    ["Created", "만듦"],
    ["Deleted", "삭제함"],
    ["Edited", "수정함"],
    ["Ran", "실행함"],
    ["Read", "읽음"],
    ["Removed", "제거함"],
    ["Requested", "요청함"],
    ["Searched", "검색함"],
    ["Sent", "보냄"],
    ["Unarchived", "보관 해제함"],
    ["Updated", "업데이트함"],
    ["Viewed", "확인함"],
  ]) {
    setLocale("en");
    assert.equal(formatActivityVerb(english), english);
    setLocale("ko");
    assert.equal(formatActivityVerb(english), korean);
  }
  assert.equal(formatActivityVerb("PROVIDER API_field"), "PROVIDER API_field");
});

test("known lifecycle and plan envelopes translate without changing their source counts or external details", async () => {
  const { formatActivityItemText, formatPlanUpdateText } = await import(
    "./agentSessionPresentation.ts"
  );
  setLocale("ko");
  assert.equal(
    formatActivityItemText({
      type: "lifecycle",
      acpSource: "turn_started",
      text: "Triggered by 2 events.",
    }),
    "이벤트 2개로 시작했습니다.",
  );
  assert.equal(
    formatActivityItemText({
      type: "lifecycle",
      acpSource: "usage_update",
      text: "Tokens: 123/456 ($0.0123 USD)",
    }),
    "토큰: 123/456 ($0.0123 USD)",
  );
  assert.equal(
    formatActivityItemText({
      type: "lifecycle",
      acpSource: "available_commands_update",
      text: "Commands available: 3",
    }),
    "사용 가능한 명령어: 3개",
  );
  assert.equal(
    formatActivityItemText({
      type: "lifecycle",
      acpSource: "external-provider",
      text: "Commands available: 3",
    }),
    "Commands available: 3",
  );
  assert.equal(
    formatPlanUpdateText({
      type: "plan",
      acpSource: "plan",
      isUpdate: true,
      text: "1/3 complete",
    }),
    "3개 중 1개 완료",
  );
  assert.equal(
    formatPlanUpdateText({
      type: "plan",
      acpSource: "plan",
      isUpdate: true,
      text: "2 steps",
    }),
    "단계 2개",
  );
});
