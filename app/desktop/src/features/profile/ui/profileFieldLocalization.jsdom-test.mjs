import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { setLocale } from "@/shared/i18n";
import { TooltipProvider } from "@/shared/ui/tooltip";
import {
  bucketProfileFields,
  buildOwnerFields,
  buildPublicFields,
  ProfileFieldRows,
} from "./UserProfilePanelFields.tsx";
registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url.includes("/desktop/src/") && result.source) {
      const source =
        typeof result.source === "string"
          ? result.source
          : new TextDecoder().decode(result.source);
      return {
        ...result,
        source: source.replaceAll(
          "import.meta.env",
          "({ MODE: 'test', DEV: false })",
        ),
      };
    }
    return result;
  },
});
const { ProfileRuntimeTabContent } = await import("./UserProfilePanelTabs.tsx");
const { DiagnosticsFocusedView } = await import(
  "./UserProfilePanelFocusedViews.tsx"
);
const { AgentConfigurationFocusedView } = await import(
  "./UserProfilePanelAgentDetails.tsx"
);
const { settingsNavGroups } = await import(
  "../../settings/ui/SettingsView.tsx"
);

function fields() {
  return [
    ...buildPublicFields({
      isBot: true,
      pubkey: "deadbeef".repeat(8),
      profile: undefined,
      relayAgent: { agentType: "codex-acp", capabilities: ["read", "write"] },
    }),
    ...buildOwnerFields({
      includeOperationalFields: true,
      managedAgent: {
        agentCommand: "codex-acp",
        acpCommand: "codex-acp --stdio",
        mcpCommand: "buzz-dev-mcp",
        backend: { type: "local" },
        status: "error",
        startOnAppLaunch: true,
        lastError: "Connection refused",
      },
      onOpenProfile: undefined,
      ownerDisplayName: "Taylor",
      ownerHandle: null,
      ownerProfilePubkey: null,
      ownerPubkey: null,
      persona: undefined,
      presenceLoaded: false,
      presenceStatus: undefined,
      relayAgent: undefined,
    }),
  ];
}

test("production profile buckets retain every field identity in Korean", () => {
  const byLocale = {};
  try {
    for (const locale of ["en", "ko"]) {
      setLocale(locale);
      byLocale[locale] = Object.fromEntries(
        Object.entries(bucketProfileFields(fields())).map(([key, values]) => [
          key,
          values.map((field) => field.testId),
        ]),
      );
    }
    assert.deepEqual(byLocale.ko, byLocale.en);
    assert.equal(byLocale.ko.agentInfoFields.length, 4);
    assert.equal(byLocale.ko.agentSettingsFields.length, 4);
    assert.equal(byLocale.ko.diagnosticsFields.length, 2);
  } finally {
    setLocale("en");
  }
});

test("profile ordering and runtime controls survive translated field labels", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let toggles = 0;
  const orders = {};
  try {
    for (const locale of ["en", "ko"]) {
      await act(async () => setLocale(locale));
      const buckets = bucketProfileFields(fields());
      await act(async () =>
        root.render(
          createElement(
            TooltipProvider,
            null,
            createElement(ProfileFieldRows, { fields: fields().reverse() }),
          ),
        ),
      );
      orders[locale] = Array.from(host.children).map((el) =>
        el.getAttribute("data-testid"),
      );
      await act(async () =>
        root.render(
          createElement(
            TooltipProvider,
            null,
            createElement(ProfileRuntimeTabContent, {
              archivedInstances: [],
              currentPubkey: null,
              diagnosticsFields: buckets.diagnosticsFields,
              diagnosticsSummary: null,
              configurationFields: buckets.agentSettingsFields,
              instances: [],
              onOpenDiagnostics() {},
              onOpenInstance() {},
              onToggleStartOnLaunch() {
                toggles++;
              },
              showDiagnosticsIngress: false,
            }),
          ),
        ),
      );
      assert.ok(
        host.querySelector('[data-testid="user-profile-agent-status"]'),
      );
      const control = host.querySelector(
        '[data-testid="user-profile-start-on-launch"]',
      );
      assert.equal(control?.getAttribute("role"), "switch");
      assert.equal(control?.getAttribute("aria-checked"), "true");
      await act(async () => control.click());
      await act(async () =>
        root.render(
          createElement(
            TooltipProvider,
            null,
            createElement(DiagnosticsFocusedView, {
              canOpenAgentLogs: false,
              fields: buckets.diagnosticsFields,
              logContent: null,
              logError: null,
              logLoading: false,
              managedAgent: undefined,
            }),
          ),
        ),
      );
      assert.equal(
        host
          .querySelector('[data-testid="user-profile-last-error"]')
          ?.getAttribute("role"),
        "alert",
      );
      assert.ok(host.textContent.includes("Connection refused"));
      await act(async () =>
        root.render(
          createElement(
            TooltipProvider,
            null,
            createElement(AgentConfigurationFocusedView, {
              fields: buckets.agentSettingsFields,
            }),
          ),
        ),
      );
      assert.ok(host.querySelector('[data-testid="user-profile-runtime"]'));
      assert.ok(host.querySelector('[data-testid="user-profile-acp"]'));
    }
    assert.deepEqual(orders.ko, orders.en);
    assert.deepEqual(orders.en, [
      "user-profile-public-key",
      "user-profile-managed-by",
      "user-profile-last-error",
      "user-profile-mcp",
      "user-profile-acp",
      "user-profile-runtime",
      "user-profile-capabilities",
      "user-profile-agent-type",
      "user-profile-agent-status",
      "user-profile-start-on-launch",
    ]);
    assert.equal(toggles, 2);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    setLocale("en");
  }
});

test("settings navigation groups have locale-independent identities", () => {
  const groups = {};
  try {
    for (const locale of ["en", "ko"]) {
      setLocale(locale);
      groups[locale] = settingsNavGroups.map(({ id }) => id);
    }
    assert.deepEqual(groups.en, ["personal", "communities", "app"]);
    assert.deepEqual(groups.ko, groups.en);
  } finally {
    setLocale("en");
  }
});
