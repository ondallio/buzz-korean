import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setLocale } from "@/shared/i18n";
import { buildTranscript } from "./agentSessionTranscript.ts";
import { ThoughtActivity } from "./activityRenderClasses/ThoughtActivity.tsx";
import { LifecycleActivity } from "./activityRenderClasses/LifecycleActivity.tsx";
import { CompactToolSummaryRow } from "./AgentSessionToolItem/CompactToolSummaryRow.tsx";
import { PromptSectionList } from "./PromptSectionAccordion.tsx";
import { parsePromptText } from "./agentSessionTranscriptHelpers.ts";

const mounted = [];
test.afterEach(async () => {
  for (const { root, element } of mounted.splice(0)) {
    await act(async () => root.unmount());
    element.remove();
  }
  setLocale("en");
});
async function mount(Component, props) {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  mounted.push({ root, element });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let content = React.createElement(Component, props);
  if (Component === ThoughtActivity) {
    const route = createRootRoute({
      component: () => React.createElement(Component, props),
    });
    const router = createRouter({
      routeTree: route,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    await router.load();
    content = React.createElement(RouterProvider, { router });
  }
  await act(async () =>
    root.render(React.createElement(QueryClientProvider, { client }, content)),
  );
  return element;
}
const base = {
  seq: 1,
  timestamp: "2026-06-18T00:00:00Z",
  kind: "acp_read",
  agentIndex: 0,
  channelId: "canonical-channel",
  sessionId: "s",
  turnId: "t",
};
const props = (item) => ({
  item,
  agentPubkey: "a".repeat(64),
  agentName: "USER AGENT",
});

test("mounted app thought and external thought titles retain their distinct provenance", async () => {
  setLocale("en");
  const item = buildTranscript([
    {
      ...base,
      payload: {
        method: "session/update",
        params: {
          update: {
            sessionUpdate: "agent_thought_chunk",
            content: { type: "text", text: "USER REASONING" },
          },
        },
      },
    },
  ])[0];
  const view = await mount(ThoughtActivity, props(item));
  assert.match(view.textContent, /Thinking/);
  await act(async () => setLocale("ko"));
  assert.match(view.textContent, /생각 중/);
  assert.match(view.textContent, /USER REASONING/);
  assert.doesNotMatch(view.textContent, /Thinking/);
  const external = await mount(
    ThoughtActivity,
    props({ ...item, acpSource: "provider-authored", title: "Thinking" }),
  );
  assert.match(external.textContent, /Thinking/);
});

test("mounted known error title updates while raw diagnostic and same item remain intact", async () => {
  setLocale("en");
  const item = buildTranscript([
    {
      ...base,
      kind: "turn_error",
      payload: { outcome: "error", error: "USER ERROR API_field" },
    },
  ])[0];
  const before = JSON.stringify(item);
  const view = await mount(LifecycleActivity, props(item));
  assert.match(view.textContent, /Turn error/);
  await act(async () => setLocale("ko"));
  assert.match(view.textContent, /대화 오류/);
  assert.match(view.textContent, /USER ERROR API_field/);
  assert.equal(JSON.stringify(item), before);
});

test("mounted permission outcome localizes after canonical tone matching and retains provider details", async () => {
  setLocale("en");
  const events = [
    {
      ...base,
      payload: {
        id: 77,
        method: "session/request_permission",
        params: {
          title: "USER REQUEST",
          toolCallId: "RAW_TOOL_ID",
          options: [
            { optionId: "o1", kind: "reject_once", name: "USER OPTION" },
          ],
        },
      },
    },
    {
      ...base,
      seq: 2,
      kind: "acp_write",
      payload: {
        id: 77,
        result: { outcome: { outcome: "selected", optionId: "o1" } },
      },
    },
  ];
  const item = buildTranscript(events)[0];
  const view = await mount(LifecycleActivity, props(item));
  assert.match(view.textContent, /Permission requested/);
  await act(async () => setLocale("ko"));
  assert.match(view.textContent, /권한 요청/);
  assert.match(view.textContent, /거부됨\(reject_once\)/);
  assert.match(view.textContent, /USER REQUEST/);
  assert.match(view.textContent, /USER OPTION/);
  assert.match(view.textContent, /RAW_TOOL_ID/);
  assert.equal(item.outcome, "Denied (reject_once)");
  assert.match(
    view.querySelector('[data-testid="transcript-permission-outcome"]')
      .className,
    /text-destructive/,
  );
});

test("mounted compact edit uses an app verb and preserves file and diff numbers", async () => {
  setLocale("en");
  const view = await mount(CompactToolSummaryRow, {
    action: null,
    duration: null,
    fileEditSummary: {
      filename: "USER_FILE.ts",
      path: "/tmp/USER_FILE.ts",
      additions: 12,
      deletions: 3,
    },
    kind: "file-edit",
    label: "Edited file",
    preview: null,
    thumbnailSrc: null,
  });
  assert.match(view.textContent, /Edited/);
  await act(async () => setLocale("ko"));
  assert.match(view.textContent, /수정함/);
  assert.match(view.textContent, /USER_FILE.ts/);
  assert.match(view.textContent, /12/);
  assert.match(view.textContent, /3/);
});

test("mounted prompt sections translate complete context titles without changing canonical metadata or body", {
  timeout: 5000,
}, async () => {
  setLocale("en");
  const sections = parsePromptText(
    '<thread-context included="1" total="3" truncated="true">\nUSER BODY API_field\n</thread-context>',
  ).sections;
  const before = JSON.stringify(sections);
  const view = await mount(PromptSectionList, { sections });
  const button = view.querySelector("button");
  await act(async () => button.click());
  await act(async () => setLocale("ko"));
  assert.ok(
    view.querySelector("button") === button,
    "language change preserves the accordion button node",
  );
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.match(view.textContent, /스레드 맥락\(메시지 3개 중 1개, 일부 생략\)/);
  assert.match(view.textContent, /USER BODY API_field/);
  assert.equal(JSON.stringify(sections), before);
});
