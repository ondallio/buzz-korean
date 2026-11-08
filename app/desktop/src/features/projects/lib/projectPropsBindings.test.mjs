import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { setLocale, t } from "@/shared/i18n";
import { formatProjectCount } from "./projectDisplayCopy.ts";

function productionProp(file, prop, bindings) {
  const url = new URL(`../ui/${file}`, import.meta.url);
  const source = ts.createSourceFile(
    url.pathname,
    fs.readFileSync(url, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let value;
  function visit(node) {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(source) === prop &&
      node.initializer
    ) {
      assert.equal(value, undefined, `unique production ${file} ${prop}`);
      const initializer = node.initializer;
      value = ts.isJsxExpression(initializer)
        ? initializer.expression.getText(source)
        : initializer.getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(value, `actual ${file} ${prop} producer exists`);
  const context = { localize: t, formatProjectCount, ...bindings };
  vm.runInNewContext(`globalThis.result = (${value});`, context);
  return context.result;
}
test.afterEach(() => setLocale("en"));
for (const [file, prop, bindings, english, korean] of [
  [
    "DiscussionChannels.tsx",
    "countTitle",
    { channel: { messageCount: 1234 }, isTruncated: true },
    "1,234+ messages",
    "메시지 1,234개 이상",
  ],
  [
    "ProjectsChannelsList.tsx",
    "countTitle",
    { channel: { memberCount: 1234 } },
    "1,234 members",
    "멤버 1,234명",
  ],
  [
    "ProjectCards.tsx",
    "affiliationTitle",
    { repositoryCount: 1234 },
    "1,234 repositories",
    "저장소 1,234개",
  ],
  [
    "ProjectEntityListRow.tsx",
    "triggerAriaLabel",
    { label: "USER API_key" },
    "View USER API_key's profile",
    "USER API_key님의 프로필 보기",
  ],
]) {
  test(`actual ${file} ${prop} producer localizes complete copy and keeps data`, () => {
    assert.equal(productionProp(file, prop, bindings), english);
    setLocale("ko");
    assert.equal(productionProp(file, prop, bindings), korean);
  });
}
test("commit header fallback is localized while user subjects and hash remain exact", () => {
  const values = { commit: null, shortHash: "deadbee" };
  assert.equal(
    productionProp("ProjectCommitDetailPanel.tsx", "headerLabel", values),
    "Commit · deadbee",
  );
  setLocale("ko");
  assert.equal(
    productionProp("ProjectCommitDetailPanel.tsx", "headerLabel", values),
    "커밋 · deadbee",
  );
  assert.equal(
    productionProp("ProjectCommitDetailPanel.tsx", "headerLabel", {
      ...values,
      commit: { subject: "Commit USER TITLE" },
    }),
    "Commit USER TITLE · deadbee",
  );
});
test("review header fallback is localized while the user title and commit stay raw", () => {
  const pullRequest = { title: "Review USER TITLE", commit: null };
  assert.equal(
    productionProp("ProjectPullRequestFilesChangedPanel.tsx", "headerLabel", {
      pullRequest,
    }),
    "Review USER TITLE · Review",
  );
  setLocale("ko");
  assert.equal(
    productionProp("ProjectPullRequestFilesChangedPanel.tsx", "headerLabel", {
      pullRequest,
    }),
    "Review USER TITLE · 리뷰",
  );
  assert.equal(
    productionProp("ProjectPullRequestFilesChangedPanel.tsx", "headerLabel", {
      pullRequest: { ...pullRequest, commit: "deadbeef123" },
    }),
    "Review USER TITLE · deadbee",
  );
});
