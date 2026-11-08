import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { setLocale } from "@/shared/i18n";
import { InviteRedeemForm } from "./InviteRedeemForm.tsx";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

for (const guard of ["age", "terms"]) {
  test(`real invite ${guard} guard feedback changes language without resetting policy input or consent`, async () => {
    const originalFetch = globalThis.fetch;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const invite = "https://relay.example/invite/USER_INVITE_CODE";
    const fetches = [];
    let redeemed = 0;
    globalThis.fetch = async (url) => {
      fetches.push(String(url));
      assert.equal(String(url), "https://relay.example/api/join-policy");
      return new Response(
        JSON.stringify({
          policy: {
            age_attestation_required: true,
            terms_markdown: "USER_TERMS",
            privacy_markdown: "USER_PRIVACY",
            version: "policy-v1",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    try {
      setLocale("en");
      await act(async () =>
        root.render(
          React.createElement(InviteRedeemForm, {
            initialValue: invite,
            error: null,
            isRedeeming: false,
            onCancel() {},
            onRedeem() {
              redeemed++;
            },
          }),
        ),
      );
      await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
      const input = host.querySelector('[data-testid="invite-redeem-input"]');
      const form = host.querySelector("form");
      const age = host.querySelector('[role="checkbox"]');
      assert.ok(input && form && age);
      if (guard === "terms") await act(async () => age.click());
      // Exercise the production form-submit guard, including non-button submit paths.
      await act(async () =>
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
      );
      const english =
        guard === "age"
          ? "Confirm that you are at least 18 years old."
          : "Agree to the Terms of Service and Privacy Policy.";
      const korean =
        guard === "age"
          ? "만 18세 이상인지 확인하세요."
          : "이용약관과 개인정보 처리방침에 동의해 주세요.";
      assert.ok(host.textContent.includes(english), host.textContent);
      const requestCount = fetches.length;
      await act(async () => setLocale("ko"));
      assert.ok(
        host.textContent.includes(korean),
        "retained feedback projects into Korean immediately",
      );
      await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
      assert.ok(host.textContent.includes(korean), host.textContent);
      assert.ok(!host.textContent.includes(english));
      assert.ok(
        host.querySelector('[data-testid="invite-redeem-input"]') === input,
      );
      assert.equal(input.value, invite);
      assert.ok(host.querySelector('[role="checkbox"]') === age);
      assert.equal(
        age.getAttribute("aria-checked"),
        guard === "terms" ? "true" : "false",
      );
      assert.equal(
        fetches.length,
        requestCount,
        "language switching does not refetch/reset policy discovery",
      );
      assert.equal(redeemed, 0);
    } finally {
      await act(async () => root.unmount());
      host.remove();
      globalThis.fetch = originalFetch;
      setLocale("en");
    }
  });
}
