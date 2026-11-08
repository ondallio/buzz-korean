import fs from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";
import {
  productionFiles,
  isDisplayText,
  expandTemplate,
} from "./localization-source.mjs";
const props = new Set([
  "legend",
  "headerSubtitle",
  "emptyDescription",
  "emptyTitle",
  "backButtonAriaLabel",
  "resizeHandleAriaLabel",
  "triggerAriaLabel",
  "actionAriaLabel",
  "dismissLabel",
  "collapseDescendantsLabel",
  "helpText",
  "titlePlaceholder",
  "countTitle",
  "titleAttr",
  "affiliationTitle",
  "identifierTitle",
  "secondarySubmitLabel",
  "actionLabel",
  "unavailableMessage",
  "ariaValueText",
  "resetLabel",
  "quickCreateLabel",
  "createLabel",
  "inheritedLabel",
  "emptyOptionsLabel",
  "assetLabel",
]);
const excluded = new Set([
  "src/features/projects/ui/CreateProjectFormContent.tsx",
  "src/features/messages/ui/ComposerUploadProgressOverlay.tsx",
  "src/features/messages/ui/ComposerUploadProgressPill.tsx",
  "src/features/settings/SidebarUpdateCard.tsx",
  "src/features/channels/ui/ChannelManagementSheet.tsx",
  "src/features/agents/ui/AgentConfigFields.tsx",
  "src/features/agents/ui/buzzAgentModelTuningFields.tsx",
]);
const records = [];
for (const file of productionFiles("src")) {
  if (file.includes("/shared/i18n/") || excluded.has(file)) continue;
  const source = fs.readFileSync(file, "utf8"),
    tree = ts.createSourceFile(
      file,
      source,
      99,
      true,
      file.endsWith("x") ? 4 : 3,
    ),
    seen = new Set();
  function collect(n, kind, prop) {
    if (!n) return;
    if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateExpression(n)
    ) {
      const expanded = ts.isTemplateExpression(n)
        ? expandTemplate(n, tree)
        : { variants: [{ message: n.text, conditions: [] }], values: [] };
      if (
        !expanded.variants.some((v) => isDisplayText(v.message)) ||
        seen.has(n.pos)
      )
        return;
      seen.add(n.pos);
      records.push({
        file,
        line: tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1,
        start: n.getStart(tree),
        end: n.end,
        rawNodeSource: n.getText(tree),
        fileSha256: crypto.createHash("sha256").update(source).digest("hex"),
        kind,
        prop,
        jsxAttribute: ts.isJsxAttribute(n.parent),
        variants: expanded.variants,
        values: expanded.values,
      });
    } else if (ts.isConditionalExpression(n)) {
      collect(n.whenTrue, kind, prop);
      collect(n.whenFalse, kind, prop);
    } else if (
      ts.isBinaryExpression(n) &&
      [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
        n.operatorToken.kind,
      )
    )
      collect(n.right, kind, prop);
    else if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n))
      collect(n.expression, kind, prop);
    else if (ts.isObjectLiteralExpression(n))
      for (const p of n.properties)
        if (ts.isPropertyAssignment(p) && p.name.getText(tree) === "message")
          collect(p.initializer, kind, prop);
  }
  function visit(n) {
    if (
      ts.isJsxAttribute(n) &&
      props.has(n.name.getText(tree)) &&
      n.initializer
    )
      collect(
        ts.isJsxExpression(n.initializer)
          ? n.initializer.expression
          : n.initializer,
        "custom-prop",
        n.name.getText(tree),
      );
    if (
      ts.isCallExpression(n) &&
      /^set\w*(?:Error|Warning|Notice|StatusMessage)\w*$/.test(
        n.expression.getText(tree),
      )
    )
      collect(n.arguments[0], "feedback", n.expression.getText(tree));
    ts.forEachChild(n, visit);
  }
  visit(tree);
}
fs.writeFileSync(
  "../docs/localization/final-sinks-source.json",
  JSON.stringify(records, null, 2) + "\n",
);
console.log({
  sites: records.length,
  files: new Set(records.map((r) => r.file)).size,
  messages: [
    ...new Set(records.flatMap((r) => r.variants.map((v) => v.message))),
  ],
});
