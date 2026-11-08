import fs from "node:fs";
import ts from "typescript";
import { productionFiles, expandTemplate } from "./localization-source.mjs";
import { componentBody } from "./localization-migrate.mjs";
const names = new Set([
  "ariaLabel",
  "ariaDescription",
  "emptyText",
  "emptyLabel",
  "loadingLabel",
  "loadingTitle",
  "searchPlaceholder",
  "buttonLabel",
  "triggerLabel",
  "sectionLabel",
  "backLabel",
  "confirmText",
  "cancelText",
  "errorText",
  "successText",
  "hint",
  "tooltipLabel",
]);
const sources = [];
for (const file of productionFiles("src")) {
  if (file.startsWith("src/features/workflows/")) continue;
  const source = fs.readFileSync(file, "utf8"),
    tree = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
    edits = [];
  function visit(n) {
    if (
      ts.isJsxAttribute(n) &&
      names.has(n.name.getText(tree)) &&
      n.initializer
    ) {
      let v = n.initializer;
      if (ts.isJsxExpression(v)) v = v.expression;
      if (
        v &&
        (ts.isStringLiteral(v) ||
          ts.isNoSubstitutionTemplateLiteral(v) ||
          ts.isTemplateExpression(v))
      ) {
        if (
          ts.isStringLiteral(v) &&
          (!/[A-Za-z]/.test(v.text) || v.text === "Bestie")
        )
          return;
        let message,
          values = [];
        if (ts.isTemplateExpression(v)) {
          const x = expandTemplate(v, tree);
          if (x.variants.length !== 1)
            throw new Error("manual variants required");
          message = x.variants[0].message;
          values = x.values;
        } else message = v.text;
        let text = `translateDisplayAttribute(${JSON.stringify(message)}`;
        if (values.length)
          text += `, { ${values.map(([k, e]) => `${JSON.stringify(k)}:String(${e})`).join(", ")} }`;
        text += ")";
        if (ts.isStringLiteral(n.initializer)) text = `{${text}}`;
        edits.push({ start: v.getStart(tree), end: v.end, text });
        sources.push(message);
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(tree);
  if (!edits.length) continue;
  let subscribed = false;
  function hooks(n) {
    const body = componentBody(n);
    if (
      body &&
      !/\b(?:useAppTranslation|useAppLocale|useLocale|useTranslation|useInterfaceLocale|useConstantLocale)\(/.test(
        body.getText(tree),
      )
    ) {
      if (ts.isBlock(body))
        edits.push({
          start: body.getStart(tree) + 1,
          end: body.getStart(tree) + 1,
          text: "\n useAttributeLocale();\n",
        });
      else {
        edits.push({
          start: body.getStart(tree),
          end: body.getStart(tree),
          text: "{useAttributeLocale(); return (",
        });
        edits.push({ start: body.end, end: body.end, text: ");}" });
      }
      subscribed = true;
    }
    ts.forEachChild(n, hooks);
  }
  hooks(tree);
  let after = source;
  for (const e of edits.sort((a, b) => b.start - a.start || b.end - a.end))
    after = after.slice(0, e.start) + e.text + after.slice(e.end);
  if (fs.readFileSync(file, "utf8") !== source)
    throw new Error(`Concurrent edit: ${file}`);
  fs.writeFileSync(
    file,
    `import {t as translateDisplayAttribute${subscribed ? ", useLocale as useAttributeLocale" : ""}} from "@/shared/i18n";\n` +
      after,
  );
}
fs.writeFileSync(
  "../docs/localization/additional-attribute-sources.json",
  JSON.stringify([...new Set(sources)], null, 2),
);
console.log({ attributeSources: new Set(sources).size });
