import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  inspectFile,
  productionFiles,
  ownedFiles,
  expandTemplate,
} from "./localization-source.mjs";

function insideFunction(node) {
  for (let p = node.parent; p; p = p.parent)
    if (ts.isFunctionLike(p)) return true;
  return false;
}
export function componentBody(node) {
  if (
    !ts.isFunctionDeclaration(node) &&
    !ts.isFunctionExpression(node) &&
    !ts.isArrowFunction(node)
  )
    return null;
  if (!node.body) return null;
  let owner = node;
  while (
    owner.parent &&
    !ts.isSourceFile(owner.parent) &&
    !ts.isVariableDeclaration(owner) &&
    !ts.isFunctionDeclaration(owner)
  )
    owner = owner.parent;
  if (ts.isFunctionDeclaration(owner) && owner !== node) return null;
  const name =
    ts.isVariableDeclaration(owner) || ts.isFunctionDeclaration(owner)
      ? owner.name?.getText()
      : node.name?.getText();
  if (!name || !(/^[A-Z]/.test(name) || /^use[A-Z]/.test(name))) return null;
  // Hooks must be at the component/hook entry, never a nested callback.
  for (let p = node.parent; p && p !== owner; p = p.parent)
    if (ts.isFunctionLike(p)) return null;
  let jsx = false;
  const visit = (n) => {
    if (
      ts.isJsxElement(n) ||
      ts.isJsxSelfClosingElement(n) ||
      ts.isJsxFragment(n)
    )
      jsx = true;
    ts.forEachChild(n, visit);
  };
  visit(node.body);
  return jsx || /^use[A-Z]/.test(name) ? node.body : null;
}
export function migrateSource(filename, source, messages) {
  const { tree, found } = inspectFile(filename, source);
  const edits = [];
  let translated = false,
    subscribed = false,
    needsLocale = false;
  if (source.includes("t as localize")) return source;
  for (const item of found) {
    if (!messages.has(item.message)) continue;
    const n = item.node;
    let message = JSON.stringify(item.message);
    let values = [];
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
    } else {
      values = [
        ...new Set(
          Array.from(
            item.message.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g),
            (m) => m[1],
          ),
        ),
      ].map((name) => [name, JSON.stringify(`{${name}}`)]);
    }
    let call = `localize(${message}`;
    if (values.length)
      call += `, { ${values.map(([key, value]) => `${JSON.stringify(key)}: String(${value})`).join(", ")} }`;
    call += ")";
    let start = item.start,
      end = item.end,
      text = call;
    if (item.kind === "jsx-text" || ts.isJsxAttribute(n.parent))
      text = `{${call}}`;
    if (ts.isPropertyAssignment(n.parent) && !insideFunction(n)) {
      start = n.parent.getStart(tree);
      end = n.parent.end;
      text = `get ${n.parent.name.getText(tree)}() { return ${call}; }`;
    }
    if (edits.some((e) => start < e.end && end > e.start)) continue;
    edits.push({ start, end, text });
    translated = true;
  }
  if (!translated) return source;
  function visit(node) {
    const body = componentBody(node);
    if (body) {
      if (ts.isBlock(body))
        edits.push({
          start: body.getStart(tree) + 1,
          end: body.getStart(tree) + 1,
          text: "\n  useAppLocale();\n",
        });
      else {
        edits.push({
          start: body.getStart(tree),
          end: body.getStart(tree),
          text: "{ useAppLocale(); return (",
        });
        edits.push({ start: body.end, end: body.end, text: "); }" });
      }
      subscribed = true;
    }
    if (
      ts.isCallExpression(node) &&
      /(?:^|\.)(?:useMemo|useCallback)$/.test(node.expression.getText(tree)) &&
      node.arguments.length >= 2
    ) {
      const deps = node.arguments[1];
      if (ts.isArrayLiteralExpression(deps)) {
        const position = deps.end - 1;
        edits.push({
          start: position,
          end: position,
          text: `${deps.elements.length ? (deps.elements.hasTrailingComma ? " " : ", ") : ""}getAppLocale()`,
        });
        needsLocale = true;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let result = source;
  for (const e of edits)
    result = result.slice(0, e.start) + e.text + result.slice(e.end);
  const names = [
    "t as localize",
    ...(subscribed ? ["useLocale as useAppLocale"] : []),
    ...(needsLocale ? ["getLocale as getAppLocale"] : []),
  ];
  return `import { ${names.join(", ")} } from "@/shared/i18n";\n` + result;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src",
  );
  const source = JSON.parse(
    fs.readFileSync(
      path.resolve(root, "../../docs/localization/messages.json"),
      "utf8",
    ),
  );
  const messages = new Set(source);
  let changed = 0;
  for (const filename of productionFiles(root)) {
    if (ownedFiles.has(path.relative(root, filename))) continue;
    const before = fs.readFileSync(filename, "utf8");
    const after = migrateSource(filename, before, messages);
    if (after !== before) {
      fs.writeFileSync(filename, after);
      changed++;
    }
  }
  console.log(JSON.stringify({ changedFiles: changed }));
}
