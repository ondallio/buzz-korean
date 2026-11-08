import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { initializeLocale, setLocale } from "./store.ts";

test("scheduled emoji prewarm reads the current language and supplies bundled translations", async () => {
  const previousWindow = globalThis.window;
  const previousInit = globalThis.__BUZZ_TEST_EMOJI_MART_INIT__;
  const values = new Map([["emoji-mart.frequently", "{}"]]);
  const calls = [];
  let idleCallback;
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    navigator: { language: "en-US" },
    addEventListener() {},
    removeEventListener() {},
    requestIdleCallback(callback) {
      idleCallback = callback;
      return 1;
    },
  };
  globalThis.__BUZZ_TEST_EMOJI_MART_INIT__ = (options) => {
    calls.push(options);
    return Promise.resolve();
  };
  try {
    initializeLocale();
    await import("@/features/custom-emoji/ui/emojiMartPrewarm");
    assert.equal(calls.length, 0);
    assert.equal(values.has("emoji-mart.frequently"), false);
    assert.equal(typeof idleCallback, "function");
    setLocale("ko");
    idleCallback();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].locale, "ko");
    assert.equal(calls[0].i18n.search, "검색");
    assert.ok(calls[0].data.emojis);
  } finally {
    setLocale("en");
    globalThis.window = previousWindow;
    globalThis.__BUZZ_TEST_EMOJI_MART_INIT__ = previousInit;
    initializeLocale();
  }
});

test("idle prewarm preserves a picker that initialized before the callback", () => {
  const source = readFileSync(
    new URL(
      "../../features/custom-emoji/ui/emojiMartPrewarm.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  let idleCallback;
  let initCalls = 0;
  const activePickerData = { categories: [{ id: "custom", name: "My emoji" }] };
  const emojiMart = {
    Data: undefined,
    init: () => {
      initCalls++;
    },
  };
  const language = { getLocale: () => "ko" };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(id) {
      if (id === "emoji-mart") return emojiMart;
      if (id === "@/shared/i18n/store") return language;
      return {};
    },
    window: {
      localStorage: { getItem: () => null },
      requestIdleCallback(callback) {
        idleCallback = callback;
      },
    },
  });
  // Simulate the real library's exported Data binding becoming populated when
  // the user opens the picker while the scheduled idle task is still pending.
  emojiMart.Data = activePickerData;
  idleCallback();
  assert.equal(initCalls, 0);
  assert.equal(emojiMart.Data, activePickerData);
  assert.equal(emojiMart.Data.categories[0].name, "My emoji");
});
