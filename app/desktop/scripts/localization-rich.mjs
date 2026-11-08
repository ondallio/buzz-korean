import ts from "typescript";
import { jsxText, isDisplayText } from "./localization-source.mjs";
const inline = new Set([
  "a",
  "span",
  "strong",
  "em",
  "code",
  "kbd",
  "b",
  "i",
  "br",
  "s",
  "time",
]);
function literal(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}
function pluralChoice(expr) {
  return (
    ts.isConditionalExpression(expr) &&
    literal(expr.whenTrue) &&
    literal(expr.whenFalse) &&
    expr.whenTrue.text.length < 20 &&
    expr.whenFalse.text.length < 20
  );
}
export function migrateRichSource(filename, source) {
  const tree = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const edits = [],
    messages = [];
  function visit(node) {
    if (ts.isJsxElement(node) && node.children.length > 1) {
      const children = node.children;
      const eligible = children.every(
        (c) =>
          ts.isJsxText(c) ||
          ts.isJsxExpression(c) ||
          (ts.isJsxElement(c) &&
            inline.has(c.openingElement.tagName.getText(tree))),
      );
      const staticText = children
        .filter(ts.isJsxText)
        .map((c) => jsxText(c, source))
        .join("");
      const dynamic = children.some(
        (c) =>
          ts.isJsxElement(c) ||
          (ts.isJsxExpression(c) && c.expression && !literal(c.expression)),
      );
      const choices = children.filter(
        (c) =>
          ts.isJsxExpression(c) && c.expression && pluralChoice(c.expression),
      );
      if (
        eligible &&
        dynamic &&
        isDisplayText(staticText) &&
        choices.length <= 3
      ) {
        const values = [];
        let variants = [{ text: "", conditions: [] }];
        for (const child of children) {
          if (ts.isJsxText(child)) {
            const text = jsxText(child, source);
            for (const v of variants) v.text += text;
          } else if (ts.isJsxExpression(child) && !child.expression) continue;
          else if (ts.isJsxExpression(child) && literal(child.expression)) {
            for (const v of variants) v.text += child.expression.text;
          } else if (
            ts.isJsxExpression(child) &&
            pluralChoice(child.expression)
          ) {
            const e = child.expression;
            variants = variants.flatMap((v) => [
              {
                text: v.text + e.whenTrue.text,
                conditions: [...v.conditions, e.condition.getText(tree)],
              },
              {
                text: v.text + e.whenFalse.text,
                conditions: [
                  ...v.conditions,
                  `!(${e.condition.getText(tree)})`,
                ],
              },
            ]);
          } else {
            const name = `part${values.length + 1}`;
            values.push([
              name,
              ts.isJsxExpression(child)
                ? child.expression.getText(tree)
                : child.getText(tree),
            ]);
            for (const v of variants) v.text += `{${name}}`;
          }
        }
        if (values.length && variants.every((v) => isDisplayText(v.text))) {
          const textExpr = variants.reduceRight(
            (acc, v, i) =>
              i === variants.length - 1
                ? JSON.stringify(v.text)
                : `(${v.conditions.join(" && ")}) ? ${JSON.stringify(v.text)} : (${acc})`,
            "",
          );
          const replacement = `<LocalizedMessage message={${textExpr}} values={{ ${values.map(([k, v]) => `${k}: (${v})`).join(", ")} }} />`;
          edits.push({
            start: node.openingElement.end,
            end: node.closingElement.getStart(tree),
            text: replacement,
          });
          for (const v of variants)
            messages.push({
              message: v.text,
              file: filename,
              line:
                tree.getLineAndCharacterOfPosition(node.getStart(tree)).line +
                1,
            });
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  let result = source;
  for (const e of edits.sort((a, b) => b.start - a.start))
    result = result.slice(0, e.start) + e.text + result.slice(e.end);
  if (edits.length)
    result =
      'import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";\n' +
      result;
  return { source: result, messages };
}
