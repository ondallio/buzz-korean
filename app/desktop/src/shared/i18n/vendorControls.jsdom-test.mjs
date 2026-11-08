import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { enUS } from "react-day-picker/locale";
import { setLocale } from "./index.ts";
import { Calendar } from "@/shared/ui/calendar";
import * as emojiPicker from "@/features/custom-emoji/ui/EmojiPicker";

test("mounted calendar translates month options and navigation labels on locale changes", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    setLocale("en");
    await act(async () =>
      root.render(
        React.createElement(Calendar, {
          mode: "single",
          defaultMonth: new Date(2026, 10, 1),
          captionLayout: "dropdown",
        }),
      ),
    );
    assert.ok(container.querySelector('[aria-label="Go to the Next Month"]'));
    assert.match(
      container.querySelector('select[aria-label="Choose the Month"]')
        .textContent,
      /Nov/,
    );
    await act(async () => setLocale("ko"));
    assert.ok(container.querySelector('[aria-label="다음 달로 이동"]'));
    assert.match(
      container.querySelector('select[aria-label="월 선택"]').textContent,
      /11월/,
    );
    assert.ok(container.querySelector('[aria-label*="2026년"]'));
    await act(async () => setLocale("en"));
    assert.ok(container.querySelector('[aria-label="Go to the Next Month"]'));
  } finally {
    await act(async () => root.unmount());
    container.remove();
    setLocale("en");
  }
});

test("caller calendar locale, labels and formatters take priority over app defaults", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    setLocale("ko");
    await act(async () =>
      root.render(
        React.createElement(Calendar, {
          mode: "single",
          locale: enUS,
          defaultMonth: new Date(2026, 10, 1),
          captionLayout: "dropdown",
          labels: { labelNext: () => "Caller next" },
          formatters: { formatMonthDropdown: () => "Caller month" },
        }),
      ),
    );
    assert.ok(container.querySelector('[aria-label="Caller next"]'));
    assert.match(
      container.querySelector('select[aria-label="Choose the Month"]')
        .textContent,
      /Caller month/,
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    setLocale("en");
  }
});

test("emoji picker production adapter supplies bundled Korean and English dictionaries", () => {
  const korean = emojiPicker.emojiPickerLanguageProps("ko");
  assert.equal(korean.locale, "ko");
  assert.equal(korean.i18n.search, "검색");
  assert.equal(korean.i18n.categories.frequent, "자주 사용하는 항목");
  const english = emojiPicker.emojiPickerLanguageProps("en");
  assert.equal(english.locale, "en");
  assert.equal(english.i18n.search, "Search");
});
