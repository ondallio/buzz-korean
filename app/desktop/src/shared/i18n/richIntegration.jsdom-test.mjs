import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import * as React from "react";
import { createRoot } from "react-dom/client";
import ts from "typescript";
import { Plus } from "lucide-react";
import { JoinPolicyNotice } from "../../features/onboarding/ui/JoinPolicyNotice.tsx";
import { EnvVarsEditor } from "../../features/agents/ui/EnvVarsEditor.tsx";
import { LocalizedMessage } from "./LocalizedMessage.tsx";
import * as i18n from "./index.ts";
import * as formatters from "./formatters.ts";
import { truncatePubkey } from "../lib/pubkey.ts";

const mounted = [];
test.afterEach(async () => {
  for (const { root, container } of mounted.splice(0)) {
    await React.act(async () => root.unmount());
    container.remove();
  }
  i18n.setLocale("en");
});
async function mount(Component, props = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  await React.act(async () =>
    root.render(React.createElement(Component, props)),
  );
  return container;
}
function productionSource(relativePath) {
  const path = new URL(`../../features/${relativePath}`, import.meta.url);
  return ts.createSourceFile(
    path.pathname,
    fs.readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}
function sourceMessage(relativePath, needle, bindings) {
  const file = productionSource(relativePath);
  let expression;
  function visit(node) {
    if (
      ts.isJsxSelfClosingElement(node) &&
      node.tagName.getText(file) === "LocalizedMessage" &&
      node.getText(file).includes(needle)
    ) {
      assert.equal(
        expression,
        undefined,
        `unique rendered message containing ${needle}`,
      );
      expression = node.getText(file);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(expression, `production message containing ${needle} exists`);
  const exports = {};
  const compiled = ts.transpileModule(
    `exports.Render = () => (${expression});`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(compiled, {
    exports,
    React,
    LocalizedMessage,
    localize: i18n.t,
    ...bindings,
  });
  return exports.Render;
}
function sourceComponent(relativePath, name) {
  const file = productionSource(relativePath);
  const declaration = file.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  );
  assert.ok(declaration, `production component ${name} exists`);
  const exports = {};
  const compiled = ts.transpileModule(
    `${declaration.getText(file)}\nexports.Component = ${name};`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(compiled, {
    exports,
    React,
    LocalizedMessage,
    Plus,
    localize: i18n.t,
    useAppLocale: i18n.useLocale,
    useAppTranslation: i18n.useTranslation,
  });
  return exports.Component;
}

for (const [terms, privacy, expected] of [
  [
    "terms",
    "privacy",
    "Buzz 서비스 이용약관 및 개인정보 처리방침에 동의합니다.",
  ],
  ["terms", null, "Buzz 서비스 이용약관에 동의합니다."],
  [null, "privacy", "Buzz 개인정보 처리방침에 동의합니다."],
]) {
  test(`join consent whole conjunction terms=${Boolean(terms)} privacy=${Boolean(privacy)}`, async () => {
    i18n.setLocale("ko");
    const view = await mount(JoinPolicyNotice, {
      ageConfirmed: false,
      agreementConfirmed: false,
      onAgeConfirmedChange: () => {},
      onAgreementConfirmedChange: () => {},
      policy: {
        ageAttestationRequired: false,
        termsMarkdown: terms,
        privacyMarkdown: privacy,
      },
      relayWsUrl: "wss://example.test",
    });
    assert.equal(view.querySelector("label").textContent, expected);
    assert.equal(
      view.querySelector("label").querySelectorAll('button[type="button"]')
        .length,
      Number(Boolean(terms)) + Number(Boolean(privacy)),
    );
    await React.act(async () => i18n.setLocale("en"));
    assert.equal(
      view.querySelector("label").textContent,
      `I agree to the Buzz ${terms ? "Terms of Service" : ""}${terms && privacy ? " and " : ""}${privacy ? "Privacy Policy" : ""}.`,
    );
  });
}
test("create-channel sentence reorders the actual emphasized user query", async () => {
  i18n.setLocale("ko");
  const Component = sourceComponent(
    "channels/ui/ChannelBrowserDialog.tsx",
    "CreateChannelRow",
  );
  let clicked = 0;
  const view = await mount(Component, {
    entityLabel: "channel",
    query: "나의 문서",
    isSelected: false,
    onClick: () => clicked++,
  });
  assert.equal(view.textContent, "“나의 문서” 채널 만들기");
  assert.equal(view.querySelector(".font-semibold").textContent, "“나의 문서”");
  await React.act(async () => i18n.setLocale("en"));
  assert.equal(view.textContent, "Create channel “나의 문서”");
  await React.act(async () => view.querySelector("button").click());
  assert.equal(clicked, 1);
});
for (const overridden of [false, true]) {
  test(`environment inheritance whole clause overridden=${overridden}`, async () => {
    i18n.setLocale("ko");
    const view = await mount(EnvVarsEditor, {
      value: overridden ? { OPENAI_API_KEY: "" } : {},
      onChange: () => {},
      requiredKeys: ["OPENAI_API_KEY"],
      inheritedFrom: { OPENAI_API_KEY: "sk-private-secret-1234" },
      inheritedLabel: "global",
    });
    const notice = [...view.querySelectorAll("p")].find((p) =>
      p.querySelector(".font-mono"),
    );
    assert.ok(notice);
    assert.equal(
      notice.textContent,
      `전역 설정의 값 ••••1234을(를) ${overridden ? "덮어씁니다" : "사용합니다"}.`,
    );
    assert.ok(!view.textContent.includes("private-secret"));
    assert.equal(notice.querySelector(".font-mono").textContent, "••••1234");
  });
}
for (const kind of ["ban", "timeout"]) {
  test(`staff restriction ${kind} translates the whole action`, async () => {
    i18n.setLocale("ko");
    const pendingLift = {
      kind,
      pubkey: "a".repeat(64),
      communityHost: "community.example",
    };
    const Component = sourceMessage(
      "admin-console/AdminConsoleStaffingTab.tsx",
      "They will be able to post again",
      { pendingLift, truncatePubkey },
    );
    const view = await mount(Component);
    assert.equal(
      view.textContent,
      `community.example에서 ${truncatePubkey(pendingLift.pubkey)}의 ${kind === "ban" ? "차단" : "타임아웃"}을 해제합니다. 다시 게시할 수 있게 됩니다.`,
    );
    assert.equal(view.querySelector("code").textContent, "community.example");
    await React.act(async () => i18n.setLocale("en"));
    assert.equal(
      view.textContent,
      `This will ${kind === "ban" ? "remove the active ban" : "clear the active timeout"} for ${truncatePubkey(pendingLift.pubkey)} in community.example. They will be able to post again.`,
    );
  });
}
for (const scoped of [false, true]) {
  for (const scopeLabel of [null, "#general"]) {
    test(`search empty scope grammar channelRestriction=${scoped} scope=${scopeLabel}`, async () => {
      i18n.setLocale("ko");
      const Component = sourceMessage(
        "search/ui/TopbarSearch.tsx",
        "No messages for",
        {
          scopeChannel: scoped ? {} : null,
          scopeLabel,
          trimmedQuery: "문서 찾기",
        },
      );
      const view = await mount(Component);
      assert.equal(
        view.textContent,
        `${scopeLabel ? `${scopeLabel}에서 ` : ""}문서 찾기에 해당하는 ${scoped ? "메시지" : "결과"}가 없습니다.`,
      );
      assert.equal(
        view.querySelectorAll(".font-semibold").length,
        scopeLabel ? 2 : 1,
      );
      await React.act(async () => i18n.setLocale("en"));
      assert.equal(
        view.textContent,
        `No ${scoped ? "messages" : "matches"} for 문서 찾기${scopeLabel ? ` in ${scopeLabel}` : ""}.`,
      );
    });
  }
}
for (const sourceCommit of [null, "1234567890abcdef"]) {
  test(`branch description preserves branch and commit withCommit=${Boolean(sourceCommit)}`, async () => {
    i18n.setLocale("ko");
    const Component = sourceMessage(
      "projects/ui/ProjectBranchDialogs.tsx",
      "Create a remote branch from",
      { sourceBranch: "feature/나의-문서", sourceCommit },
    );
    const view = await mount(Component);
    assert.equal(
      view.textContent,
      sourceCommit
        ? "feature/나의-문서 브랜치의 커밋 1234567에서 원격 브랜치를 만듭니다."
        : "feature/나의-문서 브랜치에서 원격 브랜치를 만듭니다.",
    );
    assert.equal(
      view.querySelector(".font-mono").textContent,
      "feature/나의-문서",
    );
    await React.act(async () => i18n.setLocale("en"));
    assert.equal(
      view.textContent,
      `Create a remote branch from feature/나의-문서${sourceCommit ? " at 1234567" : ""}.`,
    );
  });
}
test("search relative times execute production logic with the active language", () => {
  const file = productionSource("search/ui/TopbarSearch.tsx");
  const declarations = file.statements.filter(
    (node) =>
      (ts.isFunctionDeclaration(node) &&
        node.name?.text === "formatRelativeTime") ||
      (ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(
          (declaration) =>
            declaration.name.getText(file) === "searchDateFormatter",
        )),
  );
  assert.equal(declarations.length, 2);
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      `${declarations.map((node) => node.getText(file)).join("\n")}\nexports.format = formatRelativeTime;`,
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    { exports, localize: i18n.t, ...formatters },
  );
  const now = Math.floor(Date.now() / 1000);
  assert.equal(exports.format(now - 180), "3m ago");
  i18n.setLocale("ko");
  assert.equal(exports.format(now - 30), "방금");
  assert.equal(exports.format(now - 180), "3분 전");
  assert.equal(exports.format(now - 7200), "2시간 전");
  assert.equal(exports.format(now - 172800), "2일 전");
  assert.match(exports.format(now - 1209600), /\d+월 \d+일/);
});
