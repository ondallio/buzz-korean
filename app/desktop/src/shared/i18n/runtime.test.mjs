import assert from "node:assert/strict";
import test from "node:test";

const runtime = await import("./index.ts");

test("locale runtime exposes the production translation API", () => {
  assert.equal(typeof runtime.setLocale, "function");
  assert.equal(typeof runtime.translateMessage, "function");
});

test("translation validates named values and preserves unknown English messages", () => {
  assert.equal(
    runtime.translateMessage(
      "ko",
      { "Hello {name}": "안녕하세요 {name}" },
      "Hello {name}",
      { name: "Taylor" },
    ),
    "안녕하세요 Taylor",
  );
  assert.equal(
    runtime.translateMessage("ko", {}, "Unknown {value}", { value: 3 }),
    "Unknown 3",
  );
  assert.equal(
    runtime.translateMessage("ko", {}, "constructor"),
    "constructor",
  );
  assert.throws(
    () => runtime.translateMessage("ko", {}, "Hello {name}"),
    /name/,
  );
  assert.deepEqual(
    runtime.validateCatalog({ "Hello {name}": "안녕하세요 {person}" }),
    ["Hello {name}: placeholder mismatch"],
  );
  assert.throws(
    () =>
      runtime.translateMessage(
        "ko",
        { "Hello {name}": "안녕하세요 {person}" },
        "Hello {name}",
        { name: "Taylor" },
      ),
    /placeholder mismatch/,
  );
});

test("locale switching works for non-React helpers without a browser", () => {
  runtime.setLocale("ko");
  assert.equal(runtime.getLocale(), "ko");
  assert.equal(runtime.localeTag(), "ko-KR");
  runtime.setLocale("en");
  assert.equal(runtime.getLocale(), "en");
});

test("OS Korean locale is selected only without a valid explicit preference", () => {
  assert.equal(runtime.resolveLocale(null, "ko-KR"), "ko");
  assert.equal(runtime.resolveLocale("en", "ko-KR"), "en");
  assert.equal(runtime.resolveLocale("invalid", "en-US"), "en");
  assert.equal(runtime.resolveLocale(undefined, undefined), "en");
});

test("non-browser preview windows can format copy without event or navigator APIs", () => {
  const previous = globalThis.window;
  globalThis.window = { localStorage: { getItem: () => null } };
  try {
    assert.doesNotThrow(() => runtime.initializeLocale());
    assert.equal(runtime.t("Cancel"), "Cancel");
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
    runtime.initializeLocale();
  }
});
