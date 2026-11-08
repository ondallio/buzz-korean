import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MessageTimestamp } from "@/features/messages/ui/MessageTimestamp";
import { setLocale, useLocaleMemo } from "./index.ts";
import { formatDayGroupLabel } from "@/shared/lib/datetime";

test("already mounted message timestamps change language through memoized parents", async () => {
  setLocale("en");
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  const Frozen = React.memo(() =>
    React.createElement(MessageTimestamp, {
      createdAt: Date.now() / 1000 - 86400,
    }),
  );
  await act(async () => root.render(React.createElement(Frozen)));
  assert.match(element.textContent, /Yesterday/);
  await act(async () => setLocale("ko"));
  assert.match(element.textContent, /어제/);
  assert.doesNotMatch(element.textContent, /Yesterday/);
  await act(async () => root.unmount());
  element.remove();
  setLocale("en");
});
test("locale memo invalidates labels computed by helpers even with stable caller dependencies", async () => {
  setLocale("en");
  const element = document.createElement("div");
  const root = createRoot(element);
  const yesterday = Date.now() / 1000 - 86400;
  function Label() {
    const label = useLocaleMemo(() => formatDayGroupLabel(yesterday), []);
    return React.createElement("span", null, label);
  }
  await act(async () => root.render(React.createElement(Label)));
  assert.equal(element.textContent, "Yesterday");
  await act(async () => setLocale("ko"));
  assert.equal(element.textContent, "어제");
  await act(async () => root.unmount());
  setLocale("en");
});
