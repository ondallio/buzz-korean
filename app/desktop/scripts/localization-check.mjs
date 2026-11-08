import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  productionFiles,
  DISPLAY_ATTRIBUTES,
  inspectFile,
} from "./localization-source.mjs";

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
const translators = new Set([
  "t",
  "localize",
  "translateInterfaceText",
  "localizeConstant",
  "translateDisplayAttribute",
  "translateFinalText",
  "feedbackMessage",
  "localizedFeedback",
]);
const displayProps = new Set([
  ...DISPLAY_ATTRIBUTES,
  "aria-label",
  "ariaLabel",
  "ariaDescription",
  "placeholder",
  "title",
  "description",
  "label",
  "tooltip",
  "emptyText",
  "emptyLabel",
  "loadingLabel",
  "searchPlaceholder",
  "buttonLabel",
  "triggerLabel",
  "sectionLabel",
  "backLabel",
  "confirmText",
  "cancelText",
  "errorText",
  "successText",
  "tooltipLabel",
]);

function literals(node) {
  if (!node) return [];
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return [node.text];
  if (ts.isParenthesizedExpression(node)) return literals(node.expression);
  if (ts.isConditionalExpression(node))
    return [...literals(node.whenTrue), ...literals(node.whenFalse)];
  return [];
}

function rawPresentation(node) {
  if (!node) return [];
  if (ts.isTemplateExpression(node)) {
    const textParts = [
      node.head.text,
      ...node.templateSpans.map((s) => s.literal.text),
    ];
    const parts = textParts.join("{data}");
    return [
      ...(/[A-Za-z]/.test(textParts.join("")) ? [parts] : []),
      ...node.templateSpans.flatMap((s) => rawPresentation(s.expression)),
    ];
  }
  if (ts.isParenthesizedExpression(node))
    return rawPresentation(node.expression);
  if (ts.isConditionalExpression(node))
    return [
      ...rawPresentation(node.whenTrue),
      ...rawPresentation(node.whenFalse),
    ];
  if (
    ts.isBinaryExpression(node) &&
    [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
      node.operatorToken.kind,
    )
  )
    return rawPresentation(node.right);
  return literals(node);
}

function valueKeys(node) {
  if (!node) return new Set();
  if (!ts.isObjectLiteralExpression(node)) return null;
  if (node.properties.some(ts.isSpreadAssignment)) return null;
  return new Set(
    node.properties.map((p) => p.name?.getText().replace(/^['"]|['"]$/g, "")),
  );
}

/** Audit actual production call sites rather than treating catalog size as coverage. */
export function analyzeSource(file, source, catalog, exclusions = new Set()) {
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const result = {
    messages: [],
    missing: [],
    valueErrors: [],
    unwrappedAttributes: [],
    rawJsx: [],
    dynamicMessages: 0,
    dynamicSites: [],
    unwrappedFeedback: inspectFile(file, source)
      .found.filter(
        (r) => r.kind.startsWith("error") && !exclusions.has(r.message),
      )
      .map(({ node, ...r }) => ({ file, ...r })),
  };
  function record(messageNodes, valuesNode, node) {
    const keys = valueKeys(valuesNode);
    const messages = literals(messageNodes);
    if (!messages.length) {
      result.dynamicMessages++;
      result.dynamicSites.push({
        file,
        line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
        source: messageNodes?.getText(tree),
      });
    }
    for (const message of messages) {
      const location = {
        file,
        line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
        message,
      };
      result.messages.push(location);
      if (!Object.hasOwn(catalog, message) && !exclusions.has(message))
        result.missing.push(location);
      if (keys !== null) {
        for (const [, name] of message.matchAll(PLACEHOLDER)) {
          if (!keys.has(name))
            result.valueErrors.push({ ...location, missingValue: name });
        }
      }
    }
  }
  function visit(node) {
    if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text)) {
      const message = node.text.replace(/\s+/g, " ").trim();
      let code = false;
      for (let p = node.parent; p; p = p.parent)
        if (
          ts.isJsxElement(p) &&
          ["code", "pre", "kbd"].includes(
            p.openingElement.tagName.getText(tree),
          )
        )
          code = true;
      if (!code && !exclusions.has(message))
        result.rawJsx.push({
          file,
          line: tree.getLineAndCharacterOfPosition(node.pos).line + 1,
          message,
        });
    }
    if (
      ts.isCallExpression(node) &&
      translators.has(node.expression.getText(tree))
    )
      record(node.arguments[0], node.arguments[1], node);
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName.getText(tree);
      const attrs = node.attributes.properties;
      if (tag === "LocalizedMessage") {
        const prop = (name) =>
          attrs.find(
            (a) => ts.isJsxAttribute(a) && a.name.getText(tree) === name,
          )?.initializer;
        const expression = (v) =>
          v && ts.isJsxExpression(v) ? v.expression : v;
        record(expression(prop("message")), expression(prop("values")), node);
      } else {
        for (const attr of attrs) {
          if (
            !ts.isJsxAttribute(attr) ||
            !displayProps.has(attr.name.getText(tree))
          )
            continue;
          const value =
            attr.initializer && ts.isJsxExpression(attr.initializer)
              ? attr.initializer.expression
              : attr.initializer;
          for (const message of rawPresentation(value)) {
            if (/[A-Za-z]/.test(message) && !exclusions.has(message))
              result.unwrappedAttributes.push({
                file,
                line:
                  tree.getLineAndCharacterOfPosition(attr.getStart(tree)).line +
                  1,
                message,
                attribute: attr.name.getText(tree),
              });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return result;
}

/** Normalize all reviewed exclusion schemas without converting fallbacks to success. */
export function readExclusions(directory) {
  const excluded = new Set();
  for (const name of fs
    .readdirSync(directory)
    .filter((f) => /review\.json$/.test(f))) {
    const review = JSON.parse(
      fs.readFileSync(path.join(directory, name), "utf8"),
    );
    for (const entry of [
      ...(review.records ?? review.items ?? review.entries ?? []),
      ...(review.excluded ?? []),
    ]) {
      if (
        entry.status === "excluded" ||
        (review.excluded ?? []).includes(entry)
      )
        excluded.add(
          typeof entry === "string" ? entry : (entry.source ?? entry.message),
        );
    }
  }
  for (const entry of JSON.parse(
    fs.readFileSync(path.join(directory, "exclusions.json"), "utf8"),
  ))
    excluded.add(entry.message);
  return excluded;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { default: runtimeCatalog } = await import(
    "../src/shared/i18n/catalogs/index.ts"
  );
  const protectedCatalog = JSON.parse(
    fs.readFileSync("src/shared/i18n/catalogs/protected.json", "utf8"),
  );
  // Audit both graphs without linking protected copy into the public artifact.
  const catalog = { ...runtimeCatalog, ...protectedCatalog };
  const { validateCatalog } = await import("../src/shared/i18n/index.ts");
  const directory = path.resolve("../docs/localization");
  const exclusions = readExclusions(directory);
  const reports = productionFiles("src")
    .filter((f) => !f.includes("/shared/i18n/"))
    .map((file) =>
      analyzeSource(file, fs.readFileSync(file, "utf8"), catalog, exclusions),
    );
  const report = {
    files: reports.length,
    catalogKeys: Object.keys(catalog).length,
    staticMessageSites: reports.reduce((n, r) => n + r.messages.length, 0),
    dynamicMessageSites: reports.reduce((n, r) => n + r.dynamicMessages, 0),
    catalogErrors: validateCatalog(catalog),
    dynamicSites: reports.flatMap((r) => r.dynamicSites),
    rawJsx: reports.flatMap((r) => r.rawJsx),
    missing: reports.flatMap((r) => r.missing),
    valueErrors: reports.flatMap((r) => r.valueErrors),
    unwrappedAttributes: reports.flatMap((r) => r.unwrappedAttributes),
    unwrappedFeedback: reports.flatMap((r) => r.unwrappedFeedback),
    limitations:
      "Static coverage is not proof of reachability, native behavior, arbitrary runtime messages, or all plain English source. Dynamic producers require their production-seam tests and reviewed inventory.",
  };
  fs.writeFileSync(
    path.join(directory, "coverage-current.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      ...report,
      missing: report.missing.length,
      valueErrors: report.valueErrors.length,
      unwrappedAttributes: report.unwrappedAttributes.length,
      dynamicSites: report.dynamicSites.length,
      rawJsx: report.rawJsx.length,
      unwrappedFeedback: report.unwrappedFeedback.length,
    }),
  );
  if (
    report.catalogErrors.length ||
    report.missing.length ||
    report.valueErrors.length ||
    report.unwrappedAttributes.length ||
    report.rawJsx.length ||
    report.unwrappedFeedback.length
  )
    process.exitCode = 1;
}
