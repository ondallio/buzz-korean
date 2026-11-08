import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";
import { resolveUserLabel } from "@/features/profile/lib/identity";
import { setLocale, useLocale, localeTag } from "@/shared/i18n";
import { CreateIssueDialog } from "./CreateIssueDialog.tsx";
import { ProjectHomeCommitsPanel } from "./ProjectHomeCommitsPanel.tsx";
import { formatProjectCount } from "../lib/projectDisplayCopy.ts";
import { ProjectEntityListRow } from "./ProjectEntityListRow.tsx";
import { ProjectDiffFilesPanel } from "./ProjectPullRequestFilesChangedPanel.tsx";

const mounted = [];
test.before(() => {
  window.matchMedia = (query) => ({
    media: query,
    matches: false,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  });
});
test.afterEach(async () => {
  for (const { root, element } of mounted.splice(0)) {
    await act(async () => root.unmount());
    element.remove();
  }
  setLocale("en");
});
async function mount(Component, props) {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  mounted.push({ root, element });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let content = React.createElement(Component, props);
  if (Component === CreateIssueDialog)
    content = React.createElement(ThemeProvider, null, content);
  await act(async () =>
    root.render(React.createElement(QueryClientProvider, { client }, content)),
  );
  return element;
}
test("task dialog placeholders update without replacing typed user data or canonical test identifiers", async () => {
  setLocale("en");
  const created = [];
  await mount(CreateIssueDialog, {
    open: true,
    onOpenChange() {},
    onCreate: async (input) => created.push(input),
    isCreating: false,
    projectName: "USER PROJECT API_key",
  });
  const input = document.querySelector('[data-testid="create-issue-title"]');
  const body = document.querySelector('[data-testid="create-issue-body"]');
  assert.equal(input.placeholder, "Describe the task");
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set.call(input, "USER TASK 한국어");
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await act(async () => setLocale("ko"));
  assert.equal(input.placeholder, "작업 내용을 입력하세요");
  assert.equal(body.placeholder, "배경, 예상 동작 또는 재현 단계를 입력하세요");
  assert.equal(input.value, "USER TASK 한국어");
  assert.ok(
    document.querySelector('[data-testid="create-issue-title"]') === input,
  );
  assert.equal(
    document.querySelector('[data-testid="create-issue-submit"]').textContent,
    "작업 만들기",
  );
  await act(async () =>
    document
      .querySelector("#create-issue-form")
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      ),
  );
  assert.deepEqual(created, [
    { title: "USER TASK 한국어", body: "", category: "issue" },
  ]);
});
for (const subjectLabel of ["commit", "review"]) {
  for (const error of [null, new Error("RAW DIAGNOSTIC API_field")]) {
    test(`diff panel translates complete ${subjectLabel} ${error ? "error" : "empty"} message preserving canonical subject`, async () => {
      setLocale("en");
      const props = {
        subjectLabel,
        diff: null,
        error,
        isLoading: false,
        headerLabel: "USER HEADER",
      };
      const view = await mount(ProjectDiffFilesPanel, props);
      assert.match(view.textContent, new RegExp(`this ${subjectLabel}`));
      await act(async () => setLocale("ko"));
      assert.match(
        view.textContent,
        subjectLabel === "commit" ? /커밋/ : /리뷰/,
      );
      assert.doesNotMatch(
        view.textContent,
        /this commit|this review|이 commit|이 review/,
      );
      if (error) assert.match(view.textContent, /RAW DIAGNOSTIC API_field/);
      assert.equal(props.subjectLabel, subjectLabel);
    });
  }
}
test("commit-loading failure suffix localizes as a whole sentence and preserves repository names", async () => {
  setLocale("en");
  const results = ["USER REPO API_key", "SECOND REPO"].map((name) => ({
    repository: { name },
    error: new Error("network unavailable"),
    isLoading: false,
    snapshot: null,
  }));
  const view = await mount(ProjectHomeCommitsPanel, {
    results,
    projectId: "canonical-project-id",
    pullRequests: [],
    onSelectCommit() {},
  });
  assert.match(view.textContent, /other repositor/);
  await act(async () => setLocale("ko"));
  assert.match(view.textContent, /USER REPO API_key/);
  assert.match(view.textContent, /다른 저장소 1개/);
  assert.doesNotMatch(view.textContent, /other repositories/);
});

for (const [kind, korean] of [
  ["message", "메시지 1,234개"],
  ["member", "멤버 1,234명"],
  ["repository", "저장소 1,234개"],
]) {
  test(`actual project row ${kind} title follows locale and preserves its user title and click target`, async () => {
    setLocale("en");
    let clicks = 0;
    function Row() {
      useLocale();
      return React.createElement(ProjectEntityListRow, {
        title: "USER TITLE API_key",
        count: 1234,
        countTitle: formatProjectCount(kind, 1234),
        testId: "row-canonical-id",
        countTestId: "count-canonical-id",
        onClick: () => clicks++,
      });
    }
    const view = await mount(Row, {});
    assert.equal(
      view.querySelector('[data-testid="count-canonical-id"]').title,
      `1,234 ${kind === "repository" ? "repositories" : `${kind}s`}`,
    );
    await act(async () => setLocale("ko"));
    assert.equal(
      view.querySelector('[data-testid="count-canonical-id"]').title,
      korean,
    );
    assert.match(view.textContent, /USER TITLE API_key/);
    await act(async () =>
      view.querySelector('[data-testid="row-canonical-id"]').click(),
    );
    assert.equal(clicks, 1);
  });
}

function discussionNameComponent() {
  const file = new URL("./DiscussionChannels.tsx", import.meta.url);
  const source = ts.createSourceFile(
    file.pathname,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const fn = source.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "DiscussionNameList",
  );
  assert.ok(fn, "actual production name-list renderer exists");
  const maximum = source.statements.find(
    (node) =>
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (decl) => decl.name.getText(source) === "NAME_LIST_MAX",
      ),
  );
  const exports = {};
  const code = ts.transpileModule(
    `${maximum.getText(source)}\n${fn.getText(source)}\nexports.Component=DiscussionNameList;`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    React,
    useAppLocale: useLocale,
    localeTag,
    LocalizedMessage,
    resolveUserLabel,
    UserProfilePopover: ({ children, pubkey }) =>
      React.createElement("span", { "data-original-pubkey": pubkey }, children),
  });
  return exports.Component;
}
for (const count of [3, 5]) {
  test(`production discussion names use the selected language list grammar for ${count} people`, async () => {
    setLocale("en");
    const participants = Array.from({ length: count }, (_, index) =>
      String(index + 1).repeat(64),
    );
    const profiles = Object.fromEntries(
      participants.map((key, index) => [
        key,
        { displayName: ["Commit", "Bob", "Choi", "D", "E"][index] },
      ]),
    );
    const view = await mount(discussionNameComponent(), {
      participants,
      profiles,
    });
    assert.equal(
      view.textContent,
      count === 3 ? "Commit, Bob, and Choi" : "Commit, Bob, and 3 others",
    );
    const button = view.querySelector("button");
    await act(async () => setLocale("ko"));
    assert.equal(
      view.textContent,
      count === 3 ? "Commit, Bob 및 Choi" : "Commit, Bob 및 다른 3명",
    );
    assert.ok(view.querySelector("button") === button);
    assert.equal(
      view
        .querySelector("[data-original-pubkey]")
        .getAttribute("data-original-pubkey"),
      participants[0],
    );
    assert.equal(button.textContent, "Commit");
  });
}
