import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent } from "@testing-library/react";
import { setLocale } from "@/shared/i18n";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { SetStatusDialog } from "./SetStatusDialog.tsx";

test("status duration tokens survive live language switching and save the original expiration", async () => {
  window.matchMedia ??= (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } },
  });
  client.setQueryData(["custom-emoji"], []);
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const expiration = Math.floor(midnight.getTime() / 1000);
  let saved;
  try {
    setLocale("ko");
    await act(async () =>
      root.render(
        React.createElement(
          QueryClientProvider,
          { client },
          React.createElement(
            ThemeProvider,
            { defaultTheme: "buzz" },
            React.createElement(SetStatusDialog, {
              open: true,
              onOpenChange() {},
              initialText: "Working remotely",
              initialExpiresAt: expiration,
              initialUpdatedAt: Math.floor(now.getTime() / 1000),
              hasExistingStatus: true,
              onSave: (value) => {
                saved = value;
              },
              onClear() {},
            }),
          ),
        ),
      ),
    );
    const duration = document.querySelector(
      '[data-testid="set-status-duration"]',
    );
    assert.match(duration.textContent, /오늘/);
    const input = document.querySelector('[data-testid="set-status-input"]');
    assert.equal(input.value, "Working remotely");
    await act(async () => setLocale("en"));
    assert.match(duration.textContent, /Today/);
    await act(async () => setLocale("ko"));
    await act(async () =>
      fireEvent.change(input, { target: { value: "수정한 상태" } }),
    );
    await act(async () =>
      document.querySelector('[data-testid="set-status-save"]').click(),
    );
    assert.equal(saved.text, "수정한 상태");
    assert.equal(saved.expiresAt, expiration);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    client.clear();
    setLocale("en");
  }
});
