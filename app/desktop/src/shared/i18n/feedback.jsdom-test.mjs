import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { feedbackMessage, setLocale, useLocalizedFeedback } from "./index.ts";
test("retained app feedback re-renders source+values while external strings stay literal", async () => {
  setLocale("en");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let assign;
  function View() {
    const [value, setValue] = useLocalizedFeedback(null);
    assign = setValue;
    return React.createElement("p", null, value);
  }
  try {
    await act(async () => root.render(React.createElement(View)));
    const first = assign;
    const values = { count: 12 };
    await act(async () => assign(feedbackMessage("{count} unread", values)));
    values.count = 99;
    assert.equal(host.textContent, "12 unread");
    await act(async () => assign((previous) => previous));
    await act(async () => setLocale("ko"));
    assert.equal(assign, first);
    assert.equal(host.textContent, "읽지 않음 12개");
    await act(async () => assign("Retry"));
    assert.equal(host.textContent, "Retry");
    await act(async () => setLocale("en"));
    await act(async () => setLocale("ko"));
    assert.equal(host.textContent, "Retry");
    await act(async () => assign(null));
    assert.equal(host.textContent, "");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    setLocale("en");
  }
});
