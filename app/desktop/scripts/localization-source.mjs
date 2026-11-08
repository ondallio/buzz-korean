import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

export const DISPLAY_ATTRIBUTES = new Set([
  "title",
  "placeholder",
  "aria-label",
  "aria-description",
  "alt",
  "label",
  "description",
  "tooltip",
  "emptyMessage",
  "loadingMessage",
  "helperText",
  "heading",
  "subtitle",
  "confirmLabel",
  "cancelLabel",
  "submitLabel",
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
  "defaultModelLabel",
  "emptyOptionLabel",
  "inheritFallbackLabel",
  "phaseLabel",
  "aria-roledescription",
]);
const DISPLAY_PROPERTIES = new Set([
  "label",
  "title",
  "description",
  "placeholder",
  "tooltip",
  "emptyMessage",
  "errorMessage",
  "helperText",
  "heading",
  "subtitle",
]);
const excludedPaths =
  /(?:\.test\.|\.jsdom-test\.|\/testing\/|\/shared\/i18n\/|routeTree\.gen|\/assets\/)/;
const ownedFiles = new Set([
  "shared/lib/datetime.ts",
  "features/messages/lib/dateFormatters.ts",
  "features/notifications/lib/notificationFormat.ts",
]);
export function productionFiles(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? productionFiles(path.join(root, e.name))
        : /\.(tsx?|jsx?|mjs)$/.test(e.name)
          ? [path.join(root, e.name)]
          : [],
    )
    .filter((f) => !excludedPaths.test(f));
}
export function isDisplayText(text) {
  return (
    /[A-Za-z]/.test(text) &&
    !/^(?:https?:|wss?:|\/|[\w.-]+@|#[\da-f]{3,8}$)/i.test(text) &&
    !/^(?:[A-Z_]+|[\w.-]+\.(?:ts|js|json|rs|md)|(?:Cmd|Ctrl|Alt|Shift|Meta|Mod)[+\s])$/.test(
      text,
    )
  );
}
export function jsxText(node, source) {
  // Match React/TypeScript JSX whitespace folding rather than trimming all newlines.
  const quoted = ts.transpileModule(
    `const x = <>${source.slice(node.pos, node.end)}</>;`,
    {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ESNext,
      },
    },
  ).outputText;
  const match = quoted.match(/children: ("(?:[^"\\]|\\.)*")/);
  try {
    return match ? JSON.parse(match[1]) : node.text.replace(/\s+/g, " ").trim();
  } catch {
    return node.text.replace(/\s+/g, " ").trim();
  }
}
function displayContext(node) {
  const p = node.parent;
  if (ts.isJsxAttribute(p))
    return DISPLAY_ATTRIBUTES.has(p.name.getText()) ? "attribute" : null;
  if (
    ts.isPropertyAssignment(p) &&
    p.initializer === node &&
    DISPLAY_PROPERTIES.has(p.name.getText().replace(/["']/g, ""))
  )
    return "property";
  if (ts.isJsxExpression(p)) {
    if (ts.isJsxAttribute(p.parent))
      return DISPLAY_ATTRIBUTES.has(p.parent.name.getText())
        ? "attribute-expression"
        : null;
    return "jsx-expression";
  }
  if (ts.isConditionalExpression(p)) return displayContext(p);
  if (
    ts.isBinaryExpression(p) &&
    [
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.QuestionQuestionToken,
      ts.SyntaxKind.AmpersandAmpersandToken,
    ].includes(p.operatorToken.kind)
  )
    return displayContext(p);
  if (ts.isCallExpression(p)) {
    const expr = p.expression.getText();
    if (
      /^(?:toast(?:\.(?:success|error|info|warning|message|loading))?|alert|confirm)$/.test(
        expr,
      ) &&
      p.arguments[0] === node
    )
      return "notification";
    if (
      /^set\w*(?:Error|Warning|Notice|StatusMessage)\w*$/.test(expr) &&
      p.arguments[0] === node
    )
      return "error";
  }
  return null;
}
export function inspectFile(filename, source) {
  const tree = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found = [];
  function visit(node) {
    let kind = null,
      text = null;
    if (ts.isJsxText(node)) {
      kind = "jsx-text";
      text = jsxText(node, source);
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    ) {
      kind = displayContext(node);
      text = node.text;
    } else if (ts.isTemplateExpression(node)) {
      kind = displayContext(node);
      if (kind) {
        text = node.head.text;
        node.templateSpans.forEach((span, i) => {
          text += `{value${i + 1}}` + span.literal.text;
        });
        kind += "-template";
      }
    }
    if (kind && text && isDisplayText(text)) {
      const start = ts.isJsxText(node) ? node.pos : node.getStart(tree),
        line = tree.getLineAndCharacterOfPosition(start).line + 1;
      found.push({ start, end: node.end, line, kind, message: text, node });
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return { tree, found };
}
export function inventory(root) {
  return productionFiles(root).flatMap((file) =>
    inspectFile(file, fs.readFileSync(file, "utf8")).found.map(
      ({ node, ...item }) => ({ file: path.relative(root, file), ...item }),
    ),
  );
}
export { ownedFiles };

export function expandTemplate(node, tree) {
  const values = [];
  let variants = [{ message: node.head.text, conditions: [] }];
  for (const [index, span] of node.templateSpans.entries()) {
    const e = span.expression;
    const string = (n) =>
      ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
    if (
      ts.isConditionalExpression(e) &&
      string(e.whenTrue) &&
      string(e.whenFalse) &&
      /^(?:s|es|y|ies|is|are|agent|agents|entry|entries)?$/.test(
        e.whenTrue.text,
      ) &&
      /^(?:s|es|y|ies|is|are|agent|agents|entry|entries)?$/.test(
        e.whenFalse.text,
      ) &&
      variants.length < 8
    ) {
      variants = variants.flatMap((v) => [
        {
          message: v.message + e.whenTrue.text + span.literal.text,
          conditions: [...v.conditions, e.condition.getText(tree)],
        },
        {
          message: v.message + e.whenFalse.text + span.literal.text,
          conditions: [...v.conditions, `!(${e.condition.getText(tree)})`],
        },
      ]);
    } else {
      const name = `value${index + 1}`;
      values.push([name, e.getText(tree)]);
      for (const v of variants) v.message += `{${name}}${span.literal.text}`;
    }
  }
  return { variants, values };
}
