import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ComposerImageEditor } from "@/features/messages/ui/ComposerImageEditor";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { setLocale } from "./index.ts";
test("black pen keeps its contrast outline and control identity across language changes", async () => {
  setLocale("en");
  const node = document.createElement("div");
  const root = createRoot(node);
  try {
    await act(async () =>
      root.render(
        React.createElement(
          TooltipProvider,
          null,
          React.createElement(ComposerImageEditor, {
            alt: "USER IMAGE",
            src: "data:image/png;base64,",
            sourceUrl: "USER_URL",
            sourceType: "image/png",
            onCancel: () => {},
            onSave: async () => {},
          }),
        ),
      ),
    );
    const button = node.querySelector('button[aria-label="Black pen"]');
    assert.ok(button);
    const swatch = button.querySelector("span");
    assert.ok(swatch.className.includes("ring-white/30"));
    await act(async () => setLocale("ko"));
    assert.ok(swatch.className.includes("ring-white/30"));
    assert.equal(button.querySelector("span"), swatch);
    assert.equal(button.getAttribute("aria-label"), "검정 펜");
  } finally {
    await act(async () => root.unmount());
    setLocale("en");
  }
});
