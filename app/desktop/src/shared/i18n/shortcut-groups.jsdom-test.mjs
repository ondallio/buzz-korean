import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { KeyboardShortcutsCard } from "@/features/settings/ui/KeyboardShortcutsCard";
import { setLocale } from "./index.ts";
test("real shortcut headings translate while key combinations and DOM identities remain canonical", async () => {
  setLocale("en");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(React.createElement(KeyboardShortcutsCard)),
    );
    const keys = [...host.querySelectorAll("kbd")];
    const labels = keys.map((el) => el.textContent);
    assert.ok(keys.length > 20);
    assert.match(host.textContent, /Navigation/);
    assert.match(host.textContent, /Formatting/);
    await act(async () => setLocale("ko"));
    for (const heading of ["탐색", "메시지", "서식", "확대·축소"])
      assert.ok(host.textContent.includes(heading));
    assert.deepEqual([...host.querySelectorAll("kbd")], keys);
    assert.deepEqual(
      keys.map((el) => el.textContent),
      labels,
    );
  } finally {
    await act(async () => root.unmount());
    host.remove();
    setLocale("en");
  }
});
