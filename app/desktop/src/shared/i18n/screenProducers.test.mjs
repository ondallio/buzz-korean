import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { setLocale, t } from "./index.ts";

function declaration(relativePath, name) {
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
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === name)
      initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(initializer, `${relativePath}: ${name} actual registry`);
  if (ts.isAsExpression(initializer)) initializer = initializer.expression;
  return vm.runInNewContext(`(${initializer.getText(file)})`);
}
test.afterEach(() => setLocale("en"));

test("every workflow title, pending and primary action registry value translates in Korean", () => {
  const path = "features/workflows/ui/WorkflowDialog.tsx";
  for (const name of ["TITLES", "PENDING_LABELS", "SUBMIT_LABELS"]) {
    const values = declaration(path, name);
    for (const source of Object.values(values)) {
      setLocale("en");
      assert.equal(t(source), source);
      setLocale("ko");
      assert.match(t(source), /[가-힣]/, `${name}: ${source}`);
      assert.notEqual(t(source), source);
    }
  }
});

test("every canonical project action has a whole translated actor/project sentence", () => {
  const messages = declaration(
    "features/projects/ui/ProjectsActivityFeed.tsx",
    "ACTIVITY_SENTENCE_SOURCES",
  );
  assert.equal(Object.keys(messages).length, 10);
  for (const [action, source] of Object.entries(messages)) {
    setLocale("en");
    assert.equal(
      t(source, { actor: "USER_ACTOR", project: "USER_PROJECT" }),
      `USER_ACTOR ${action} USER_PROJECT`,
    );
    setLocale("ko");
    const label = t(source, { actor: "USER_ACTOR", project: "USER_PROJECT" });
    assert.match(label, /[가-힣]/);
    assert.match(label, /USER_ACTOR/);
    assert.match(label, /USER_PROJECT/);
    assert.ok(!label.includes(action));
  }
});
