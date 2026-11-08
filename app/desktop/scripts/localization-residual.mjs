import fs from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";
import { expandTemplate } from "./localization-source.mjs";
import { componentBody } from "./localization-migrate.mjs";
const records = JSON.parse(
  fs.readFileSync("../docs/localization/residual-candidates.json", "utf8"),
);
const skip = new Set([
  "features/settings/ui/harnessCatalogLogic.ts",
  "features/settings/ui/harnessGalleryLogic.ts",
  "features/projects/lib/projectsViewHelpers.ts",
  "features/projects/ui/ProjectsPullRequestsList.tsx",
  "features/projects/ui/PullRequestMetaRail.tsx",
  "features/projects/ui/ProjectWorkItemContextDetails.tsx",
]);
const grouped = new Map();
for (const r of records)
  if (
    r.approved !== false &&
    !r.file.startsWith("features/workflows/") &&
    !skip.has(r.file)
  ) {
    const list = grouped.get(r.file) || [];
    list.push(r);
    grouped.set(r.file, list);
  }
const result = {
  changed: [],
  alreadyApplied: [],
  moduleConstants: [],
  stale: [],
  skipped: records.filter((r) => r.approved === false).length,
};
for (const [file, items] of grouped) {
  const filename = "src/" + file,
    source = fs.readFileSync(filename, "utf8");
  const hash = crypto.createHash("sha256").update(source).digest("hex");
  if (items.some((r) => r.fileSha256 !== hash)) {
    if (source.includes("t as translateInterfaceText"))
      result.alreadyApplied.push(file);
    else result.stale.push(file);
    continue;
  }
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const byPos = new Map();
  function map(n) {
    byPos.set(`${n.getStart(tree)}:${n.end}`, n);
    ts.forEachChild(n, map);
  }
  map(tree);
  const edits = [];
  for (const r of items) {
    const n = byPos.get(`${r.start}:${r.end}`);
    if (!n || n.end !== r.end || n.getText(tree) !== r.rawNodeSource)
      throw new Error(`Source drift: ${file}:${r.line}`);
    if (edits.some((e) => r.start < e.end && r.end > e.start)) continue;
    if (ts.isVariableDeclaration(n.parent)) {
      let inside = false;
      for (let p = n.parent; p; p = p.parent)
        if (ts.isFunctionLike(p)) inside = true;
      if (!inside) {
        result.moduleConstants.push(r);
        continue;
      }
    }
    let message = JSON.stringify(r.message),
      values = [];
    if (ts.isTemplateExpression(n)) {
      const expanded = expandTemplate(n, tree);
      values = expanded.values;
      message = expanded.variants.reduceRight(
        (acc, v, i) =>
          i === expanded.variants.length - 1
            ? JSON.stringify(v.message)
            : `(${v.conditions.join(" && ")}) ? ${JSON.stringify(v.message)} : (${acc})`,
        "",
      );
    } else
      values = [
        ...new Set(
          Array.from(
            r.message.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g),
            (m) => m[1],
          ),
        ),
      ].map((name) => [name, JSON.stringify(`{${name}}`)]);
    let text = `translateInterfaceText(${message}`;
    if (values.length)
      text += `, { ${values.map(([k, v]) => `${JSON.stringify(k)}: String(${v})`).join(", ")} }`;
    text += ")";
    edits.push({ start: r.start, end: r.end, text });
  }
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
          text: "\n useInterfaceLocale();\n",
        });
      else {
        edits.push({
          start: body.getStart(tree),
          end: body.getStart(tree),
          text: "{useInterfaceLocale(); return (",
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
  after =
    `import { t as translateInterfaceText${subscribe ? ", useLocale as useInterfaceLocale" : ""} } from "@/shared/i18n";\n` +
    after;
  fs.writeFileSync(filename, after);
  result.changed.push(file);
}
fs.writeFileSync(
  "../docs/localization/residual-application.json",
  JSON.stringify(result, null, 2),
);
console.log({
  changed: result.changed.length,
  stale: result.stale.length,
  manualRecords: result.skipped,
  moduleConstants: result.moduleConstants.length,
  staleFiles: result.stale,
});
