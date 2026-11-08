import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, memo, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

const runtime = await import("./index.ts");
const { LanguageSettings } = await import(
  "../../features/settings/ui/LanguageSettings.tsx"
);

test("failed storage leaves the live locale and document language unchanged", () => {
  window.localStorage.clear();
  runtime.initializeLocale();
  runtime.setLocale("en");
  const original = window.Storage.prototype.setItem;
  window.Storage.prototype.setItem = () => {
    throw new Error("Storage blocked");
  };
  try {
    assert.throws(() => runtime.setLocale("ko"), /Storage blocked/);
    assert.equal(runtime.getLocale(), "en");
    assert.equal(document.documentElement.lang, "en");
  } finally {
    window.Storage.prototype.setItem = original;
  }
});

test("storage events synchronize the document language from another window", () => {
  runtime.setLocale("en");
  window.localStorage.setItem(runtime.LOCALE_STORAGE_KEY, "ko");
  window.dispatchEvent(
    new window.StorageEvent("storage", {
      key: runtime.LOCALE_STORAGE_KEY,
      newValue: "ko",
      storageArea: window.localStorage,
    }),
  );
  assert.equal(runtime.getLocale(), "ko");
  assert.equal(document.documentElement.lang, "ko");
  runtime.initializeLocale();
  assert.equal(runtime.getLocale(), "ko");
  runtime.setLocale("en");
});

test("memoized components update language without losing mounted state", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const Example = memo(function Example() {
    const { locale } = runtime.useTranslation();
    const [draft, setDraft] = useState("unsent 한국어");
    return createElement(
      "button",
      { onClick: () => setDraft("edited draft"), type: "button" },
      `${locale}: ${draft}`,
    );
  });
  try {
    await act(async () => root.render(createElement(Example)));
    await act(async () => host.querySelector("button").click());
    await act(async () => runtime.setLocale("ko"));
    assert.equal(host.textContent, "ko: edited draft");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    runtime.setLocale("en");
  }
});

test("language picker switches language and visibly reports persistence failure", async () => {
  runtime.setLocale("en");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const original = window.Storage.prototype.setItem;
  try {
    await act(async () => root.render(createElement(LanguageSettings)));
    const select = host.querySelector("select");
    assert.equal(host.querySelector("label").textContent, "Language");
    await act(async () => {
      select.value = "ko";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert.equal(runtime.getLocale(), "ko");
    assert.equal(window.localStorage.getItem(runtime.LOCALE_STORAGE_KEY), "ko");
    window.Storage.prototype.setItem = () => {
      throw new Error("Storage blocked");
    };
    await act(async () => {
      select.value = "en";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert.equal(runtime.getLocale(), "ko");
    assert.ok(host.querySelector('[role="alert"]').textContent.trim());
    assert.equal(select.value, "ko");
  } finally {
    window.Storage.prototype.setItem = original;
    await act(async () => root.unmount());
    host.remove();
    runtime.setLocale("en");
  }
});

test("locale changes refresh memoized labels and retained callbacks without restarting their lifecycle", async () => {
  runtime.setLocale("en");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let starts = 0;
  let stops = 0;
  let delivered = "";
  let retained;
  function Connected() {
    const { t } = runtime.useTranslation();
    const callback = runtime.useLocaleCallback(() => {
      delivered = t("Retry");
    }, [t]);
    const label = runtime.useLocaleMemo(() => t("Language"), [t]);
    useEffect(() => {
      starts++;
      retained = callback;
      return () => {
        stops++;
      };
    }, [callback]);
    return createElement("span", null, label);
  }
  try {
    await act(async () => root.render(createElement(Connected)));
    const first = retained;
    await act(async () => runtime.setLocale("ko"));
    assert.equal(
      starts,
      1,
      "language changes must not restart a connection effect",
    );
    assert.equal(stops, 0);
    assert.equal(retained, first);
    retained();
    assert.equal(delivered, "다시 시도");
    assert.equal(host.textContent, "언어");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    runtime.setLocale("en");
  }
  assert.equal(stops, 1);
});
