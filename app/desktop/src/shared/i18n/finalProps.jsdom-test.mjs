import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import * as i18n from "./index.ts";
import { CircleArrowUp, ExternalLink } from "lucide-react";
import { ComposerUploadProgressPill } from "@/features/messages/ui/ComposerUploadProgressPill";
import { EffortSelectField } from "@/features/agents/ui/buzzAgentModelTuningFields";
import { SidebarCompactActionCard } from "@/shared/ui/sidebar-action-card";
import { Spinner } from "@/shared/ui/spinner";

const mounted = [];
test.afterEach(async () => {
  for (const { root, host } of mounted.splice(0)) {
    await act(async () => root.unmount());
    host.remove();
  }
  i18n.setLocale("en");
});
async function mount(Component, props) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  await act(async () => root.render(React.createElement(Component, props)));
  return host;
}
function productionComponent(relativePath, name, bindings) {
  const source = fs.readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
  const file = ts.createSourceFile(
    relativePath,
    source,
    99,
    true,
    ts.ScriptKind.TSX,
  );
  const component = file.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  );
  assert.ok(component, `${name} production declaration`);
  const compiled = ts.transpileModule(component.getText(file), {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    React,
    window,
    useTranslation: i18n.useTranslation,
    useAppTranslation: i18n.useTranslation,
    useLocaleCallback: i18n.useLocaleCallback,
    ...bindings,
  });
  return exports[name];
}

test("effort select translates inherited prose live with the same focused select and unchanged API value", async () => {
  i18n.setLocale("en");
  const updates = [];
  const host = await mount(EffortSelectField, {
    currentEffort: "high",
    inheritedEffort: "API_EFFORT",
    disabled: false,
    effortDefault: "medium",
    effortValid: ["low", "medium", "high"],
    htmlFor: "stable-effort",
    label: "USER_CAPTION",
    testId: "stable-effort",
    onChange: (value) => updates.push(value),
  });
  const select = host.querySelector("select");
  assert.equal(select.options[0].textContent, "Inherit (API_EFFORT)");
  select.focus();
  await act(async () => i18n.setLocale("ko"));
  assert.ok(host.querySelector("select") === select);
  assert.ok(document.activeElement === select);
  assert.equal(select.value, "high");
  assert.equal(select.options[0].textContent, "상속(API_EFFORT)");
  assert.match(host.textContent, /USER_CAPTION/);
  assert.deepEqual(updates, []);
});

test("upload pill default action translates live and remains the same usable cancel button", async () => {
  i18n.setLocale("en");
  let cancelled = 0;
  const host = await mount(ComposerUploadProgressPill, {
    canCancel: true,
    isUploading: true,
    onCancel: () => cancelled++,
    phase: "uploading",
    percentage: 42,
  });
  const button = host.querySelector("button");
  assert.match(button.textContent, /Cancel/);
  await act(async () => i18n.setLocale("ko"));
  assert.ok(host.querySelector("button") === button);
  assert.match(button.textContent, /취소/);
  assert.match(
    host.querySelector('[role="status"]').getAttribute("aria-label"),
    /42%/,
  );
  await act(async () => button.click());
  assert.equal(cancelled, 1);
});

test("production overlay passes translated link-preview labels into the real pill without skipping a job on language change", async () => {
  let skips = 0;
  const Overlay = productionComponent(
    "features/messages/ui/ComposerUploadProgressOverlay.tsx",
    "ComposerUploadProgressOverlay",
    {
      useBackgroundMediaUpload: () => ({
        phase: "preparing",
        percentage: 0,
        canCancel: true,
        isUploading: false,
      }),
      useBackgroundLinkPreviewPreparation: () => ({
        isPreparing: true,
        canSkip: true,
      }),
      ComposerUploadProgressPill,
      skipBackgroundLinkPreviews: () => skips++,
      cancelBackgroundMediaUploads() {},
    },
  );
  i18n.setLocale("en");
  const host = await mount(Overlay);
  const button = host.querySelector("button");
  assert.match(host.textContent, /Preparing link preview/);
  assert.match(button.textContent, /Skip/);
  await act(async () => i18n.setLocale("ko"));
  assert.ok(host.querySelector("button") === button);
  assert.match(host.textContent, /링크 미리보기 준비 중/);
  assert.match(button.textContent, /건너뛰기/);
  assert.equal(skips, 0);
});

test("production updater card supplies translated accessible names to the real sidebar card", async () => {
  const Card = productionComponent(
    "features/settings/SidebarUpdateCard.tsx",
    "SidebarUpdateCompactCard",
    {
      useUpdaterContext: () => ({
        status: { state: "ready" },
        installAndRelaunch: async () => {},
      }),
      SidebarCompactActionCard,
      Spinner,
      CircleArrowUp,
      ExternalLink,
    },
  );
  i18n.setLocale("en");
  const host = await mount(Card, { onDismiss() {} });
  const action = host.querySelector('[aria-label="Update now"]');
  assert.ok(action);
  assert.ok(host.querySelector('[aria-label="Dismiss update notification"]'));
  await act(async () => i18n.setLocale("ko"));
  assert.ok(host.querySelector('[aria-label="지금 업데이트"]') === action);
  assert.ok(host.querySelector('[aria-label="업데이트 알림 닫기"]'));
});

test("actual recipient row keeps its option node and user data during an accessible-name language switch", async () => {
  const { NewMessageResultRow } = await import(
    "@/features/messages/ui/NewMessageResultRow"
  );
  i18n.setLocale("en");
  const user = {
    pubkey: "a".repeat(64),
    displayName: "USER_RECIPIENT",
    avatarUrl: null,
    ownerPubkey: null,
    isAgent: false,
  };
  let selected;
  const host = await mount(NewMessageResultRow, {
    user,
    disabled: false,
    onSelect: (value) => (selected = value),
  });
  const option = host.querySelector('[role="option"]');
  assert.equal(option.getAttribute("aria-label"), "Add USER_RECIPIENT");
  await act(async () => i18n.setLocale("ko"));
  assert.ok(host.querySelector('[role="option"]') === option);
  assert.equal(option.getAttribute("aria-label"), "USER_RECIPIENT 추가");
  await act(async () => option.click());
  assert.equal(selected, user);
});
