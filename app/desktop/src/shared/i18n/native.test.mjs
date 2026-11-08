import assert from "node:assert/strict";
import test from "node:test";
import {
  getNativeLocaleSyncStatus,
  retryNativeLocaleSync,
  startNativeLocaleSync,
} from "./native.ts";
import { initializeLocale, setLocale } from "./store.ts";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function nativeEnvironment(invoke, native = true) {
  const previousWindow = globalThis.window;
  const previousTauri = globalThis.isTauri;
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    navigator: { language: "en-US" },
    addEventListener() {},
    removeEventListener() {},
    __TAURI_INTERNALS__: { invoke },
  };
  globalThis.isTauri = native;
  initializeLocale();
  return () => {
    globalThis.window = previousWindow;
    globalThis.isTauri = previousTauri;
  };
}

test("failed native language remains visible and retries only on explicit request", async () => {
  let attempts = 0;
  const restore = nativeEnvironment(async (command, args) => {
    assert.equal(command, "set_desktop_locale");
    assert.deepEqual(args, { locale: "ko" });
    attempts += 1;
    if (attempts === 1) throw new Error("native unavailable");
  });
  let stop;
  try {
    setLocale("ko");
    stop = startNativeLocaleSync();
    await tick();
    assert.deepEqual(getNativeLocaleSyncStatus(), {
      state: "error",
      locale: "ko",
      error: "Error: native unavailable",
    });
    assert.equal(attempts, 1);
    retryNativeLocaleSync();
    await tick();
    assert.deepEqual(getNativeLocaleSyncStatus(), {
      state: "synced",
      locale: "ko",
    });
    assert.equal(attempts, 2);
    retryNativeLocaleSync();
    await tick();
    assert.equal(attempts, 2);
  } finally {
    stop?.();
    restore();
  }
});

test("rapid language changes serialize IPC and reject stale success as current state", async () => {
  const requests = [];
  const completions = [];
  const restore = nativeEnvironment((command, args) => {
    requests.push({ command, ...args });
    return new Promise((resolve) => completions.push(resolve));
  });
  let stop;
  try {
    stop = startNativeLocaleSync();
    setLocale("ko");
    retryNativeLocaleSync();
    assert.equal(requests.length, 1);
    assert.deepEqual(getNativeLocaleSyncStatus(), {
      state: "pending",
      locale: "ko",
    });
    completions[0]();
    await tick();
    assert.equal(requests.length, 2);
    assert.equal(requests[1].locale, "ko");
    assert.deepEqual(getNativeLocaleSyncStatus(), {
      state: "pending",
      locale: "ko",
    });
    completions[1]();
    await tick();
    assert.deepEqual(getNativeLocaleSyncStatus(), {
      state: "synced",
      locale: "ko",
    });
  } finally {
    stop?.();
    restore();
  }
});

test("browser-only execution exposes unsupported native projection without IPC", async () => {
  let attempts = 0;
  const restore = nativeEnvironment(async () => {
    attempts += 1;
  }, false);
  const stop = startNativeLocaleSync();
  try {
    setLocale("ko");
    await tick();
    assert.deepEqual(getNativeLocaleSyncStatus(), { state: "unsupported" });
    assert.equal(attempts, 0);
  } finally {
    stop();
    restore();
  }
});
