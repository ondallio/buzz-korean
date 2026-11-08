import fs from "node:fs";
import ts from "typescript";
import { productionFiles } from "./localization-source.mjs";
import { componentBody } from "./localization-migrate.mjs";
const labels = new Set([
  "UNAVAILABLE_KEY_LABEL",
  "UNKNOWN_CHANNEL_LABEL",
  "OTHER_SETUP_LABEL",
  "AUXILIARY_PANEL_CLOSE_LABEL",
]);
let count = 0;
for (const file of productionFiles("src")) {
  const source = fs.readFileSync(file, "utf8");
  if (![...labels].some((x) => source.includes(x))) continue;
  const tree = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    ),
    edits = [];
  function visit(n) {
    if (ts.isIdentifier(n) && labels.has(n.text)) {
      const p = n.parent;
      if (
        ts.isCallExpression(p) &&
        p.expression.getText(tree) === "localizeConstant"
      )
        return;
      if (
        ts.isImportSpecifier(p) ||
        ts.isExportSpecifier(p) ||
        (ts.isVariableDeclaration(p) && p.name === n) ||
        (ts.isPropertyAccessExpression(p) && p.name === n) ||
        (ts.isPropertyAssignment(p) && p.name === n)
      )
        return;
      let start = n.getStart(tree),
        end = n.end,
        text = `localizeConstant(${n.text})`;
      if (ts.isPropertyAssignment(p) && p.initializer === n) {
        let inside = false;
        for (let a = p.parent; a; a = a.parent)
          if (ts.isFunctionLike(a)) inside = true;
        if (!inside) {
          start = p.getStart(tree);
          end = p.end;
          text = `get ${p.name.getText(tree)}(){return localizeConstant(${n.text});}`;
        }
      }
      edits.push({ start, end, text });
    }
    ts.forEachChild(n, visit);
  }
  visit(tree);
  if (!edits.length) continue;
  let subscribe = false;
  function hooks(n) {
    const body = componentBody(n);
    if (
      body &&
      !/\b(?:useAppTranslation|useAppLocale|useLocale|useTranslation|useInterfaceLocale)\(/.test(
        body.getText(tree),
      )
    ) {
      if (ts.isBlock(body))
        edits.push({
          start: body.getStart(tree) + 1,
          end: body.getStart(tree) + 1,
          text: "\n useConstantLocale();\n",
        });
      else {
        edits.push({
          start: body.getStart(tree),
          end: body.getStart(tree),
          text: "{useConstantLocale(); return (",
        });
        edits.push({ start: body.end, end: body.end, text: ");}" });
      }
      subscribe = true;
    }
    ts.forEachChild(n, hooks);
  }
  hooks(tree);
  let after = source;
  for (const e of edits.sort((a, b) => b.start - a.start || b.end - a.end))
    after = after.slice(0, e.start) + e.text + after.slice(e.end);
  fs.writeFileSync(
    file,
    `import {t as localizeConstant${subscribe ? ", useLocale as useConstantLocale" : ""}} from "@/shared/i18n";\n` +
      after,
  );
  count++;
}
console.log({ constantConsumerModules: count });
