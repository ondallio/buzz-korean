import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { setLocale, t, validateCatalog } from "./index.ts";
import { resolveModelLabel } from "@/features/agents/lib/formatAgentModelLabel";

function attributeValue(relativePath, name, needle, bindings = {}) {
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
  const found = [];
  function visit(node) {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(file) === name &&
      node.initializer?.getText(file).includes(needle)
    )
      found.push(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(
    found.length,
    1,
    `${relativePath} has the expected production ${name} sink`,
  );
  assert.ok(ts.isJsxExpression(found[0]));
  return vm.runInNewContext(found[0].expression.getText(file), {
    localize: t,
    resolveModelLabel,
    ...bindings,
  });
}
test.afterEach(() => setLocale("en"));

test("project creation subtitle is translated at its real custom prop boundary", () => {
  setLocale("en");
  assert.match(
    attributeValue(
      "features/projects/ui/CreateProjectFormContent.tsx",
      "headerSubtitle",
      "A project starts",
    ),
    /People in the channel can talk/,
  );
  setLocale("ko");
  assert.match(
    attributeValue(
      "features/projects/ui/CreateProjectFormContent.tsx",
      "headerSubtitle",
      "A project starts",
    ),
    /채널의 참여자는 여기에서 대화하고 저장소를 복제하고 작업을 만들 수 있습니다/,
  );
});

test("agent config custom props translate surrounding labels while preserving model and effort ids", () => {
  const bindings = {
    fallbackModel: "USER_MODEL",
    effectiveProvider: "anthropic",
    disclosure: "onboarding-essential",
    effortDefaultForRenderer: "API_EFFORT",
  };
  setLocale("en");
  assert.equal(
    attributeValue(
      "features/agents/ui/AgentConfigFields.tsx",
      "defaultModelLabel",
      "Default model",
      bindings,
    ),
    "Default model (USER_MODEL)",
  );
  setLocale("ko");
  assert.equal(
    attributeValue(
      "features/agents/ui/AgentConfigFields.tsx",
      "defaultModelLabel",
      "Default model",
      bindings,
    ),
    "기본 모델(USER_MODEL)",
  );
  assert.equal(
    attributeValue(
      "features/agents/ui/AgentConfigFields.tsx",
      "inheritFallbackLabel",
      "Default ({effort})",
      bindings,
    ),
    "기본값(API_EFFORT)",
  );
  assert.equal(
    attributeValue(
      "features/agents/ui/AgentConfigFields.tsx",
      "emptyOptionLabel",
      "Select effort level",
      bindings,
    ),
    "추론 수준 선택",
  );
});

test("channel membership count is a complete localized phrase and canvas copy has catalog coverage", () => {
  for (const memberCount of [1, 2]) {
    setLocale("en");
    assert.equal(
      attributeValue(
        "features/channels/ui/ChannelManagementSheet.tsx",
        "value",
        "{count} member",
        { memberCount },
      ),
      `${memberCount} member${memberCount === 1 ? "" : "s"}`,
    );
    setLocale("ko");
    assert.equal(
      attributeValue(
        "features/channels/ui/ChannelManagementSheet.tsx",
        "value",
        "{count} member",
        { memberCount },
      ),
      `멤버 ${memberCount}명`,
    );
  }
  assert.match(
    attributeValue(
      "features/channels/ui/ChannelManagementSheet.tsx",
      "helpText",
      "Use the canvas",
    ),
    /메모, 계획, 기타 채널 정보를 함께 정리/,
  );
  const catalog = JSON.parse(
    fs.readFileSync(
      new URL("./catalogs/final-props.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(validateCatalog(catalog), []);
});
