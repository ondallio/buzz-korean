import fs from "node:fs";
import ts from "typescript";
import { productionFiles } from "./localization-source.mjs";
const skip = new Set([
  "features/settings/ui/SettingsView.tsx",
  "features/onboarding/ui/JoinPolicyNotice.tsx",
  "features/channels/ui/ChannelBrowserDialog.tsx",
  "features/agents/ui/EnvVarsEditor.tsx",
  "features/admin-console/AdminConsoleStaffingTab.tsx",
  "features/search/ui/TopbarSearch.tsx",
  "features/projects/ui/ProjectBranchDialogs.tsx",
]);
let changed = 0;
for (const file of productionFiles("src")) {
  if (file.startsWith("src/features/profile/") || skip.has(file.slice(4)))
    continue;
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes('from "@/shared/i18n"')) continue;
  const tree = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
    edits = [],
    names = new Set();
  function visit(n) {
    if (ts.isCallExpression(n)) {
      const name = n.expression.getText(tree);
      if (
        [
          "React.useMemo",
          "useMemo",
          "React.useCallback",
          "useCallback",
        ].includes(name)
      ) {
        const replacement = name.endsWith("useMemo")
          ? "useLocaleMemo"
          : "useLocaleCallback";
        names.add(replacement);
        edits.push({
          start: n.expression.getStart(tree),
          end: n.expression.end,
          text: replacement,
        });
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(tree);
  if (!edits.length) continue;
  let result = source;
  for (const e of edits.sort((a, b) => b.start - a.start))
    result = result.slice(0, e.start) + e.text + result.slice(e.end);
  // Remove now-unused named React hook imports, leaving React namespace imports intact.
  result = result.replace(
    /import\s*\{([^}]*)\}\s*from\s*["']react["'];/g,
    (all, inside) => {
      const keep = inside
        .split(",")
        .filter((x) => !["useMemo", "useCallback"].includes(x.trim()));
      return keep.some((x) => x.trim())
        ? `import {${keep.join(",")}} from "react";`
        : "";
    },
  );
  result =
    `import { ${[...names].join(", ")} } from "@/shared/i18n";\n` + result;
  fs.writeFileSync(file, result);
  changed++;
}
console.log({ localeAwareMemoModules: changed });
