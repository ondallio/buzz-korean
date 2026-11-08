import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as React from "react";
import { setLocale, t } from "./index.ts";

// Bind the real conditional JSX expression and choose its original state branch.
// The test does not reproduce the translated implementation in a helper.
function displayBranch(path, message, bindings) {
  const file = ts.createSourceFile(
    path,
    fs.readFileSync(new URL(`../../features/${path}`, import.meta.url), "utf8"),
    99,
    true,
    ts.ScriptKind.TSX,
  );
  let expression;
  function visit(node) {
    if (ts.isStringLiteralLike(node) && node.text === message) {
      let parent = node.parent;
      while (parent && !ts.isJsxExpression(parent)) parent = parent.parent;
      if (
        parent?.expression &&
        Object.keys(bindings).every((key) =>
          parent.expression.getText(file).includes(key),
        )
      ) {
        assert.equal(expression, undefined, `one production branch ${message}`);
        expression = parent.expression.getText(file);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(expression, `production branch ${message}`);
  const compiled = ts.transpileModule(`exports.result=(${expression});`, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, React, localize: t, ...bindings });
  return exports.result;
}

test("reviewed saving/recovery/upload/reopen conditional branches render selected language", () => {
  const cases = [
    [
      "agents/ui/AgentConfigFields.tsx",
      "Set in runtime config",
      { apiKeyFileSatisfied: true },
      "런타임 설정에 지정됨",
    ],
    [
      "agents/ui/AgentConfigFields.tsx",
      "Provided by this build",
      { apiKeyFileSatisfied: false },
      "이 빌드에서 제공됨",
    ],
    [
      "agents/ui/AgentConfigFields.tsx",
      "We couldn’t validate this API key. Check the key or your connection and try again.",
      { apiKeyValidationFailed: true },
      "이 API 키를 검증하지 못했습니다. 키 또는 연결을 확인한 다음 다시 시도해 주세요.",
    ],
    [
      "admin-console/AdminConsoleSettingsCard.tsx",
      "Save",
      { isSaving: false },
      "저장",
    ],
    [
      "onboarding/ui/MachineOnboardingFlow.tsx",
      "Enter your backup password to restore your identity.",
      { keyImportStage: "backup-password" },
      "신원을 복구하려면 백업 비밀번호를 입력해 주세요.",
    ],
    [
      "profile/ui/AvatarUpload.tsx",
      "Uploading...",
      { isUploading: true },
      "업로드 중...",
    ],
    [
      "profile/ui/ProfileAvatarEditor.tsx",
      "Uploading...",
      { isUploading: true },
      "업로드 중...",
    ],
    [
      "profile/ui/ProfileAvatarEditor.tsx",
      "Drop image here",
      { isUploading: false, isImageDropActive: true },
      "여기에 이미지를 끌어 놓으세요",
    ],
    [
      "profile/ui/ProfileAvatarEditor.tsx",
      "Drag or browse",
      { isUploading: false, isImageDropActive: false, isOnboardingModal: true },
      "끌어 놓거나 파일 선택",
    ],
    [
      "admin-console/AdminConsoleReportsTab.tsx",
      "Cancel & reopen",
      { isWorking: false },
      "취소하고 다시 열기",
    ],
    [
      "admin-console/AdminConsoleReportsTab.tsx",
      "Reopen report",
      { isSubmitting: false },
      "신고 다시 열기",
    ],
  ];
  try {
    for (const [path, source, bindings, korean] of cases) {
      setLocale("en");
      assert.equal(displayBranch(path, source, bindings), source);
      setLocale("ko");
      assert.equal(displayBranch(path, source, bindings), korean);
    }
  } finally {
    setLocale("en");
  }
});
