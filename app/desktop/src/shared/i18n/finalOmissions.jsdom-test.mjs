import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as React from "react";
import { createRoot } from "react-dom/client";
import * as i18n from "./index.ts";
import { LocalizedMessage } from "./LocalizedMessage.tsx";
import { PersonaModelField } from "@/features/agents/ui/PersonaModelField";
import { formatModelDiscoveryErrorStatus } from "@/features/agents/ui/personaModelDiscoveryStatus";

const mounted = [];
test.afterEach(async () => {
  for (const { root, host } of mounted.splice(0)) {
    await React.act(async () => root.unmount());
    host.remove();
  }
  i18n.setLocale("en");
});
async function mount(Component, props) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  await React.act(async () =>
    root.render(React.createElement(Component, props)),
  );
  return host;
}

// Compile complete production subcomponents plus their module-level constants.
// The lightweight tooltip shell exposes the real content for this locale test;
// opening the actual Radix popup remains browser interaction coverage.
function memorySubviews() {
  const file = ts.createSourceFile(
    "MemorySection.tsx",
    fs.readFileSync(
      new URL(
        "../../features/agent-memory/ui/MemorySection.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    99,
    true,
    ts.ScriptKind.TSX,
  );
  const names = ["MemoryTruncatedHint", "MemoryDanglingRefsHint"];
  const statements = file.statements.filter(
    (node) =>
      (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) ||
      (ts.isVariableStatement(node) &&
        node.declarationList.declarations.some((decl) =>
          ["MEMORY_TRUNCATED_TOOLTIP", "MEMORY_DANGLING_REF_TOOLTIP"].includes(
            decl.name.getText(file),
          ),
        )),
  );
  assert.equal(statements.length, 4);
  const compiled = ts.transpileModule(
    statements.map((node) => node.getText(file)).join("\n") +
      "\nexports.MemoryTruncatedHint=MemoryTruncatedHint;exports.MemoryDanglingRefsHint=MemoryDanglingRefsHint;",
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports = {};
  const Shell = ({ children }) => React.createElement("div", null, children);
  vm.runInNewContext(compiled, {
    exports,
    React,
    LocalizedMessage,
    translateInterfaceText: i18n.t,
    useAppLocale: i18n.useLocale,
    Tooltip: Shell,
    TooltipTrigger: Shell,
    TooltipContent: Shell,
    AlertTriangle: () => null,
    cn: (...classes) => classes.filter(Boolean).join(" "),
  });
  return exports;
}

test("production memory tooltip and dangling explanation switch live after module import", async () => {
  i18n.setLocale("en");
  const components = memorySubviews();
  const tooltip = await mount(components.MemoryTruncatedHint, {
    variant: "cards",
  });
  const dangling = await mount(components.MemoryDanglingRefsHint, {
    slugs: ["User Slug / 한국어"],
  });
  assert.match(tooltip.textContent, /This list may be incomplete/);
  assert.match(dangling.textContent, /wasn't found/);
  await React.act(async () => i18n.setLocale("ko"));
  assert.match(tooltip.textContent, /일부 메모리가 표시되지/);
  assert.match(dangling.textContent, /불러온 메모리 목록에서 찾을 수/);
  assert.match(dangling.textContent, /User Slug \/ 한국어/);
  await React.act(async () => i18n.setLocale("en"));
  assert.match(tooltip.textContent, /This list may be incomplete/);
  assert.match(dangling.textContent, /wasn't found/);
});

test("mounted real persona model field refreshes a stored status without another discovery request", async () => {
  i18n.setLocale("en");
  const status = formatModelDiscoveryErrorStatus(
    new Error("ANTHROPIC_API_KEY required"),
    "anthropic",
  );
  const host = await mount(PersonaModelField, {
    disabled: false,
    isExplicitModelRequired: false,
    model: "",
    modelDiscoveryStatus: status,
    modelDropdownOptions: [],
    showSharedComputeAutoHint: false,
    modelSelectValue: "",
    onCustomModelChange: () => {},
    onModelValueChange: () => {},
    showCustomModelInput: false,
    transition: { duration: 0 },
  });
  assert.match(
    host.querySelector('[data-testid="persona-model-discovery-status"]')
      .textContent,
    /Enter an Anthropic API key/,
  );
  await React.act(async () => i18n.setLocale("ko"));
  assert.equal(
    host.querySelector('[data-testid="persona-model-discovery-status"]')
      .textContent,
    "Anthropic 모델을 불러오려면 Anthropic API 키를 입력해 주세요.",
  );
  assert.equal(
    host
      .querySelector('[data-testid="persona-model-discovery-status"]')
      .getAttribute("aria-live"),
    "polite",
  );
});
