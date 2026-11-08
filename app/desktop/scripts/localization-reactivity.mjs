import ts from "typescript";
import fs from "node:fs";
import { productionFiles } from "./localization-source.mjs";

export function bindComponentTranslations(file, source) {
  if (
    !source.includes("useLocale as useAppLocale") &&
    !source.includes("getLocale as getAppLocale")
  )
    return source;
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const edits = [];
  let needsBound = false,
    needsLocale = false;
  function containsLocalize(n) {
    let found = false;
    function visit(x) {
      if (ts.isIdentifier(x) && x.text === "localize") found = true;
      ts.forEachChild(x, visit);
    }
    visit(n);
    return found;
  }
  function visit(n) {
    if (
      ts.isExpressionStatement(n) &&
      ts.isCallExpression(n.expression) &&
      n.expression.expression.getText(tree) === "useAppLocale"
    ) {
      if (containsLocalize(n.parent)) {
        edits.push({
          start: n.getStart(tree),
          end: n.end,
          text: "const { t: localize } = useAppTranslation();",
        });
        needsBound = true;
      } else needsLocale = true;
    }
    if (
      ts.isCallExpression(n) &&
      /(?:^|\.)(?:useMemo|useCallback)$/.test(n.expression.getText(tree)) &&
      n.arguments.length >= 2 &&
      ts.isArrayLiteralExpression(n.arguments[1])
    ) {
      const deps = n.arguments[1];
      const entries = deps.elements
        .filter(
          (e) =>
            !ts.isOmittedExpression(e) && e.getText(tree) !== "getAppLocale()",
        )
        .map((e) => e.getText(tree));
      if (containsLocalize(n.arguments[0]) && !entries.includes("localize"))
        entries.push("localize");
      if (
        deps.elements.some((e) => e.getText(tree) === "getAppLocale()") ||
        entries.length !== deps.elements.length
      )
        edits.push({
          start: deps.getStart(tree),
          end: deps.end,
          text: `[${entries.join(", ")}]`,
        });
    }
    ts.forEachChild(n, visit);
  }
  visit(tree);
  let result = source;
  for (const e of edits.sort((a, b) => b.start - a.start))
    result = result.slice(0, e.start) + e.text + result.slice(e.end);
  result = result.replace(/,?\s*getLocale as getAppLocale\s*,?/g, ", ");
  result = result.replace(
    "useLocale as useAppLocale",
    needsLocale
      ? "useLocale as useAppLocale" +
          (needsBound ? ", useTranslation as useAppTranslation" : "")
      : needsBound
        ? "useTranslation as useAppTranslation"
        : "",
  );
  // Remove the global translator import only when every reference is shadowed by a component binding.
  const updated = ts.createSourceFile(
    file,
    result,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let globalReference = false;
  function check(n) {
    if (
      ts.isIdentifier(n) &&
      n.text === "localize" &&
      !ts.isImportSpecifier(n.parent) &&
      !ts.isBindingElement(n.parent)
    ) {
      let local = false;
      for (let p = n.parent; p; p = p.parent)
        if (
          ts.isFunctionLike(p) &&
          p.body
            ?.getText(updated)
            .includes("const { t: localize } = useAppTranslation();")
        ) {
          local = true;
          break;
        }
      if (!local) globalReference = true;
    }
    ts.forEachChild(n, check);
  }
  check(updated);
  if (!globalReference) result = result.replace(/t as localize\s*,?\s*/, "");
  result = result.replace(
    /import\s*\{[\s\S]*?\}\s*from\s*["']@\/shared\/i18n["'];/,
    (header) =>
      header
        .replace(/,\s*,/g, ",")
        .replace(/\{\s*,/g, "{")
        .replace(/,\s*\}/g, " }"),
  );
  return result;
}
if (process.argv[1]?.endsWith("localization-reactivity.mjs")) {
  const skip = new Set([
    "features/settings/ui/SettingsView.tsx",
    "features/onboarding/ui/JoinPolicyNotice.tsx",
    "features/channels/ui/ChannelBrowserDialog.tsx",
    "features/agents/ui/EnvVarsEditor.tsx",
    "features/admin-console/AdminConsoleStaffingTab.tsx",
    "features/search/ui/TopbarSearch.tsx",
    "features/projects/ui/ProjectBranchDialogs.tsx",
  ]);
  let count = 0;
  for (const file of productionFiles("src")) {
    if (file.startsWith("src/features/profile/") || skip.has(file.slice(4)))
      continue;
    const before = fs.readFileSync(file, "utf8");
    const after = bindComponentTranslations(file, before);
    if (before !== after) {
      fs.writeFileSync(file, after);
      count++;
    }
  }
  console.log({ reactiveModules: count });
}
