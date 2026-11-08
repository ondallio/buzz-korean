import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { setLocale, t, useLocale } from "./index.ts";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { LocalizedMessage } from "./LocalizedMessage.tsx";
import {
  ProjectsActivityFeed,
  buildProjectsActivityAgentContextItems,
} from "@/features/projects/ui/ProjectsActivityFeed";

const mounted = [];
test.afterEach(async () => {
  for (const { root, host } of mounted.splice(0)) {
    await act(async () => root.unmount());
    host.remove();
  }
  setLocale("en");
});
async function mount(Component, props) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  await act(async () =>
    root.render(
      React.createElement(
        TooltipProvider,
        null,
        React.createElement(Component, props),
      ),
    ),
  );
  return host;
}
function searchProductionSeam() {
  const source = fs.readFileSync(
    new URL("../../features/search/ui/TopbarSearch.tsx", import.meta.url),
    "utf8",
  );
  const file = ts.createSourceFile(
    "TopbarSearch.tsx",
    source,
    99,
    true,
    ts.ScriptKind.TSX,
  );
  const names = [
    "getSearchHitChannelName",
    "getSearchHitContextLabel",
    "SearchHitContextLine",
  ];
  const declarations = file.statements.filter(
    (node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text),
  );
  assert.equal(declarations.length, names.length);
  const js = ts.transpileModule(
    declarations.map((node) => node.getText(file)).join("\n") +
      "\nexports.classify=getSearchHitContextLabel;exports.Line=SearchHitContextLine;",
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.CommonJS,
      },
    },
  ).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    React,
    LocalizedMessage,
    useAppLocale: useLocale,
    localize: t,
    cn: (...classes) => classes.join(" "),
    MESSAGE_MARKDOWN_CLASS: "",
    MENTION_CHIP_BASE_CLASSES: "",
  });
  return exports;
}

test("actual search classification stays canonical while its complete context line changes language", async () => {
  const { classify, Line } = searchProductionSeam();
  const channels = new Map([
    ["channel-id", { name: "USER_CHANNEL", channelType: "stream" }],
    ["dm-id", { name: "USER_DM", channelType: "dm" }],
  ]);
  for (const [kind, threadRootId, expected] of [
    [9, null, "#USER_CHANNEL 메시지"],
    [45003, "USER_EVENT", "#USER_CHANNEL 스레드"],
  ]) {
    await act(async () => setLocale("en"));
    const hit = {
      channelId: "channel-id",
      kind,
      threadRootId,
      content: "USER_MESSAGE",
    };
    const before = JSON.stringify(hit);
    const label = classify(hit, channels);
    const host = await mount(Line, { label });
    assert.match(host.textContent, /(?:Message|Thread) in #USER_CHANNEL/);
    const chip = host.querySelector("[data-channel-link]");
    await act(async () => setLocale("ko"));
    assert.equal(host.textContent, expected);
    assert.ok(host.querySelector("[data-channel-link]") === chip);
    assert.equal(JSON.stringify(hit), before);
  }
  const direct = classify({ channelId: "dm-id", kind: 9 }, channels);
  const host = await mount(Line, { label: direct });
  assert.equal(host.textContent, "다이렉트 메시지");
});

test("actual project activity translates whole actor/project sentences and badges without translating source context or user data", async () => {
  const now = Math.floor(Date.now() / 1000);
  const project = {
    id: "project-id",
    name: "USER_REPOSITORY",
    owner: "",
    createdAt: now,
    description: "USER_DESCRIPTION",
  };
  const commit = {
    hash: "0123456789abcdef",
    shortHash: "0123456",
    timestamp: now + 1,
    authorName: "USER_AUTHOR",
    subject: "USER_COMMIT",
  };
  const pullRequest = {
    id: "pr-id",
    createdAt: now + 2,
    author: "",
    title: "USER_REVIEW",
    content: "USER_BODY",
    status: "Open",
    updates: [],
    comments: [],
  };
  const input = {
    projects: [project],
    snapshots: { "project-id": { commits: [commit] } },
    issues: [],
    pullRequests: [
      {
        project,
        repository: { id: "repo-id", name: "USER_REPO" },
        pullRequest,
      },
    ],
  };
  setLocale("en");
  const context = buildProjectsActivityAgentContextItems(input);
  const host = await mount(ProjectsActivityFeed, {
    ...input,
    isLoading: false,
    onOpenCommit() {},
    onOpenIssue() {},
    onOpenProject() {},
    onOpenPullRequest() {},
  });
  assert.match(
    host.textContent,
    /created the repository|pushed a commit to|opened a review in/,
  );
  await act(async () => setLocale("ko"));
  const sentences = [
    ...host.querySelectorAll('[data-testid="projects-activity-sentence"]'),
  ].map((node) => node.textContent);
  assert.ok(
    sentences.some((text) =>
      text.includes("USER_AUTHOR님이 USER_REPOSITORY에 커밋을 푸시했습니다"),
    ),
  );
  assert.ok(
    sentences.some((text) =>
      text.includes("USER_REPOSITORY 저장소를 만들었습니다"),
    ),
  );
  assert.ok(
    sentences.some((text) =>
      text.includes("USER_REPOSITORY에서 리뷰를 열었습니다"),
    ),
  );
  assert.doesNotMatch(
    host.textContent,
    /created the repository|pushed a commit to|opened a review in/,
  );
  assert.match(host.textContent, /열림/);
  for (const value of [
    "USER_COMMIT",
    "USER_DESCRIPTION",
    "USER_BODY",
    "0123456",
  ])
    assert.ok(host.textContent.includes(value), value);
  assert.deepEqual(buildProjectsActivityAgentContextItems(input), context);
  const filtered = await mount(ProjectsActivityFeed, {
    ...input,
    isLoading: false,
    searchQuery: "푸시",
    onOpenCommit() {},
    onOpenIssue() {},
    onOpenProject() {},
    onOpenPullRequest() {},
  });
  assert.equal(
    filtered.querySelectorAll('[data-testid="projects-activity-sentence"]')
      .length,
    1,
  );
  assert.match(filtered.textContent, /USER_AUTHOR/);
});
