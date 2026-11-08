import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { IdentityRecoveryPairing } from "@/features/onboarding/ui/IdentityRecoveryPairing";
import { setLocale } from "./index.ts";

test("real identity recovery keeps its QR and event listeners across a locale switch", async () => {
  setLocale("en");
  const previous = window.__TAURI_INTERNALS__;
  const previousPlugin = window.__TAURI_EVENT_PLUGIN_INTERNALS__;
  const callbacks = new Map();
  const events = new Map();
  const calls = [];
  let serial = 0;
  window.__TAURI_INTERNALS__ = {
    transformCallback(callback) {
      callbacks.set(++serial, callback);
      return serial;
    },
    async invoke(command, args) {
      calls.push(command);
      if (command === "start_identity_recovery_pairing")
        return "nostr+pair://example/UNCHANGED_PAIRING_TOKEN";
      if (command === "plugin:event|listen") {
        events.set(args.event, args.handler);
        return args.handler;
      }
      return undefined;
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onRecovered = async () => {};
  try {
    await act(async () =>
      root.render(
        React.createElement(IdentityRecoveryPairing, { onRecovered }),
      ),
    );
    const qr = host.querySelector('[data-testid="identity-recovery-qr"]');
    assert.ok(qr);
    const listeners = new Map(events);
    await act(async () => setLocale("ko"));
    assert.equal(
      host.querySelector('[data-testid="identity-recovery-qr"]'),
      qr,
    );
    assert.equal(
      calls.filter((c) => c === "start_identity_recovery_pairing").length,
      1,
    );
    assert.equal(calls.filter((c) => c === "cancel_pairing").length, 0);
    assert.deepEqual(events, listeners);
    assert.match(
      host.querySelector('[data-testid="copy-identity-recovery-code"]')
        .textContent,
      /페어링 코드 복사/,
    );
    await act(async () =>
      callbacks.get(events.get("pairing-aborted"))({
        payload: { reason: "EXTERNAL_REASON" },
      }),
    );
    assert.match(host.textContent, /복구.*중단.*EXTERNAL_REASON/);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    window.__TAURI_INTERNALS__ = previous;
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = previousPlugin;
    setLocale("en");
  }
  assert.equal(calls.filter((c) => c === "cancel_pairing").length, 1);
});
