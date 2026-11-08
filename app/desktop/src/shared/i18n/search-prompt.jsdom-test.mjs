import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { SearchPromptPlaceholder } from "@/features/search/ui/SearchPromptPlaceholder";
import { setLocale } from "./index.ts";
test("animated search words and width measurement use Korean while rotation identities stay stable", async () => {
  setLocale("ko");
  const node = document.createElement("div");
  const root = createRoot(node);
  try {
    await act(async () =>
      root.render(React.createElement(SearchPromptPlaceholder)),
    );
    const letters = () =>
      [...node.querySelectorAll('[data-testid="search-placeholder-character"]')]
        .map((x) => x.textContent)
        .join("");
    assert.equal(letters(), "전체");
    assert.equal(
      node
        .querySelector("[data-active-search-prompt]")
        .getAttribute("data-active-search-prompt"),
      "everything",
    );
    await act(async () => setLocale("en"));
    assert.equal(node.querySelector(".invisible").textContent, "everything");
  } finally {
    await act(async () => root.unmount());
    setLocale("en");
  }
});
